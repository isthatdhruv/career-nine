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
import com.kccitm.api.model.InstituteBranch;
import com.kccitm.api.model.InstituteBranchBatchMapping;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.InstituteCourseRepository;

@RestController
public class InstituteBranchController {

	@Autowired
	private InstituteBranchRepository instituteBranchRepository;


	@Autowired
	private InstituteCourseRepository instituteCourseRepository;

	@Autowired
	private InstituteBranchBatchMappingRepository instituteBranchBatchMappingRepository;

	@Autowired
	private InstituteBatchRepository instituteBatchRepository;

	@GetMapping(value = "instituteBranch/get", headers = "Accept=application/json")
	public List<InstituteBranch> getallInstituteBranch() {
		List<InstituteBranch> allInstituteBranch = instituteBranchRepository.findAll();
		for(InstituteBranch ib:allInstituteBranch){
			List<InstituteBranchBatchMapping> iibbmm =  instituteBranchBatchMappingRepository.findByBranchId(ib.getBranchId());
			for(InstituteBranchBatchMapping iibmm:iibbmm){
				iibmm.setInstituteBatch(instituteBatchRepository.findByBatchId(iibmm.getBatchId()).get(0));
			}
			ib.setInstituteBranchBatchMapping(iibbmm);
		}
		return allInstituteBranch;
	}

    @GetMapping(value = "instituteBranch/getbybranchid/{id}", headers = "Accept=application/json")
	public InstituteBranch getById(@PathVariable("id") int instituteBranchId) {
		InstituteBranch instituteBranch = instituteBranchRepository.findById(instituteBranchId);
		List<InstituteBranchBatchMapping> ibbm = instituteBranchBatchMappingRepository.findByBranchId(instituteBranchId);
		for(InstituteBranchBatchMapping ibm : ibbm){
			InstituteBatch ib =  instituteBatchRepository.findByBatchId(ibm.getBatchId()).get(0);
			ibm.setInstituteBatch(ib);
		}
		instituteBranch.setInstituteBranchBatchMapping(ibbm);
		
		return instituteBranch;
	}

	@GetMapping(value = "instituteBranch/getbyCourseId/{id}", headers = "Accept=application/json")
	public List<InstituteBranch> getByCourseId(@PathVariable("id") int instituteCourseId) {
		return instituteBranchRepository.findByCourseId(instituteCourseId);
	}


	@PostMapping(value = "instituteBranch/update", headers = "Accept=application/json")
	public List<InstituteBranch> updateInstituteBranch(@RequestBody Map<String, InstituteBranch> inputData) {
		InstituteBranch r = inputData.get("values"); 
		instituteBranchRepository.save(r);
		return instituteBranchRepository.findByBranchName(r.getBranchName());
	}


	@GetMapping(value = "instituteBranch/delete/{id}", headers = "Accept=application/json")
	public InstituteBranch deleteUser(@PathVariable("id") int instituteBranchId) {
		InstituteBranch instituteBranch = instituteBranchRepository.getOne(instituteBranchId);
		instituteBranch.setDisplay(false);
		InstituteBranch r = instituteBranchRepository.save(instituteBranch);
		return r;
	}
}