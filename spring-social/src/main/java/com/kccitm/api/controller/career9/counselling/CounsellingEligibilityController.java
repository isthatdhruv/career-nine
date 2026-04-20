package com.kccitm.api.controller.career9.counselling;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.counselling.CounsellingEligibilityService;

/**
 * Exposes a single endpoint that resolves which counselling track
 * a student belongs to (EVENT / PAID / REPORT / NO_ASSESSMENT).
 *
 * All CTA surfaces in the frontend call this endpoint to decide
 * what to render for the student.
 */
@RestController
@RequestMapping("/api/counselling")
public class CounsellingEligibilityController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingEligibilityController.class);

    @Autowired
    private CounsellingEligibilityService eligibilityService;

    /**
     * GET /api/counselling/eligibility/{studentId}
     *
     * Returns:
     * {
     *   "track": "EVENT" | "PAID" | "REPORT" | "NO_ASSESSMENT",
     *   "action": "BOOK_COUNSELLING" | "PAY_FOR_COUNSELLING" | "VIEW_REPORT" | "TAKE_ASSESSMENT",
     *   "payload": { ... track-specific data ... }
     * }
     */
    @GetMapping("/eligibility/{studentId}")
    public ResponseEntity<Map<String, Object>> getEligibility(@PathVariable("studentId") Long studentId) {
        logger.info("Resolving counselling eligibility for student {}", studentId);
        Map<String, Object> result = eligibilityService.resolveEligibility(studentId);
        return ResponseEntity.ok(result);
    }
}
