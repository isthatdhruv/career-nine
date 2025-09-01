package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.InstituteSession;
import com.kccitm.api.repository.InstituteSessionRepository;

@RestController
public class InstituteSessionController {

	@Autowired
	private InstituteSessionRepository instituteSessionRepository;


	@GetMapping(value = "instituteSession/get", headers = "Accept=application/json")
	public List<InstituteSession> getallInstituteSession() {
		List<InstituteSession> allInstitutsession = instituteSessionRepository.findAll();
		return allInstitutsession;
	}

    @GetMapping(value = "instituteSession/getbyid/{id}", headers = "Accept=application/json")
	public Optional<InstituteSession> getInstituteSessionById(@PathVariable("id") int instituteSessionId) {
		Optional<InstituteSession> instituteSession = instituteSessionRepository.findById(instituteSessionId);
		return instituteSession;
	}


	@GetMapping(value = "instituteSession/getbyBatchId/{id}", headers = "Accept=application/json")
	public List<InstituteSession> getByBatchId(@PathVariable("id") int instituteBranchId) {
		return instituteSessionRepository.findByBatchId(instituteBranchId);
	}


	@PostMapping(value = "instituteSession/update", headers = "Accept=application/json")
	public List<InstituteSession> updateInstituteSession(@RequestBody Map<String, InstituteSession> inputData) {
		InstituteSession r = inputData.get("values"); 
		instituteSessionRepository.save(r);
		return instituteSessionRepository.findBySessionId(r.getSessionId());
	}


	@GetMapping(value = "instituteSession/delete/{id}", headers = "Accept=application/json")
	public InstituteSession deleteUser(@PathVariable("id") int instituteSessionId) {
		InstituteSession instituteSession = instituteSessionRepository.getOne(instituteSessionId);
		instituteSession.setDisplay(false);
		InstituteSession r = instituteSessionRepository.save(instituteSession);
		return r;
	}
}