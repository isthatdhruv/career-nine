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

import com.kccitm.api.model.InstituteCourse;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

@RestController
public class InstituteCourseController {

	@Autowired
	private InstituteCourseRepository instituteCourseRepository;

	@Autowired
	private InstituteDetailRepository instituteDetailRepository;

	@GetMapping(value = "instituteCourse/get", headers = "Accept=application/json")
	public List<InstituteCourse> getallInstituteCourse() {
		List<InstituteCourse> allInstituteCourse = instituteCourseRepository.findAll();
		return allInstituteCourse;
	}


	@GetMapping(value = "instituteCourse/get-options", headers = "Accept=application/json")
	public List<InstituteCourse> getallInstituteCourseOptions() {
		List<InstituteCourse> allInstituteCourse = instituteCourseRepository.findOnlyCourseCodeAndAbbCourses();
		return allInstituteCourse;
	}


	@GetMapping(value = "instituteCourse/getbyid/{id}", headers = "Accept=application/json")
	public Optional<InstituteCourse> getById(@PathVariable("id") int instituteCourseId) {
		Optional<InstituteCourse> instituteCourse = instituteCourseRepository.findById(instituteCourseId);
		
		return instituteCourse;
	}

	@GetMapping(value = "instituteCourse/getbyCollegeId/{id}", headers = "Accept=application/json")
	public List<InstituteCourse> getByCollegeId(@PathVariable("id") int instituteCollegeId) {
		return instituteCourseRepository.findByInstituteId(instituteCollegeId);
	}



	@PostMapping(value = "instituteCourse/update", headers = "Accept=application/json")
	public InstituteCourse updateInstituteCourse(@RequestBody Map<String, InstituteCourse> inputData) {
		InstituteCourse r = inputData.get("values"); 
		instituteCourseRepository.save(r);
		return instituteCourseRepository.findByCourseName(r.getCourseName());
	}


	@GetMapping(value = "instituteCourse/delete/{id}", headers = "Accept=application/json")
	public InstituteCourse deleteUser(@PathVariable("id") int instituteCourseId) {
		InstituteCourse instituteCourse = instituteCourseRepository.getOne(instituteCourseId);
		instituteCourse.setDisplay(false);
		InstituteCourse r = instituteCourseRepository.save(instituteCourse);
		return r;
	}
}