package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@RestController
@RequestMapping("/generated-reports")
public class GeneratedReportController {

    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;

    @Autowired private BetReportDataController betReportDataController;
    @Autowired private NavigatorReportDataController navigatorReportDataController;

    // ═══════════════════════ CRUD ═══════════════════════

    @GetMapping("/getAll")
    public ResponseEntity<List<GeneratedReport>> getAll() {
        return ResponseEntity.ok(generatedReportRepository.findAll());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<GeneratedReport> getById(@PathVariable Long id) {
        return generatedReportRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!generatedReportRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        generatedReportRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ═══════════════════════ QUERIES ═══════════════════════

    @GetMapping("/by-student/{userStudentId}")
    public ResponseEntity<List<GeneratedReport>> getByStudent(@PathVariable Long userStudentId) {
        return ResponseEntity.ok(generatedReportRepository.findByUserStudentUserStudentId(userStudentId));
    }

    @GetMapping("/by-student/{userStudentId}/type/{typeOfReport}")
    public ResponseEntity<List<GeneratedReport>> getByStudentAndType(
            @PathVariable Long userStudentId, @PathVariable String typeOfReport) {
        return ResponseEntity.ok(
                generatedReportRepository.findByUserStudentUserStudentIdAndTypeOfReport(userStudentId, typeOfReport));
    }

    @GetMapping("/by-assessment/{assessmentId}")
    public ResponseEntity<List<GeneratedReport>> getByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(generatedReportRepository.findByAssessmentId(assessmentId));
    }

    @GetMapping("/by-assessment/{assessmentId}/type/{typeOfReport}")
    public ResponseEntity<List<GeneratedReport>> getByAssessmentAndType(
            @PathVariable Long assessmentId, @PathVariable String typeOfReport) {
        return ResponseEntity.ok(
                generatedReportRepository.findByAssessmentIdAndTypeOfReport(assessmentId, typeOfReport));
    }

    @GetMapping("/by-student/{userStudentId}/assessment/{assessmentId}/type/{typeOfReport}")
    public ResponseEntity<GeneratedReport> getByStudentAssessmentType(
            @PathVariable Long userStudentId,
            @PathVariable Long assessmentId,
            @PathVariable String typeOfReport) {
        return generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(userStudentId, assessmentId, typeOfReport)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ═══════════════════════ STUDENT-FACING (visibility-filtered) ═══════════════════════

    @GetMapping("/student/{userStudentId}")
    public ResponseEntity<List<GeneratedReport>> getVisibleReportsForStudent(@PathVariable Long userStudentId) {
        return ResponseEntity.ok(
                generatedReportRepository.findByUserStudentUserStudentIdAndVisibleToStudent(userStudentId, true));
    }

    // ═══════════════════════ ADMIN: TOGGLE VISIBILITY ═══════════════════════

    /**
     * PUT /generated-reports/toggle-visibility
     * Body: { "ids": [1, 2, 3], "visible": true }
     */
    @SuppressWarnings("unchecked")
    @PutMapping("/toggle-visibility")
    public ResponseEntity<?> toggleVisibility(@RequestBody Map<String, Object> body) {
        List<Number> idNums = (List<Number>) body.get("ids");
        Boolean visible = (Boolean) body.get("visible");
        if (idNums == null || idNums.isEmpty() || visible == null) {
            return ResponseEntity.badRequest().body("ids (list) and visible (boolean) are required");
        }

        List<Long> ids = new ArrayList<>();
        for (Number n : idNums) {
            ids.add(n.longValue());
        }

        List<GeneratedReport> reports = generatedReportRepository.findAllById(ids);
        for (GeneratedReport r : reports) {
            r.setVisibleToStudent(visible);
        }
        generatedReportRepository.saveAll(reports);

        return ResponseEntity.ok(Map.of("updated", reports.size()));
    }

    // ═══════════════════════ CREATE / UPSERT ═══════════════════════

    /**
     * POST /generated-reports/create
     * Body: { "userStudentId": 874, "assessmentId": 18, "typeOfReport": "bet",
     *         "reportStatus": "generated", "reportUrl": "https://..." }
     */
    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long userStudentId = ((Number) body.get("userStudentId")).longValue();
        Long assessmentId = ((Number) body.get("assessmentId")).longValue();
        String typeOfReport = (String) body.get("typeOfReport");
        String reportStatus = (String) body.getOrDefault("reportStatus", "notGenerated");
        String reportUrl = (String) body.get("reportUrl");

        Optional<UserStudent> userStudentOpt = userStudentRepository.findById(userStudentId);
        if (userStudentOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("UserStudent not found: " + userStudentId);
        }

        // Check if already exists (upsert)
        Optional<GeneratedReport> existing = generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(userStudentId, assessmentId, typeOfReport);

        GeneratedReport report;
        if (existing.isPresent()) {
            report = existing.get();
        } else {
            report = new GeneratedReport();
            report.setUserStudent(userStudentOpt.get());
            report.setAssessmentId(assessmentId);
            report.setTypeOfReport(typeOfReport);
        }

        report.setReportStatus(reportStatus);
        report.setReportUrl(reportUrl);
        if (body.containsKey("visibleToStudent")) {
            report.setVisibleToStudent((Boolean) body.get("visibleToStudent"));
        }

        return ResponseEntity.ok(generatedReportRepository.save(report));
    }

    /**
     * PUT /generated-reports/update/{id}
     * Body: { "reportStatus": "generated", "reportUrl": "https://..." }
     */
    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Optional<GeneratedReport> opt = generatedReportRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        GeneratedReport report = opt.get();
        if (body.containsKey("reportStatus")) report.setReportStatus((String) body.get("reportStatus"));
        if (body.containsKey("reportUrl")) report.setReportUrl((String) body.get("reportUrl"));
        if (body.containsKey("visibleToStudent")) report.setVisibleToStudent((Boolean) body.get("visibleToStudent"));

        return ResponseEntity.ok(generatedReportRepository.save(report));
    }

    // ═══════════════════════ ONE-CLICK: ALL REPORTS FOR A STUDENT ═══════════════════════

    /**
     * POST /generated-reports/one-click
     * Body: { "userStudentId": 874 }
     * Optional: { "force": true } to regenerate all
     *
     * Finds ALL completed assessments for this student, determines BET vs Navigator,
     * delegates to the appropriate controller's one-click-report for each,
     * and returns a unified list of results.
     */
    @PostMapping("/one-click")
    public ResponseEntity<?> oneClickAll(@RequestBody Map<String, Object> request) {
        if (!request.containsKey("userStudentId")) {
            return ResponseEntity.badRequest().body(Map.of("error", "userStudentId is required"));
        }
        Long userStudentId = ((Number) request.get("userStudentId")).longValue();
        boolean force = Boolean.TRUE.equals(request.get("force"));

        // Validate student exists
        Optional<UserStudent> userStudentOpt = userStudentRepository.findById(userStudentId);
        if (userStudentOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "UserStudent not found: " + userStudentId));
        }

        // Find all completed assessments for this student
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findByUserStudentUserStudentId(userStudentId);

        List<StudentAssessmentMapping> completed = new ArrayList<>();
        for (StudentAssessmentMapping m : mappings) {
            if ("completed".equals(m.getStatus())) {
                completed.add(m);
            }
        }

        if (completed.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "generated", 0,
                    "message", "No completed assessments found for this student",
                    "reports", List.of()));
        }

        List<Map<String, Object>> results = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();

        for (StudentAssessmentMapping mapping : completed) {
            Long assessmentId = mapping.getAssessmentId();
            String typeOfReport = resolveReportType(assessmentId);
            if (typeOfReport == null) {
                errors.add(Map.of(
                        "assessmentId", assessmentId,
                        "reason", "Assessment not found or has no linked questionnaire"));
                continue;
            }

            try {
                // Build the request body for the per-type controller
                Map<String, Object> perTypeRequest = new HashMap<>();
                perTypeRequest.put("assessmentId", assessmentId);
                perTypeRequest.put("userStudentId", userStudentId);
                perTypeRequest.put("force", force);

                ResponseEntity<?> delegateResponse;
                if ("bet".equals(typeOfReport)) {
                    delegateResponse = betReportDataController.oneClickReport(perTypeRequest);
                } else {
                    delegateResponse = navigatorReportDataController.oneClickReport(perTypeRequest);
                }

                if (delegateResponse.getStatusCode().is2xxSuccessful() && delegateResponse.getBody() instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> body = (Map<String, Object>) delegateResponse.getBody();
                    Map<String, Object> result = new HashMap<>(body);
                    result.put("assessmentId", assessmentId);
                    result.put("typeOfReport", typeOfReport);
                    results.add(result);
                } else {
                    // Non-2xx or non-map body (e.g. HTML fallback download) — treat as partial success
                    String reason = "Unexpected response";
                    if (delegateResponse.getBody() instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> errBody = (Map<String, Object>) delegateResponse.getBody();
                        reason = String.valueOf(errBody.getOrDefault("error", reason));
                    }
                    errors.add(Map.of(
                            "assessmentId", assessmentId,
                            "typeOfReport", typeOfReport,
                            "reason", reason));
                }
            } catch (Exception e) {
                errors.add(Map.of(
                        "assessmentId", assessmentId,
                        "typeOfReport", typeOfReport,
                        "reason", e.getMessage() != null ? e.getMessage() : "Unknown error"));
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("generated", results.size());
        response.put("errors", errors);
        response.put("reports", results);
        return ResponseEntity.ok(response);
    }

    // ═══════════════════════ DELETE ═══════════════════════

    @DeleteMapping("/by-student/{userStudentId}/assessment/{assessmentId}/type/{typeOfReport}")
    @Transactional
    public ResponseEntity<?> deleteByStudentAssessmentType(
            @PathVariable Long userStudentId,
            @PathVariable Long assessmentId,
            @PathVariable String typeOfReport) {
        generatedReportRepository.deleteByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
                userStudentId, assessmentId, typeOfReport);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/by-assessment/{assessmentId}/type/{typeOfReport}")
    @Transactional
    public ResponseEntity<?> deleteByAssessmentAndType(
            @PathVariable Long assessmentId, @PathVariable String typeOfReport) {
        generatedReportRepository.deleteByAssessmentIdAndTypeOfReport(assessmentId, typeOfReport);
        return ResponseEntity.ok().build();
    }

    // ═══════════════════════ HELPERS ═══════════════════════

    /**
     * Determines if an assessment is BET or Navigator based on questionnaire.type.
     * Returns "bet" if type=true, "navigator" if type=false/null, null if assessment not found.
     */
    private String resolveReportType(Long assessmentId) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(assessmentId);
        if (assessmentOpt.isEmpty()) return null;

        AssessmentTable assessment = assessmentOpt.get();
        if (assessment.getQuestionnaire() == null) return null;

        Boolean qType = assessment.getQuestionnaire().getType();
        return (qType != null && qType) ? "bet" : "navigator";
    }
}
