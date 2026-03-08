package com.kccitm.api.controller.principal;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
    @GetMapping("/data/{principalId}")
    public ResponseEntity<Map<String, Object>> getDashboardData(
            @PathVariable Long principalId,
            @RequestParam(required = false) Long assessmentId) {
        try {
            Map<String, Object> dashboardData = new HashMap<>();

            // Fetch all dashboard sections
            dashboardData.put("overview", principalDashboardService.getInstituteOverview());
            dashboardData.put("assessmentPerformance", principalDashboardService.getAssessmentPerformance(assessmentId));
            dashboardData.put("classwisePerformance", principalDashboardService.getClasswisePerformance());
            dashboardData.put("teacherActivity", principalDashboardService.getTeacherActivity());
            dashboardData.put("enrollmentTrends", principalDashboardService.getEnrollmentTrends());

            return ResponseEntity.ok(dashboardData);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to fetch dashboard data: " + e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    /**
     * Get institute overview only
     */
    @GetMapping("/overview/{principalId}")
    public ResponseEntity<Map<String, Object>> getOverview(@PathVariable Long principalId) {
        try {
            return ResponseEntity.ok(principalDashboardService.getInstituteOverview());
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    /**
     * Get assessment performance
     */
    @GetMapping("/assessment-performance/{principalId}")
    public ResponseEntity<Map<String, Object>> getAssessmentPerformance(
            @PathVariable Long principalId,
            @RequestParam(required = false) Long assessmentId) {
        try {
            return ResponseEntity.ok(principalDashboardService.getAssessmentPerformance(assessmentId));
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    /**
     * Get classwise performance
     */
    @GetMapping("/classwise-performance/{principalId}")
    public ResponseEntity<Map<String, Object>> getClasswisePerformance(@PathVariable Long principalId) {
        try {
            return ResponseEntity.ok(principalDashboardService.getClasswisePerformance());
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    /**
     * Get teacher activity
     */
    @GetMapping("/teacher-activity/{principalId}")
    public ResponseEntity<Map<String, Object>> getTeacherActivity(@PathVariable Long principalId) {
        try {
            return ResponseEntity.ok(principalDashboardService.getTeacherActivity());
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    /**
     * Get enrollment trends
     */
    @GetMapping("/enrollment-trends/{principalId}")
    public ResponseEntity<Map<String, Object>> getEnrollmentTrends(@PathVariable Long principalId) {
        try {
            return ResponseEntity.ok(principalDashboardService.getEnrollmentTrends());
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    /**
     * Get all assessments for dropdown
     */
    @GetMapping("/assessments")
    public ResponseEntity<List<Map<String, Object>>> getAllAssessments() {
        try {
            return ResponseEntity.ok(principalDashboardService.getAllAssessments());
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}
