package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Section;
import com.kccitm.api.repository.SectionRepository;

@RestController
public class SectionController {

	@Autowired
	private SectionRepository sectionRepository;

    // no scope arg: catalog endpoint; scope-filter (Plan 15-06) will narrow result set
    @PreAuthorize("@auth.allows('section.read')")
    @GetMapping(value = "section/get", headers = "Accept=application/json")
	public List<Section> getAllSection() {
		List<Section> allSection = sectionRepository.findAll();
		return allSection;
	}

	// no scope arg: body is Map<String,Section>; SpEL cannot address nested map values
	@PreAuthorize("@auth.allows('section.write')")
	@PostMapping(value = "section/update", headers = "Accept=application/json")
	public List<Section> updateSection(@RequestBody Map<String, Section> sectionName) {
		Section r = sectionName.get("values");
		sectionRepository.save(r);
		return sectionRepository.findByName(r.getName());
	}

	// no scope arg: section soft-delete-by-id; PermissionCode enum has only section.read/.write
	// (no section.delete) — using section.write for mutating soft-delete is semantically correct
	@PreAuthorize("@auth.allows('section.write')")
	@GetMapping(value = "section/delete/{id}", headers = "Accept=application/json")
	public Section deleteSection(@PathVariable("id") int sectionId) {
		Section section = sectionRepository.getOne(sectionId);
		section.setDisplay(false);
		Section r = sectionRepository.save(section);
		return r;
	}


}
