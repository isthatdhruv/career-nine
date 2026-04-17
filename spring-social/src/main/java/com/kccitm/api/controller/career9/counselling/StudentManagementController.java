package com.kccitm.api.controller.career9.counselling;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;

/**
 * Admin endpoints for the "Manage Students" page — list students by institute
 * and toggle per-student flags (counsellingAllowed, reportsVisible).
 */
@RestController
@RequestMapping("/api/student-management")
public class StudentManagementController {

    private static final Logger logger = LoggerFactory.getLogger(StudentManagementController.class);

    @Autowired
    private UserStudentRepository userStudentRepository;

    /** Get all students for an institute with their flags */
    @GetMapping("/by-institute/{instituteCode}")
    public ResponseEntity<List<Map<String, Object>>> getByInstitute(@PathVariable Integer instituteCode) {
        List<UserStudent> students = userStudentRepository.findByInstituteInstituteCode(instituteCode);

        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (UserStudent s : students) {
            Map<String, Object> row = new HashMap<>();
            row.put("userStudentId", s.getUserStudentId());
            row.put("userId", s.getUserId());
            row.put("counsellingAllowed", Boolean.TRUE.equals(s.getCounsellingAllowed()));
            row.put("reportsVisible", Boolean.TRUE.equals(s.getReportsVisible()));
            row.put("infoCompleted", Boolean.TRUE.equals(s.getInfoCompleted()));

            if (s.getStudentInfo() != null) {
                row.put("name", s.getStudentInfo().getName());
                row.put("grade", s.getStudentInfo().getStudentClass());
            }
            result.add(row);
        }
        return ResponseEntity.ok(result);
    }

    /** Toggle the counsellingAllowed flag for a student */
    @PutMapping("/counselling-allowed/{userStudentId}")
    public ResponseEntity<?> setCounsellingAllowed(
            @PathVariable Long userStudentId,
            @RequestBody Map<String, Object> body) {
        UserStudent student = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));
        boolean value = Boolean.TRUE.equals(body.get("value"));
        student.setCounsellingAllowed(value);
        userStudentRepository.save(student);
        logger.info("Set counsellingAllowed={} for student {}", value, userStudentId);
        return ResponseEntity.ok(Map.of("userStudentId", userStudentId, "counsellingAllowed", value));
    }

    /** Toggle the reportsVisible flag for a student */
    @PutMapping("/reports-visible/{userStudentId}")
    public ResponseEntity<?> setReportsVisible(
            @PathVariable Long userStudentId,
            @RequestBody Map<String, Object> body) {
        UserStudent student = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));
        boolean value = Boolean.TRUE.equals(body.get("value"));
        student.setReportsVisible(value);
        userStudentRepository.save(student);
        logger.info("Set reportsVisible={} for student {}", value, userStudentId);
        return ResponseEntity.ok(Map.of("userStudentId", userStudentId, "reportsVisible", value));
    }
}
