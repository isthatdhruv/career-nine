package com.kccitm.api.controller.dashboard;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.dashboard.insight.InsightDashboard;
import com.kccitm.api.service.dashboard.insight.InsightDashboardService;
import com.kccitm.api.service.dashboard.insight.InsightDashboardService.NoReportException;
import com.kccitm.api.service.dashboard.insight.InsightDashboardService.ScoresNotReadyException;

/**
 * Serves the per-student assessment Insight Dashboard ({@link InsightDashboard}).
 * Backs the admin "Dashboard" button on the group-student listing and the
 * student-facing portal. The engine is resolved from the student's generated
 * report, so the caller need only supply the student (and optionally a specific
 * assessment).
 */
@RestController
@RequestMapping("/dashboard/insight")
public class InsightDashboardController {

    private static final Logger logger = LoggerFactory.getLogger(InsightDashboardController.class);

    @Autowired private InsightDashboardService insightDashboardService;
    @Autowired private UserStudentRepository userStudentRepository;

    /**
     * GET /dashboard/insight/me?assessmentId=...
     *
     * <p>Student self-service: resolves the caller's own student id from their JWT
     * and returns their dashboard with the "student" audience (entitlement gate
     * applied; locked views are trimmed to a teaser). Only requires authentication
     * — a student can only ever see their own data, never another student's.
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyInsight(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long assessmentId) {
        if (principal == null || principal.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "unauthenticated", "error", "No authenticated user."));
        }
        UserStudent self = userStudentRepository.getByUserId(principal.getId()).orElse(null);
        if (self == null || self.getUserStudentId() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("status", "not_a_student", "error", "This account is not a student."));
        }
        return buildResponse(self.getUserStudentId(), assessmentId, "student");
    }

    /**
     * GET /dashboard/insight/{userStudentId}?assessmentId=...
     *
     * <p>Returns the typed-widget dashboard contract for the student. When
     * {@code assessmentId} is omitted, the most recently generated report is used.
     */
    @GetMapping("/{userStudentId}")
    @PreAuthorize("@auth.allows('generated_report.read', @auth.instituteOfStudent(#userStudentId))")
    public ResponseEntity<?> getInsight(
            @PathVariable Long userStudentId,
            @RequestParam(required = false) Long assessmentId,
            @RequestParam(defaultValue = "admin") String audience) {
        return buildResponse(userStudentId, assessmentId, audience);
    }

    private ResponseEntity<?> buildResponse(Long userStudentId, Long assessmentId, String audience) {
        try {
            InsightDashboard dashboard =
                    insightDashboardService.buildForStudent(userStudentId, assessmentId, audience);
            return ResponseEntity.ok(dashboard);
        } catch (NoReportException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("status", "no_report", "error", e.getMessage()));
        } catch (ScoresNotReadyException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "not_ready", "error", e.getMessage()));
        } catch (UnsupportedOperationException e) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                    .body(Map.of("status", "unsupported", "error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Insight dashboard build failed for student={} assessment={}",
                    userStudentId, assessmentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "failed", "error", String.valueOf(e.getMessage())));
        }
    }
}
