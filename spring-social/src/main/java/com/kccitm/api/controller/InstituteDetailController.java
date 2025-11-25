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
	

	// @PostMapping(value = "/update", consumes = "application/json", produces = "application/json")
	// public ResponseEntity<?> updateInstituteDetail(@RequestBody InstituteDetail instituteDetail) {
	// 	if (instituteDetail == null) {
	// 		return ResponseEntity.badRequest().body("Empty request body");
	// 	}
	// 	try {
	// 		InstituteDetail saved = instituteDetailRepository.save(instituteDetail);
	// 		// If you have a method findByInstituteName returning List
	// 		List<InstituteDetail> found = instituteDetailRepository.findByInstituteName(saved.getInstituteName());
	// 		return ResponseEntity.ok(found);
	// 	} catch (Exception ex) {
	// 		// log the exception (use logger in real app)
	// 		ex.printStackTrace();
	// 		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
	// 							.body("Error saving institute: " + ex.getMessage());
	// 	}
	// }

	// @PostMapping(value = "instituteDetail/update", headers =
	// "Accept=application/json")
	// public List<InstituteDetail> updateInstituteDetail(@RequestBody
	// InstituteDetail instituteDetail) {
	// instituteDetailRepository.save(instituteDetail);
	// return
	// instituteDetailRepository.findByInstituteName(instituteDetail.getInstituteName());
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
	@PostMapping(value = "/update", consumes = "application/json", produces = "application/json")
	public ResponseEntity<?> updateInstituteDetail(@RequestBody Map<String, Object> payload) {
		try {
			if (payload == null || payload.isEmpty()) {
				return ResponseEntity.badRequest().body("Empty request body");
			}

			ObjectMapper mapper = new ObjectMapper();
			mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

			InstituteDetail instituteDetail;

			// If the client sends { "values": { ... } } or sends InstituteDetail fields at top-level
			if (payload.containsKey("values")) {
				Object valuesObj = payload.get("values");
				instituteDetail = mapper.convertValue(valuesObj, InstituteDetail.class);
			} else {
				instituteDetail = mapper.convertValue(payload, InstituteDetail.class);
			}

			if (instituteDetail == null) {
				return ResponseEntity.badRequest().body("Unable to parse InstituteDetail from request");
			}

			InstituteDetail saved = instituteDetailRepository.save(instituteDetail);
			List<InstituteDetail> found = instituteDetailRepository.findByInstituteName(saved.getInstituteName());
			return ResponseEntity.ok(found);

		} catch (IllegalArgumentException iae) {
			iae.printStackTrace();
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Bad request: " + iae.getMessage());
		} catch (Exception ex) {
			ex.printStackTrace();
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
								.body("Error saving institute: " + ex.getMessage());
		}
	}



}
