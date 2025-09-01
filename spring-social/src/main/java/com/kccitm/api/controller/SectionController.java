package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
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

    @GetMapping(value = "section/get", headers = "Accept=application/json")
	public List<Section> getAllSection() {
		List<Section> allSection = sectionRepository.findAll();
		return allSection;
	}

	@PostMapping(value = "section/update", headers = "Accept=application/json")
	public List<Section> updateSection(@RequestBody Map<String, Section> sectionName) {
		Section r = sectionName.get("values");
		sectionRepository.save(r);
		return sectionRepository.findByName(r.getName());
	}

	@GetMapping(value = "section/delete/{id}", headers = "Accept=application/json")
	public Section deleteSection(@PathVariable("id") int sectionId) {
		Section section = sectionRepository.getOne(sectionId);
		section.setDisplay(false);
		Section r = sectionRepository.save(section);
		return r;
	}


}
