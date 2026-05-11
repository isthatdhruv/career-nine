package com.kccitm.api.controller.career9.b2c;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.service.b2c.EntitlementService;
import com.kccitm.api.service.b2c.ReportPreparationService;
import com.kccitm.api.service.b2c.ReportPreparationService.PreparationResult;
import com.kccitm.api.service.b2c.ReportPreparationService.ReportPreparationException;

/**
 * Public endpoint that the assessment app calls right after a student
 * finishes the assessment, while showing the "Hold on, we're preparing
 * your detailed report" loading state. Validates the entitlement's
 * access token, then dispatches to the appropriate generator
 * (BET / Navigator) via {@link ReportPreparationService}.
 *
 * Path is kept under {@code /bet-report-data/public/} for client URL
 * parity — even though the dispatcher now serves multiple report types,
 * the assessment app only knows about one endpoint.
 */
@RestController
@RequestMapping("/bet-report-data/public")
public class ReportPreparationController {

    @Autowired private EntitlementService entitlementService;
    @Autowired private ReportPreparationService reportPreparationService;

    @PostMapping("/prepare")
    public ResponseEntity<?> prepareReport(@RequestParam("t") String token,
                                           @RequestParam("e") Long entitlementId,
                                           @RequestParam("assessmentId") Long assessmentId) {
        if (token == null || token.trim().isEmpty() || entitlementId == null || assessmentId == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("status", "failed", "message",
                            "token, entitlementId and assessmentId are required"));
        }

        StudentEntitlement entitlement = entitlementService.redeemAccessToken(token.trim(), entitlementId);
        if (entitlement == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "failed", "message", "Invalid or expired token"));
        }
        if (!Boolean.TRUE.equals(entitlement.getFinalReportActive())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("status", "failed", "message",
                            "Final report is not active for this entitlement"));
        }
        if (!assessmentId.equals(entitlement.getAssessmentId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("status", "failed", "message",
                            "assessmentId does not match entitlement"));
        }

        try {
            PreparationResult result = reportPreparationService.prepare(
                    entitlementId, assessmentId, "prepare");

            Map<String, Object> body = new HashMap<>();
            body.put("status", "ready");
            body.put("reportType", result.reportType);
            body.put("reportUrl", result.reportUrl);
            body.put("studentClassUsed", result.studentClassUsed);
            return ResponseEntity.ok(body);
        } catch (ReportPreparationException ex) {
            Map<String, Object> body = new HashMap<>();
            body.put("status", "failed");
            body.put("logId", ex.logId);
            body.put("reportType", ex.reportType);
            body.put("studentClassUsed", ex.studentClassUsed);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
        }
    }
}
