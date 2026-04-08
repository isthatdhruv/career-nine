package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;
import com.kccitm.api.service.counselling.StudentCounsellorMappingService;

@RestController
@RequestMapping("/api/student-counsellor-mapping")
public class StudentCounsellorMappingController {

    private static final Logger logger = LoggerFactory.getLogger(StudentCounsellorMappingController.class);

    @Autowired
    private StudentCounsellorMappingService mappingService;

    @PostMapping("/assign")
    public ResponseEntity<?> assign(@RequestBody Map<String, Object> body) {
        Long studentId = Long.valueOf(body.get("studentId").toString());
        Long counsellorId = Long.valueOf(body.get("counsellorId").toString());
        Long adminUserId = body.get("adminUserId") != null ? Long.valueOf(body.get("adminUserId").toString()) : null;
        String notes = body.get("notes") != null ? body.get("notes").toString() : null;

        logger.info("Assign request: student={}, counsellor={}, admin={}", studentId, counsellorId, adminUserId);
        try {
            StudentCounsellorMapping mapping = mappingService.assignStudentToCounsellor(studentId, counsellorId, adminUserId, notes);
            return ResponseEntity.ok(mapping);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<StudentCounsellorMapping>> getStudentsForCounsellor(@PathVariable Long counsellorId) {
        logger.debug("Fetching students for counsellor {}", counsellorId);
        return ResponseEntity.ok(mappingService.getStudentsForCounsellor(counsellorId));
    }

    @GetMapping("/by-student/{studentId}")
    public ResponseEntity<List<StudentCounsellorMapping>> getCounsellorsForStudent(@PathVariable Long studentId) {
        logger.debug("Fetching counsellors for student {}", studentId);
        return ResponseEntity.ok(mappingService.getCounsellorsForStudent(studentId));
    }

    @GetMapping("/getAll")
    public ResponseEntity<List<StudentCounsellorMapping>> getAllActiveMappings() {
        return ResponseEntity.ok(mappingService.getAllActiveMappings());
    }

    @PutMapping("/deactivate/{id}")
    public ResponseEntity<?> deactivateMapping(@PathVariable Long id) {
        logger.info("Deactivating mapping with id {}", id);
        mappingService.deactivateMapping(id);
        return ResponseEntity.ok("Mapping deactivated successfully");
    }

    @PostMapping("/bulk-assign")
    public ResponseEntity<List<StudentCounsellorMapping>> bulkAssign(@RequestBody Map<String, Object> body) {
        Long counsellorId = Long.valueOf(body.get("counsellorId").toString());
        Long adminUserId = body.get("adminUserId") != null ? Long.valueOf(body.get("adminUserId").toString()) : null;

        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) body.get("studentIds");
        List<Long> studentIds = rawIds.stream()
                .map(id -> Long.valueOf(id.toString()))
                .collect(java.util.stream.Collectors.toList());

        logger.info("Bulk assign request: {} students to counsellor {}, admin={}", studentIds.size(), counsellorId, adminUserId);
        return ResponseEntity.ok(mappingService.bulkAssign(counsellorId, studentIds, adminUserId));
    }
}
