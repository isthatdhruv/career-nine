package com.kccitm.api.controller.career9;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.AssessmentSessionService;

/**
 * Lightweight heartbeat endpoint for the assessment app.
 * Students send their current page/question position every ~30s.
 * Data is stored in Redis with 60s TTL — no DB writes.
 */
@RestController
@RequestMapping("/assessments")
public class HeartbeatController {

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    @PostMapping("/heartbeat")
    public ResponseEntity<Void> heartbeat(@RequestBody Map<String, Object> body) {
        Long studentId = toLong(body.get("userStudentId"));
        Long assessmentId = toLong(body.get("assessmentId"));

        if (studentId == null || assessmentId == null) {
            return ResponseEntity.badRequest().build();
        }

        // Extract position info (page, sectionId, questionIndex, sectionName)
        // and store in Redis with auto-expiry
        body.remove("userStudentId");
        body.remove("assessmentId");
        assessmentSessionService.saveHeartbeat(studentId, assessmentId, body);

        return ResponseEntity.ok().build();
    }

    private Long toLong(Object val) {
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).longValue();
        try {
            return Long.parseLong(val.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
