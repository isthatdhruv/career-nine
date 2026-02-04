package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.school.SchoolSession;
import com.kccitm.api.repository.Career9.School.SchoolSessionRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

@RestController
@RequestMapping("/schoolSession")
public class SchoolSessionController {

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private SchoolSessionRepository schoolSessionRepository;

    @GetMapping("/getAll")
    public List<SchoolSession> getAll() {
        return schoolSessionRepository.findAll();
    }

    @PostMapping("/create")
    public SchoolSession createSchoolSession(@RequestBody ArrayList<SchoolSession> payload) {
       
        schoolSessionRepository.saveAll(payload);
        return null;
    }
}
