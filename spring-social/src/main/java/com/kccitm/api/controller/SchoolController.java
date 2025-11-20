package com.kccitm.api.controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;
import com.kccitm.api.repository.SchoolRepository;
import com.kccitm.api.model.School;

@RestController
@RequestMapping("/school")
public class SchoolController {
    @Autowired
    private SchoolRepository schoolRepository;

    @GetMapping("/all")
    public List<School> getAllSchools() {
        return schoolRepository.findAll();
    }

    @PostMapping("/add")
    public School addSchool(@RequestBody School school) {
        return schoolRepository.save(school);
    }
}
