package com.kccitm.api.controller.teacher;

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

import com.kccitm.api.service.teacher.ClassTeacherDashboardService;

@RestController
@RequestMapping("/teacher/dashboard")
public class ClassTeacherDashboardController {

    @Autowired
    private ClassTeacherDashboardService dashboardService;

    /**
     * Get class overview statistics
     * GET /api/teacher/dashboard/class-overview/{teacherId}
     */
    @GetMapping("/class-overview/{teacherId}")
    public ResponseEntity<?> getClassOverview(@PathVariable Long teacherId) {
        try {
            Map<String, Object> overview = dashboardService.getClassOverview(teacherId);
            return ResponseEntity.ok(overview);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get student performance summary
     * GET /api/teacher/dashboard/student-performance/{teacherId}
     */
    @GetMapping("/student-performance/{teacherId}")
    public ResponseEntity<?> getStudentPerformance(
            @PathVariable Long teacherId,
            @RequestParam(required = false) Long assessmentId) {
        try {
            Map<String, Object> performance = dashboardService.getStudentPerformance(teacherId, assessmentId);
            return ResponseEntity.ok(performance);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get assessment completion rates
     * GET /api/teacher/dashboard/assessment-completion/{teacherId}
     */
    @GetMapping("/assessment-completion/{teacherId}")
    public ResponseEntity<?> getAssessmentCompletion(@PathVariable Long teacherId) {
        try {
            Map<String, Object> completion = dashboardService.getAssessmentCompletion(teacherId);
            return ResponseEntity.ok(completion);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get class cognitive development trends
     * GET /api/teacher/dashboard/cognitive-trends/{teacherId}
     */
    @GetMapping("/cognitive-trends/{teacherId}")
    public ResponseEntity<?> getCognitiveTrends(@PathVariable Long teacherId) {
        try {
            Map<String, Object> trends = dashboardService.getCognitiveTrends(teacherId);
            return ResponseEntity.ok(trends);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get complete class teacher dashboard data
     * GET /api/teacher/dashboard/complete/{teacherId}
     */
    @GetMapping("/complete/{teacherId}")
    public ResponseEntity<?> getCompleteDashboard(
            @PathVariable Long teacherId,
            @RequestParam(required = false) Long assessmentId) {
        try {
            Map<String, Object> dashboard = new HashMap<>();
            dashboard.put("overview", dashboardService.getClassOverview(teacherId));
            dashboard.put("studentPerformance", dashboardService.getStudentPerformance(teacherId, assessmentId));
            dashboard.put("assessmentCompletion", dashboardService.getAssessmentCompletion(teacherId));
            dashboard.put("cognitiveTrends", dashboardService.getCognitiveTrends(teacherId));

            return ResponseEntity.ok(dashboard);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get all assessments list
     * GET /api/teacher/dashboard/assessments
     */
    @GetMapping("/assessments")
    public ResponseEntity<?> getAllAssessments() {
        try {
            List<Map<String, Object>> assessments = dashboardService.getAllAssessments();
            return ResponseEntity.ok(assessments);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
}
