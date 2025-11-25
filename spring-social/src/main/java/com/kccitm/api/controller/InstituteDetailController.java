package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.InstituteBranch;
import com.kccitm.api.model.InstituteBranchBatchMapping;
import com.kccitm.api.model.InstituteCourse;
import com.kccitm.api.model.InstituteDetail;
import com.kccitm.api.model.userDefinedModel.BatchBranchOption;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
	
@RestController
@RequestMapping("/instituteDetail")
public class InstituteDetailController {

	@Autowired
	private InstituteDetailRepository instituteDetailRepository;

	@Autowired
	private InstituteCourseRepository instituteCourseRepository;

	@Autowired
	private InstituteBranchRepository instituteBranchRepository;

	@Autowired
	private InstituteBranchBatchMappingRepository instituteBranchBatchMappingRepository;

	@Autowired
	private InstituteBatchRepository instituteBatchRepository;

	@GetMapping(value = "/get", headers = "Accept=application/json")
	public List<InstituteDetail> getallInstituteDetail() {
		List<InstituteDetail> allInstituteDetails = instituteDetailRepository.findAll();
		List<InstituteDetail> allInstituteDetailsNew = new ArrayList<InstituteDetail>();
		for (InstituteDetail IdNew : allInstituteDetails) {
			if (IdNew.getDisplay() != null && IdNew.getDisplay() == true) {
				// if (IdNew.getDisplay() == null) {
				allInstituteDetailsNew.add(IdNew);
			}
		}
		return allInstituteDetailsNew;
	}

	@GetMapping(value = "/getbyid/{id}", headers = "Accept=application/json")
	public InstituteDetail getInstituteDetailById(@PathVariable("id") int instituteDetailId) {
		InstituteDetail instituteDetail = instituteDetailRepository.findById(instituteDetailId);
		instituteDetail.setInstituteCourse(instituteCourseRepository.findByInstituteId(instituteDetailId));
		for (InstituteCourse ins : instituteDetail.getInstituteCourse()) {
			ins.setInstituteBranchs(instituteBranchRepository.findByCourseId(ins.getCourseCode()));
			for (InstituteBranch insb : ins.getInstituteBranchs()) {
				insb.setInstituteBranchBatchMapping(
						instituteBranchBatchMappingRepository.findByBranchId(insb.getBranchId()));
				for (InstituteBranchBatchMapping ibbm : insb.getInstituteBranchBatchMapping()) {
					ibbm.setInstituteBatch(instituteBatchRepository.findById(ibbm.getBatchId()));
				}
			}
		}
		return instituteDetail;
	}

	// @GetMapping(value = "/instituteBatchAndBranchDetail/getbyid/{id}", headers = "Accept=application/json")
	// public BatchBranchOption getInstituteBatchAndBranchById(@PathVariable("id") int instituteDetailId) {
	// 	InstituteDetail instituteDetail = instituteDetailRepository.findById(instituteDetailId);
	// 	instituteDetail.setInstituteCourse(instituteCourseRepository.findByInstituteId(instituteDetailId));
	// 	for (InstituteCourse ins : instituteDetail.getInstituteCourse()) {
	// 		ins.setInstituteBranchs(instituteBranchRepository.findByCourseId(ins.getCourseCode()));
	// 		for (InstituteBranch insb : ins.getInstituteBranchs()) {
	// 			insb.setInstituteBranchBatchMapping(
	// 					instituteBranchBatchMappingRepository.findByBranchId(insb.getBranchId()));
	// 			for (InstituteBranchBatchMapping ibbm : insb.getInstituteBranchBatchMapping()) {
	// 				ibbm.setInstituteBatch(instituteBatchRepository.findById(ibbm.getBatchId()));
	// 			}
	// 		}
	// 	}
	// 	BatchBranchOption bbo = new BatchBranchOption(instituteDetail);
	// 	return bbo;
	// }

	// @PostMapping(value = "/update", headers = "Accept=application/json")
	// public List<InstituteDetail> updateInstituteDetail(@RequestBody Map<String, InstituteDetail> inputData) {
	// 	InstituteDetail r = inputData.get("values");
	// 	instituteDetailRepository.save(r);
	// 	return instituteDetailRepository.findByInstituteName(r.getInstituteName());
	// }


	@GetMapping(value = "/delete/{id}", headers = "Accept=application/json")
	public InstituteDetail deleteUser(@PathVariable("id") int instituteDetailId) {
		InstituteDetail instituteDetail = instituteDetailRepository.getOne(instituteDetailId);
		instituteDetail.setDisplay(false);
		InstituteDetail r = instituteDetailRepository.save(instituteDetail);
		return r;
	}
	// @PostMapping(value = "/create", headers = "Accept=application/json")
	// public void createInstituteDetail(@RequestBody InstituteDetail instituteDetail) {
	// 	instituteDetailRepository.save(instituteDetail);
	// }

	//update
	@PostMapping(value = "/update", consumes = "application/json", produces = "application/json")
	public ResponseEntity<?> updateInstituteDetail(@RequestBody Map<String, Object> payload) {
		if (payload == null || payload.isEmpty()) {
			return ResponseEntity.badRequest().body("Empty request body");
		}

		ObjectMapper mapper = new ObjectMapper()
				.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

		Object toConvert = payload.containsKey("values") ? payload.get("values") : payload;
		InstituteDetail instituteDetail = mapper.convertValue(toConvert, InstituteDetail.class);

		InstituteDetail saved = instituteDetailRepository.save(instituteDetail);
		List<InstituteDetail> found = instituteDetailRepository.findByInstituteName(saved.getInstituteName());
		return ResponseEntity.ok(found);
	}




}
