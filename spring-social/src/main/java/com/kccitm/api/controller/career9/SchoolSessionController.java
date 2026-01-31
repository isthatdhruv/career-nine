package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.model.career9.school.SchoolSections;
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
    public ResponseEntity<SchoolSession> createSchoolSession(@RequestBody JsonNode payload) {
        try {
            JsonNode root = payload;
            if (payload.isArray()) {
                if (payload.size() == 0) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
                }
                root = payload.get(0);
            }
            if (!root.isObject()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }

            String sessionYear = root.path("sessionYear").asText(null);
            Integer instituteId = root.path("institute_code").isInt() ? root.path("institute_code").asInt() : null;
            JsonNode classesData = root.path("schoolClasses");
            if (sessionYear == null || instituteId == null || !classesData.isArray()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            InstituteDetail institute = instituteDetailRepository.findById(instituteId)
                    .orElseThrow(() -> new RuntimeException("Institute not found"));
            SchoolSession schoolSession = new SchoolSession();
            schoolSession.setSessionYear(sessionYear);
            schoolSession.setInstitute(institute);
            List<SchoolClasses> schoolClassesList = new ArrayList<>();
            for (JsonNode classData : classesData) {
                String className = classData.path("className").asText(null);
                JsonNode sectionsData = classData.path("schoolSections");
                if (className == null || !sectionsData.isArray()) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
                }
                SchoolClasses schoolClass = new SchoolClasses();
                schoolClass.setClassName(className);
                schoolClass.setSchoolSession(schoolSession);
                List<SchoolSections> schoolSectionsList = new ArrayList<>();
                for (JsonNode sectionData : sectionsData) {
                    String sectionName = sectionData.path("sectionName").asText(null);
                    if (sectionName == null) {
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
                    }
                    SchoolSections schoolSection = new SchoolSections();
                    schoolSection.setSectionName(sectionName);
                    schoolSection.setSchoolClass(schoolClass);
                    schoolSectionsList.add(schoolSection);
                }
                schoolClass.setSchoolSections(schoolSectionsList);
                schoolClassesList.add(schoolClass);
            }
            schoolSession.setSchoolClasses(schoolClassesList);
            schoolSessionRepository.save(schoolSession);
            return ResponseEntity.status(HttpStatus.CREATED).body(schoolSession);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
