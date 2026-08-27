package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import com.kccitm.api.service.GeneralAssessmentExportService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.kccitm.api.model.career9.GeneralAssessmentResult;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.Career9.GeneralAssessmentResultRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.GeneralAssessmentProcessingService;
import com.kccitm.api.service.schoolreport.SchoolDashboard;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService;
import com.kccitm.api.service.schoolreport.SchoolDashboardWorkbookWriter;
import com.kccitm.api.service.schoolreport.SchoolReportService;

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

    @Autowired
    private com.kccitm.api.service.AssessmentDataExcelExportService dataExcelExportService;

    @Autowired
    private com.kccitm.api.service.BetTemplateExcelExportService betTemplateExcelExportService;

    @Autowired
    private com.kccitm.api.service.psychometric.PsychometricPropertiesExportService psychometricPropertiesExportService;

    @Autowired
    private SchoolDashboardDataService schoolDashboardDataService;

    @Autowired
    private SchoolReportService schoolReportService;

    @Autowired
    private SchoolDashboardWorkbookWriter schoolDashboardWorkbookWriter;

    /**
     * Process a single student's general assessment.
     * Runs the full pipeline and stores the result.
     */
    @PostMapping("/process/{userStudentId}/{assessmentId}")
    @PreAuthorize("@auth.allows('general_assessment.update', #userStudentId, #assessmentId)")
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
    @PreAuthorize("@auth.allows('general_assessment.update', #assessmentId)")
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
    @PreAuthorize("@auth.allows('general_assessment.read', #userStudentId, #assessmentId)")
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
    @PreAuthorize("@auth.allows('general_assessment.read', #userStudentId, #assessmentId)")
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
    @PreAuthorize("@auth.allows('general_assessment.read', #assessmentId)")
    public ResponseEntity<?> getResultsByAssessment(@PathVariable Long assessmentId) {
        List<GeneralAssessmentResult> results = resultRepository.findByAssessmentId(assessmentId);
        return ResponseEntity.ok(results);
    }

    /**
     * Export all completed student answers for a general assessment
     * in the old 167-column OMR format (Sec_A_1 through Sec_F_24).
     */
    @GetMapping("/export-excel/{assessmentId}")
    @PreAuthorize("@auth.allows('report.export', #assessmentId)")
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
     * "Generate Data Excel" — one row per student with registration-page data
     * (student info + demographic form) followed by one column per
     * questionnaire question holding the student's answer(s).
     *
     * Body: { "assessmentId": 18, "userStudentIds": [1, 2, 3] }
     * userStudentIds is optional — omitted/empty means all attempted students.
     */
    @PostMapping("/export-data-excel")
    @PreAuthorize("@auth.allows('report.export')")
    public ResponseEntity<?> exportDataExcel(@RequestBody Map<String, Object> request) throws Exception {
        Object rawAssessmentId = request.get("assessmentId");
        if (!(rawAssessmentId instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "assessmentId is required"));
        }
        Long assessmentId = ((Number) rawAssessmentId).longValue();

        List<Long> userStudentIds = null;
        Object rawIds = request.get("userStudentIds");
        if (rawIds instanceof List) {
            userStudentIds = new ArrayList<>();
            for (Object o : (List<?>) rawIds) {
                if (o instanceof Number) {
                    userStudentIds.add(((Number) o).longValue());
                }
            }
        }

        // BET assessments get the analyst's fixed "BET_ template" layout;
        // everything else keeps the generic dynamic export.
        byte[] excelBytes = betTemplateExcelExportService.exportIfBetTemplate(assessmentId, userStudentIds);
        if (excelBytes == null) {
            excelBytes = dataExcelExportService.exportStudentData(assessmentId, userStudentIds);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment",
                "assessment_data_" + assessmentId + ".xlsx");
        headers.setContentLength(excelBytes.length);

        return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
    }

    /**
     * "Psychometric Properties of Navigator 360" — the validation-study
     * workbook (reliability, EFA, item analysis, IRT, norms, CFA screening)
     * recomputed for the selected cohort in the original study's layout.
     *
     * Body: { "assessmentId": 18, "userStudentIds": [1, 2, 3] }
     * userStudentIds optional — omitted/empty means all attempted students.
     */
    @PostMapping("/export-psychometric-properties")
    @PreAuthorize("@auth.allows('report.export')")
    public ResponseEntity<?> exportPsychometricProperties(@RequestBody Map<String, Object> request)
            throws Exception {
        Object rawAssessmentId = request.get("assessmentId");
        if (!(rawAssessmentId instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "assessmentId is required"));
        }
        Long assessmentId = ((Number) rawAssessmentId).longValue();

        List<Long> userStudentIds = null;
        Object rawIds = request.get("userStudentIds");
        if (rawIds instanceof List) {
            userStudentIds = new ArrayList<>();
            for (Object o : (List<?>) rawIds) {
                if (o instanceof Number) {
                    userStudentIds.add(((Number) o).longValue());
                }
            }
        }

        byte[] excelBytes;
        try {
            excelBytes = psychometricPropertiesExportService.export(assessmentId, userStudentIds);
        } catch (IllegalArgumentException e) {
            // e.g. a BET assessment — none of the Navigator 360 sections exist
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        if (excelBytes == null) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "No scoreable students found for this assessment/selection"));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment",
                "psychometric_properties_navigator360_" + assessmentId + ".xlsx");
        headers.setContentLength(excelBytes.length);

        return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
    }

    /**
     * Export a single student's answers in the old OMR format.
     */
    @GetMapping("/export-excel/{assessmentId}/student/{userStudentId}")
    @PreAuthorize("@auth.allows('report.export', #assessmentId, #userStudentId)")
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

    /**
     * Export the combined legacy workbook for an assessment:
     * sheet "Raw Data" (old 167-column OMR answers) + sheet "Master Sheet"
     * (computed MI/aptitude/RIASEC scores + SOI/Values/Career Aspirations).
     *
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     * If userStudentIds is empty or absent, exports all students for the assessment.
     */
    @PostMapping("/export-combined-excel")
    @PreAuthorize("@auth.allows('report.export')")
    public ResponseEntity<?> exportCombinedExcel(@RequestBody Map<String, Object> request) throws Exception {
        if (request == null || !(request.get("assessmentId") instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "assessmentId is required"));
        }
        Long assessmentId = ((Number) request.get("assessmentId")).longValue();

        @SuppressWarnings("unchecked")
        List<Number> selectedIds = (List<Number>) request.get("userStudentIds");
        List<Long> userStudentIds = (selectedIds == null || selectedIds.isEmpty())
                ? null
                : selectedIds.stream().map(Number::longValue).collect(Collectors.toList());

        byte[] excelBytes = exportService.exportCombinedOldFormat(assessmentId, userStudentIds);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment",
                "general_assessment_" + assessmentId + "_raw_master.xlsx");
        headers.setContentLength(excelBytes.length);

        return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
    }

    /**
     * Export the Navigator360 school dashboard: the nine-sheet workbook
     * (paste data, summary, personality, learning style, abilities, values,
     * career gap, by class, charts) already filled in, so nobody has to paste a
     * Master Sheet into the template by hand.
     *
     * <p>Body: <code>{ "assessmentId": 123, "userStudentIds": [1, 2, 3],
     * "classFilter": "All" }</code>
     *
     * <p>{@code userStudentIds} carries whatever the Reports Hub's filters and
     * tick-boxes left in view; empty or absent means the whole assessment.
     * {@code classFilter} is sheet 2's own filter — "All", or a class number.
     */
    @PostMapping("/export-school-dashboard")
    @PreAuthorize("@auth.allows('report.export')")
    public ResponseEntity<?> exportSchoolDashboard(@RequestBody Map<String, Object> request) throws Exception {
        if (request == null || !(request.get("assessmentId") instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "assessmentId is required"));
        }
        Long assessmentId = ((Number) request.get("assessmentId")).longValue();

        @SuppressWarnings("unchecked")
        List<Number> selectedIds = (List<Number>) request.get("userStudentIds");
        List<Long> userStudentIds = (selectedIds == null || selectedIds.isEmpty())
                ? null
                : selectedIds.stream().map(Number::longValue).collect(Collectors.toList());

        SchoolDashboard.ClassFilter classFilter = parseClassFilter(request.get("classFilter"));

        List<SchoolReportService.PasteDataRow> rows =
                schoolDashboardDataService.loadRows(assessmentId, userStudentIds);
        if (rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "No students with a completed assessment in the current selection."));
        }
        SchoolDashboard dashboard = schoolReportService.calculateDashboard(rows, classFilter);
        byte[] excelBytes = schoolDashboardWorkbookWriter.write(dashboard);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment",
                "school_dashboard_" + assessmentId + ".xlsx");
        headers.setContentLength(excelBytes.length);

        return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
    }

    /**
     * School Dashboard page payload for one institute: assessment participation
     * across every assessment (the headline cards) plus the nine-sheet
     * Navigator360 dashboard scored from everyone who completed one.
     *
     * <p>Returns 200 with a null {@code dashboard} when the institute exists but
     * nobody has completed an assessment yet — the page still renders its
     * participation cards, which is the useful answer in that case.
     */
    @GetMapping("/school-dashboard/{instituteCode}")
    @PreAuthorize("@auth.allows('dashboard.school.read', #instituteCode)")
    public ResponseEntity<?> getSchoolDashboard(
            @PathVariable Integer instituteCode,
            @RequestParam(required = false) String classFilter) {
        return ResponseEntity.ok(schoolDashboardDataService.buildInstituteView(
                instituteCode, parseClassFilter(classFilter)));
    }

    /** "All", null, or a class number; anything unparseable falls back to All. */
    private SchoolDashboard.ClassFilter parseClassFilter(Object raw) {
        if (raw instanceof Number) {
            return SchoolDashboard.ClassFilter.of(((Number) raw).intValue());
        }
        if (raw instanceof String) {
            String text = ((String) raw).trim();
            if (!text.isEmpty() && !"All".equalsIgnoreCase(text)) {
                Integer grade = com.kccitm.api.util.GradeParser.numericGradeOrNull(text);
                if (grade != null) {
                    return SchoolDashboard.ClassFilter.of(grade);
                }
                logger.warn("School dashboard: unrecognised classFilter '{}', exporting all classes", text);
            }
        }
        return SchoolDashboard.ClassFilter.all();
    }
}
