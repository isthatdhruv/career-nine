package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.school.SchoolSession;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.School.SchoolSessionRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

@RestController
@RequestMapping("/schoolSession")
public class SchoolSessionController {

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private SchoolSessionRepository schoolSessionRepository;

    @Autowired
    private SchoolClassesRepository schoolClassesRepository;

    @Autowired
    private SchoolSectionsRepository schoolSectionsRepository;

    @GetMapping("/getAll")
    public List<SchoolSession> getAll() {
        return schoolSessionRepository.findAll();
    }

    @PostMapping("/create")
    public List<SchoolSession> createSchoolSession(@RequestBody ArrayList<SchoolSession> payload) {
        // Wire up all relationships before saving
        for (SchoolSession session : payload) {
            // 1. Set institute relationship from instituteCode
            if (session.getInstituteCode() != null) {
                InstituteDetail institute = instituteDetailRepository.findById(session.getInstituteCode())
                    .orElseThrow(() -> new RuntimeException("Institute not found with code: " + session.getInstituteCode()));
                session.setInstitute(institute);
            }

            // 2. Wire up schoolClasses bidirectional relationship
            if (session.getSchoolClasses() != null) {
                for (SchoolClasses schoolClass : session.getSchoolClasses()) {
                    schoolClass.setSchoolSession(session);

                    // 3. Wire up schoolSections bidirectional relationship
                    if (schoolClass.getSchoolSections() != null) {
                        for (SchoolSections section : schoolClass.getSchoolSections()) {
                            section.setSchoolClass(schoolClass);
                        }
                    }
                }
            }
        }

        // Save all sessions with cascaded relationships
        return schoolSessionRepository.saveAll(payload);
    }

    // ============ SESSION CRUD ENDPOINTS ============

    @GetMapping("/getByInstituteCode/{instituteCode}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<SchoolSession>> getByInstituteCode(@PathVariable Integer instituteCode) {
        // Use the method that eagerly fetches nested classes
        List<SchoolSession> sessions = schoolSessionRepository.findByInstituteCodeWithClasses(instituteCode);

        // Force initialization of sections (lazy loaded)
        for (SchoolSession session : sessions) {
            if (session.getSchoolClasses() != null) {
                for (SchoolClasses schoolClass : session.getSchoolClasses()) {
                    if (schoolClass.getSchoolSections() != null) {
                        schoolClass.getSchoolSections().size(); // Force initialization
                    }
                }
            }
        }

        return ResponseEntity.ok(sessions);
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<SchoolSession> updateSession(@PathVariable Integer id, @RequestBody SchoolSession sessionUpdate) {
        Optional<SchoolSession> existingOpt = schoolSessionRepository.findById(id);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        SchoolSession existing = existingOpt.get();
        existing.setSessionYear(sessionUpdate.getSessionYear());

        SchoolSession updated = schoolSessionRepository.save(existing);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteSession(@PathVariable Integer id) {
        if (!schoolSessionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        schoolSessionRepository.deleteById(id);
        return ResponseEntity.ok("Session deleted successfully");
    }

    // ============ CLASS CRUD ENDPOINTS ============

    @PostMapping("/class/create")
    public ResponseEntity<SchoolClasses> createClass(@RequestBody SchoolClasses schoolClass) {
        // Wire up session relationship if sessionId is provided
        if (schoolClass.getSchoolSession() != null && schoolClass.getSchoolSession().getId() != null) {
            Optional<SchoolSession> sessionOpt = schoolSessionRepository.findById(schoolClass.getSchoolSession().getId());
            if (sessionOpt.isPresent()) {
                schoolClass.setSchoolSession(sessionOpt.get());
            }
        }

        // Wire up section relationships
        if (schoolClass.getSchoolSections() != null) {
            for (SchoolSections section : schoolClass.getSchoolSections()) {
                section.setSchoolClass(schoolClass);
            }
        }

        SchoolClasses saved = schoolClassesRepository.save(schoolClass);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/class/update/{id}")
    public ResponseEntity<SchoolClasses> updateClass(@PathVariable Integer id, @RequestBody SchoolClasses classUpdate) {
        Optional<SchoolClasses> existingOpt = schoolClassesRepository.findById(id);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        SchoolClasses existing = existingOpt.get();
        existing.setClassName(classUpdate.getClassName());

        SchoolClasses updated = schoolClassesRepository.save(existing);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/class/delete/{id}")
    public ResponseEntity<String> deleteClass(@PathVariable Integer id) {
        if (!schoolClassesRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        schoolClassesRepository.deleteById(id);
        return ResponseEntity.ok("Class deleted successfully");
    }

    // ============ SECTION CRUD ENDPOINTS ============

    @PostMapping("/section/create")
    public ResponseEntity<SchoolSections> createSection(@RequestBody SchoolSections section) {
        // Wire up class relationship if classId is provided
        if (section.getSchoolClasses() != null && section.getSchoolClasses().getId() != null) {
            Optional<SchoolClasses> classOpt = schoolClassesRepository.findById(section.getSchoolClasses().getId());
            if (classOpt.isPresent()) {
                section.setSchoolClass(classOpt.get());
            }
        }

        SchoolSections saved = schoolSectionsRepository.save(section);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/section/update/{id}")
    public ResponseEntity<SchoolSections> updateSection(@PathVariable Integer id, @RequestBody SchoolSections sectionUpdate) {
        Optional<SchoolSections> existingOpt = schoolSectionsRepository.findById(id);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        SchoolSections existing = existingOpt.get();
        existing.setSectionName(sectionUpdate.getSectionName());

        SchoolSections updated = schoolSectionsRepository.save(existing);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/section/delete/{id}")
    public ResponseEntity<String> deleteSection(@PathVariable Integer id) {
        if (!schoolSectionsRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        schoolSectionsRepository.deleteById(id);
        return ResponseEntity.ok("Section deleted successfully");
    }
}
