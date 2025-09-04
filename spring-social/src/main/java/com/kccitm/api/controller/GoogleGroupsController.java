package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.InstituteBatchGoogleGroup;
import com.kccitm.api.model.InstituteBranchGoogleGroup;
import com.kccitm.api.model.InstituteCourseGoogleGroup;
import com.kccitm.api.model.InstituteSessionGoogleGroup;
import com.kccitm.api.model.SectionGoogleGroup;
import com.kccitm.api.repository.InstituteBatchGoogleGroupRepository;
import com.kccitm.api.repository.InstituteBranchGoogleGroupRepository;
import com.kccitm.api.repository.InstituteCourseGoogleGroupRepository;
import com.kccitm.api.repository.InstituteSessionGoogleGroupRepository;
import com.kccitm.api.repository.SectionGoogleGroupRepository;



@RestController
public class GoogleGroupsController {
    @Autowired
	private InstituteBatchGoogleGroupRepository instituteBatchGoogleGroupRepository;

    @Autowired
	private InstituteCourseGoogleGroupRepository instituteCourseGoogleGroupRepository;

    @Autowired
	private InstituteSessionGoogleGroupRepository instituteSessionGoogleGroupRepository;

	@Autowired
	private InstituteBranchGoogleGroupRepository instituteBranchGoogleGroupRepository;

    @Autowired
	private SectionGoogleGroupRepository sectionGoogleGroupRepository;

	
    
    @PostMapping(value = "batch-group/update", headers = "Accept=application/json")
	public List<InstituteBatchGoogleGroup> updateInstituteBatchGoogleGroup(@RequestBody Map<String, InstituteBatchGoogleGroup> instituteBatchGoogleGroup) {
		InstituteBatchGoogleGroup r = instituteBatchGoogleGroup.get("values");
		instituteBatchGoogleGroupRepository.save(r);
		return instituteBatchGoogleGroupRepository.findByName(r.getName());
	}

	@GetMapping(value = "batch-group/getbyid/{id}", headers = "Accept=application/json")
	public InstituteBatchGoogleGroup getById(@PathVariable("id") int instituteCourseId) {
		InstituteBatchGoogleGroup instituteCourse = instituteBatchGoogleGroupRepository.findById(instituteCourseId);
		
		return instituteCourse;
	}

    @PostMapping(value = "course-group/update", headers = "Accept=application/json")
	public List<InstituteCourseGoogleGroup> updateInstituteCourseGoogleGroup(@RequestBody Map<String, InstituteCourseGoogleGroup> instituteCourseGoogleGroup) {
		InstituteCourseGoogleGroup r = instituteCourseGoogleGroup.get("values");
		instituteCourseGoogleGroupRepository.save(r);
		return instituteCourseGoogleGroupRepository.findByName(r.getName());
	}

    @PostMapping(value = "session-group/update", headers = "Accept=application/json")
	public List<InstituteSessionGoogleGroup> updateInstituteSessionGoogleGroup(@RequestBody Map<String, InstituteSessionGoogleGroup> instituteSessionGoogleGroup) {
		InstituteSessionGoogleGroup r = instituteSessionGoogleGroup.get("values");
		instituteSessionGoogleGroupRepository.save(r);
		return instituteSessionGoogleGroupRepository.findByName(r.getName());
	}

    @PostMapping(value = "section-group/update", headers = "Accept=application/json")
	public List<SectionGoogleGroup> updateSectionGoogleGroup(@RequestBody Map<String, SectionGoogleGroup> sectionGoogleGroup) {
		SectionGoogleGroup r = sectionGoogleGroup.get("values");
		sectionGoogleGroupRepository.save(r);
		return sectionGoogleGroupRepository.findByName(r.getName());
	}

	@PostMapping(value = "branch-group/update", headers = "Accept=application/json")
	public List<InstituteBranchGoogleGroup> updateBranchGoogleGroup(@RequestBody Map<String, InstituteBranchGoogleGroup> branchGoogleGroup) {
		InstituteBranchGoogleGroup r = branchGoogleGroup.get("values");
		instituteBranchGoogleGroupRepository.save(r);
		return instituteBranchGoogleGroupRepository.findByName(r.getName());
	}

	
}
