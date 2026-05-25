package com.kccitm.api.controller.principal;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.principal.PrincipalDashboardService;

@RestController
@RequestMapping("/api/principal/dashboard")
public class PrincipalDashboardController {

    @Autowired
    private PrincipalDashboardService principalDashboardService;

    /**
     * Get complete dashboard data for principal
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/data/{principalId}")
    public ResponseEntity<Map<String, Object>> getDashboardData(
            @PathVariable Long principalId,
            @RequestParam(required = false) Long assessmentId) {
        Map<String, Object> dashboardData = new HashMap<>();

        // Fetch all dashboard sections
        dashboardData.put("overview", principalDashboardService.getInstituteOverview());
        dashboardData.put("assessmentPerformance", principalDashboardService.getAssessmentPerformance(assessmentId));
        dashboardData.put("classwisePerformance", principalDashboardService.getClasswisePerformance());
        dashboardData.put("teacherActivity", principalDashboardService.getTeacherActivity());
        dashboardData.put("enrollmentTrends", principalDashboardService.getEnrollmentTrends());

        return ResponseEntity.ok(dashboardData);
    }

    /**
     * Get institute overview only
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/overview/{principalId}")
    public ResponseEntity<Map<String, Object>> getOverview(@PathVariable Long principalId) {
        return ResponseEntity.ok(principalDashboardService.getInstituteOverview());
    }

    /**
     * Get assessment performance
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/assessment-performance/{principalId}")
    public ResponseEntity<Map<String, Object>> getAssessmentPerformance(
            @PathVariable Long principalId,
            @RequestParam(required = false) Long assessmentId) {
        return ResponseEntity.ok(principalDashboardService.getAssessmentPerformance(assessmentId));
    }

    /**
     * Get classwise performance
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/classwise-performance/{principalId}")
    public ResponseEntity<Map<String, Object>> getClasswisePerformance(@PathVariable Long principalId) {
        return ResponseEntity.ok(principalDashboardService.getClasswisePerformance());
    }

    /**
     * Get teacher activity
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/teacher-activity/{principalId}")
    public ResponseEntity<Map<String, Object>> getTeacherActivity(@PathVariable Long principalId) {
        return ResponseEntity.ok(principalDashboardService.getTeacherActivity());
    }

    /**
     * Get enrollment trends
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/enrollment-trends/{principalId}")
    public ResponseEntity<Map<String, Object>> getEnrollmentTrends(@PathVariable Long principalId) {
        return ResponseEntity.ok(principalDashboardService.getEnrollmentTrends());
    }

    /**
     * Get all assessments for dropdown
     */
    @PreAuthorize("@auth.allows('dashboard.principal.read')")
    @GetMapping("/assessments")
    public ResponseEntity<List<Map<String, Object>>> getAllAssessments() {
        return ResponseEntity.ok(principalDashboardService.getAllAssessments());
    }
}
