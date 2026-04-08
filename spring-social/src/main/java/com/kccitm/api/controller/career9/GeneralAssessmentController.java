package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import com.kccitm.api.service.GeneralAssessmentExportService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.kccitm.api.model.career9.GeneralAssessmentResult;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.Career9.GeneralAssessmentResultRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.GeneralAssessmentProcessingService;

@RestController
@RequestMapping("/general-assessment")
public class GeneralAssessmentController {

    private static final Logger logger = LoggerFactory.getLogger(GeneralAssessmentController.class);

    @Autowired
    private GeneralAssessmentProcessingService processingService;

    @Autowired
    private GeneralAssessmentResultRepository resultRepository;

    @Autowired
    private StudentAssessmentMappingRepository mappingRepository;

    @Autowired
    private GeneralAssessmentExportService exportService;

    /**
     * Process a single student's general assessment.
     * Runs the full pipeline and stores the result.
     */
    @PostMapping("/process/{userStudentId}/{assessmentId}")
    public ResponseEntity<?> processStudent(
            @PathVariable Long userStudentId,
            @PathVariable Long assessmentId) {
        GeneralAssessmentResult result = processingService.processStudent(userStudentId, assessmentId);
        return ResponseEntity.ok(result);
    }

    /**
     * Process all students in a given assessment (batch).
     */
    @PostMapping("/process-batch/{assessmentId}")
    public ResponseEntity<?> processBatch(@PathVariable Long assessmentId) {
        List<StudentAssessmentMapping> mappings = mappingRepository.findAllByAssessmentId(assessmentId);
        List<Map<String, Object>> results = new ArrayList<>();
        int success = 0;
        int failed = 0;

        for (StudentAssessmentMapping mapping : mappings) {
            try {
                Long studentId = mapping.getUserStudent().getUserStudentId();
                processingService.processStudent(studentId, assessmentId);
                Map<String, Object> r = new HashMap<>();
                r.put("userStudentId", studentId);
                r.put("status", "success");
                results.add(r);
                success++;
            } catch (Exception e) {
                Map<String, Object> r = new HashMap<>();
                r.put("userStudentId", mapping.getUserStudent().getUserStudentId());
                r.put("status", "failed");
                r.put("error", e.getMessage());
                results.add(r);
                failed++;
                logger.warn("Failed to process student {}: {}", mapping.getUserStudent().getUserStudentId(), e.getMessage());
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("assessmentId", assessmentId);
        response.put("totalStudents", mappings.size());
        response.put("success", success);
        response.put("failed", failed);
        response.put("details", results);
        return ResponseEntity.ok(response);
    }

    /**
     * Get dashboard data for a student's general assessment.
     * Simple DB read — no computation.
     */
    @GetMapping("/dashboard/{userStudentId}/{assessmentId}")
    public ResponseEntity<?> getDashboard(
            @PathVariable Long userStudentId,
            @PathVariable Long assessmentId) {
        Optional<GeneralAssessmentResult> result = resultRepository
                .findByUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        if (result.isPresent()) {
            return ResponseEntity.ok(result.get());
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "No processed result found. Run /process first."));
        }
    }

    /**
     * Check if a processed result exists for a student-assessment.
     */
    @GetMapping("/status/{userStudentId}/{assessmentId}")
    public ResponseEntity<?> getStatus(
            @PathVariable Long userStudentId,
            @PathVariable Long assessmentId) {
        Optional<GeneralAssessmentResult> result = resultRepository
                .findByUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        Map<String, Object> response = new HashMap<>();
        response.put("processed", result.isPresent());
        if (result.isPresent()) {
            response.put("processedAt", result.get().getProcessedAt());
            response.put("eligibilityStatus", result.get().getEligibilityStatus());
        }
        return ResponseEntity.ok(response);
    }

    /**
     * Get all processed results for an assessment.
     */
    @GetMapping("/results/{assessmentId}")
    public ResponseEntity<?> getResultsByAssessment(@PathVariable Long assessmentId) {
        List<GeneralAssessmentResult> results = resultRepository.findByAssessmentId(assessmentId);
        return ResponseEntity.ok(results);
    }

    /**
     * Export all completed student answers for a general assessment
     * in the old 167-column OMR format (Sec_A_1 through Sec_F_24).
     */
    @GetMapping("/export-excel/{assessmentId}")
    public ResponseEntity<?> exportExcel(@PathVariable Long assessmentId) throws Exception {
        byte[] excelBytes = exportService.exportToOldFormat(assessmentId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment",
                "general_assessment_" + assessmentId + ".xlsx");
        headers.setContentLength(excelBytes.length);

        return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
    }

    /**
     * Export a single student's answers in the old OMR format.
     */
    @GetMapping("/export-excel/{assessmentId}/student/{userStudentId}")
    public ResponseEntity<?> exportExcelForStudent(
            @PathVariable Long assessmentId,
            @PathVariable Long userStudentId) throws Exception {
        byte[] excelBytes = exportService.exportToOldFormat(assessmentId, userStudentId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment",
                "general_assessment_" + assessmentId + "_student_" + userStudentId + ".xlsx");
        headers.setContentLength(excelBytes.length);

        return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
    }
}
