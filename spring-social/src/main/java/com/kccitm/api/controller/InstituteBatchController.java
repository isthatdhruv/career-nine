package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.InstituteBatch;
import com.kccitm.api.model.InstituteBranch;
import com.kccitm.api.model.InstituteBranchBatchMapping;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;

@RestController
public class InstituteBatchController {

	@Autowired
	private InstituteBatchRepository instituteBatchRepository;

	@Autowired
	private InstituteBranchRepository instituteBranchRepository;

	@Autowired
	private InstituteBranchBatchMappingRepository instituteBranchBatchMappingRepository;

	@GetMapping(value = "instituteBatch/get", headers = "Accept=application/json")
	public List<InstituteBatch> getallInstituteBatch() {
		List<InstituteBatch> allInstitutbatch = instituteBatchRepository.findAll();
		for (InstituteBatch ib : allInstitutbatch) {
			List<InstituteBranchBatchMapping> branches = instituteBranchBatchMappingRepository
					.findByBatchId(ib.getBatchId());
			List<InstituteBranch> ibranch = new ArrayList<>();
			for (InstituteBranchBatchMapping brn : branches) {
				List<InstituteBranch> branchesTemp = new ArrayList<>(null);
				branchesTemp.add(instituteBranchRepository.findById(brn.getBranchId()));
				ib.setInstituteBranchIdDetails(branchesTemp);
				ibranch.add(instituteBranchRepository.findById(brn.getBranchId()));
				break;
			}

		}
		return allInstitutbatch;
	}

	@GetMapping(value = "instituteBatch/getbyid/{id}", headers = "Accept=application/json")
	public InstituteBatch getInstituteBatchById(@PathVariable("id") int instituteBatchId) {
		InstituteBatch instituteBatch = instituteBatchRepository.findById(instituteBatchId);
		return instituteBatch;
	}

	@PostMapping(value = "instituteBatch/update", headers = "Accept=application/json")
	public List<InstituteBatch> updateInstituteBatch(@RequestBody Map<String, InstituteBatch> inputData) {
		InstituteBatch r = inputData.get("values");
		instituteBatchRepository.save(r);
		return instituteBatchRepository.findByBatchId(r.getBatchId());
	}

	@GetMapping(value = "instituteBatch/delete/{id}", headers = "Accept=application/json")
	public InstituteBatch deleteUser(@PathVariable("id") int instituteBatchId) {
		InstituteBatch instituteBatch = instituteBatchRepository.getOne(instituteBatchId);
		instituteBatch.setDisplay(false);
		InstituteBatch r = instituteBatchRepository.save(instituteBatch);
		return r;
	}
}