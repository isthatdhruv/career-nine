package com.kccitm.api.controller.dashboard;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.dashboard.DashboardService;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    /**
     * Get student basic information
     * GET /api/student/getbyid/{studentId}
     */
    @GetMapping("/student/getbyid/{studentId}")
    public ResponseEntity<?> getStudentBasicInfo(@PathVariable Long studentId) {
        try {
            Map<String, Object> studentInfo = dashboardService.getStudentBasicInfo(studentId);
            return ResponseEntity.ok(studentInfo);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("details", e.getClass().getName());
            return ResponseEntity.status(404).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("stackTrace", e.toString());
            e.printStackTrace();
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get cognitive game results (Attention, Working Memory, Cognitive Flexibility)
     * GET /api/game-results/{studentId}?assessmentId={assessmentId}
     */
    @GetMapping("/game-results/{studentId}")
    public ResponseEntity<?> getGameResults(
            @PathVariable Long studentId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long assessmentId) {
        try {
            Map<String, Object> gameResults = dashboardService.getGameResults(studentId, assessmentId);
            return ResponseEntity.ok(gameResults);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get assessment scores (Social Insight, Values, Environmental Awareness)
     * GET /api/assessment-scores/{studentId}?assessmentId={assessmentId}
     */
    @GetMapping("/assessment-scores/{studentId}")
    public ResponseEntity<?> getAssessmentScores(
            @PathVariable Long studentId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long assessmentId) {
        try {
            Map<String, Object> assessmentScores = dashboardService.getAssessmentScores(studentId, assessmentId);
            return ResponseEntity.ok(assessmentScores);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get self-management data (Self-Efficacy, Emotional Regulation, Self-Regulation)
     * GET /api/self-management/{studentId}?assessmentId={assessmentId}
     */
    @GetMapping("/self-management/{studentId}")
    public ResponseEntity<?> getSelfManagement(
            @PathVariable Long studentId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long assessmentId) {
        try {
            Map<String, Object> selfManagement = dashboardService.getSelfManagement(studentId, assessmentId);
            return ResponseEntity.ok(selfManagement);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get complete dashboard data (all sections combined)
     * GET /api/dashboard/{studentId}
     */
    @GetMapping("/dashboard/{studentId}")
    public ResponseEntity<?> getCompleteDashboard(@PathVariable Long studentId,@RequestParam Long assessmentId) {
        try {
            Map<String, Object> dashboard = new HashMap<>();
            dashboard.put("student", dashboardService.getStudentBasicInfo(studentId));
            dashboard.put("cognitive", dashboardService.getGameResults(studentId, assessmentId));
            dashboard.put("social", dashboardService.getAssessmentScores(studentId,assessmentId));
            dashboard.put("selfManagement", dashboardService.getSelfManagement(studentId,assessmentId));

            return ResponseEntity.ok(dashboard);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
}
