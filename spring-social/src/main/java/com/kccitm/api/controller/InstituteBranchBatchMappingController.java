package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.InstituteBatch;
import com.kccitm.api.model.InstituteBranchBatchMapping;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;

@RestController
public class InstituteBranchBatchMappingController {

    @Autowired
    private InstituteBranchBatchMappingRepository instituteBranchBatchMappingRepository;

    @Autowired
    private InstituteBranchRepository instituteBranchRepository;

    @Autowired
    private InstituteBatchRepository instituteBatchRepository;

    @GetMapping(value = "instituteBranchBatchMapping/get", headers = "Accept=application/json")
    public List<InstituteBranchBatchMapping> getAllBranchBatchMappings() {
        List<InstituteBranchBatchMapping> allInstituteBranchBatchMapping = instituteBranchBatchMappingRepository
                .findAll();
        return allInstituteBranchBatchMapping;
    }

    // @GetMapping(value = "instituteBranchBatchMapping/getbyBranchId/{id}", headers
    // = "Accept=application/json")
    // public List<InstituteBranchBatchMapping> getByBranchId(@PathVariable("id")
    // int instituteBranchId) {
    // List<InstituteBranchBatchMapping> instituteBranchBatchMapping =
    // instituteBranchBatchMappingRepository.findByInstituteBranch(instituteBranchId);
    // return instituteBranchBatchMapping;
    // }

    @PostMapping(value = "instituteBranchBatchMapping/update", headers = "Accept=application/json")
    public List<InstituteBranchBatchMapping> updateInstituteDetail(@RequestBody Map<String, InstituteBatch> inputData) {
        InstituteBatch r = inputData.get("values");

        InstituteBatch rsaved = instituteBatchRepository.save(r);

        InstituteBranchBatchMapping allInstituteBranchBatchMapping = new InstituteBranchBatchMapping(
                rsaved.getBatchId(), r.getInstituteBranchIdDetails().get(0).getBranchId());

        List<InstituteBranchBatchMapping> inbbm = instituteBranchBatchMappingRepository
                .findByBranchId(rsaved.getBatchId());

        boolean flag = false;

        for (InstituteBranchBatchMapping ibh : inbbm) {
            if (ibh.getBatchId() == rsaved.getBatchId()) {
                flag = true;
                break;
            }
        }
        if (!flag) {
            inbbm.add(allInstituteBranchBatchMapping);
        }
        instituteBranchBatchMappingRepository.saveAll(inbbm);
        // instituteBranchBatchMappingRepository.save(allInstituteBranchBatchMapping);

        return inbbm;
    }

    @GetMapping(value = "instituteBranchBatchMapping/delete/{id}", headers = "Accept=application/json")
    public InstituteBranchBatchMapping deleteBatchBatch(@PathVariable("id") int branchId) {
        InstituteBranchBatchMapping branch = instituteBranchBatchMappingRepository.getOne(branchId);
        branch.setDisplay(false);
        InstituteBranchBatchMapping r = instituteBranchBatchMappingRepository.save(branch);
        return r;
    }

}