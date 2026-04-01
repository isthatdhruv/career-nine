package com.kccitm.api.controller.career9;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.NavigatorReportData;
import com.kccitm.api.repository.Career9.NavigatorReportDataRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;

@RestController
@RequestMapping("/navigator-report-data")
public class NavigatorReportDataController {

    @Autowired private NavigatorReportDataRepository navigatorReportDataRepository;
    @Autowired private NavigatorReportGenerationService navigatorReportGenerationService;
    @Autowired private DigitalOceanSpacesService digitalOceanSpacesService;

    // ═══════════════════════ CRUD ═══════════════════════

    // ═══════════════════════ ONE-CLICK REPORT ═══════════════════════

    /**
     * POST /navigator-report-data/one-click-report
     * Body: { "assessmentId": 18, "userStudentId": 874 }
     *
     * Generates report data (if not exists) + generates HTML report + returns URL.
     */
    @PostMapping("/one-click-report")
    @Transactional
    public ResponseEntity<?> oneClickReport(@RequestBody Map<String, Object> request) {
        try {
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            Long userStudentId = ((Number) request.get("userStudentId")).longValue();

            // Step 1: Check existing
            Optional<NavigatorReportData> existing = navigatorReportDataRepository
                    .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

            // Step 2: Generate data if missing OR if AI summary is empty (needs regeneration)
            boolean needsRegeneration = existing.isEmpty()
                    || existing.get().getSummary() == null
                    || existing.get().getSummary().isEmpty()
                    || existing.get().getSummary().startsWith("Summary generation failed");

            if (needsRegeneration) {
                // Delete stale data if exists
                if (existing.isPresent()) {
                    navigatorReportDataRepository.deleteByUserStudentUserStudentIdAndAssessmentId(
                            userStudentId, assessmentId);
                }
                NavigatorReportData report = navigatorReportGenerationService
                        .generateForStudent(userStudentId, assessmentId, false);
                if (report == null) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("error", "No completed assessment found for this student"));
                }
                existing = Optional.of(report);
            }

            NavigatorReportData report = existing.get();

            // Check eligibility
            if (!report.isEligible()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Student is ineligible for report generation",
                                "issues", safe(report.getEligibilityIssues())));
            }

            // Step 3: Generate HTML if not already generated
            if (!"generated".equals(report.getReportStatus()) || report.getReportUrl() == null) {
                String templateName = resolveTemplateName(report.getStudentClass());
                String template = loadNavigatorTemplate(templateName);
                if (template == null) {
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Could not load Navigator template: " + templateName));
                }

                String filledHtml = fillTemplate(template, report);
                String safeName = (report.getStudentName() != null ? report.getStudentName() : "student")
                        .replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
                String reportType = resolveReportType(report.getStudentClass());
                String fileName = safeName + "_" + userStudentId + "_" + reportType + ".html";
                String folder = "navigator-reports/assessment-" + assessmentId;

                String reportUrl = digitalOceanSpacesService.uploadBytes(
                        filledHtml.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        "text/html", folder, fileName);

                report.setReportStatus("generated");
                report.setReportUrl(reportUrl);
                navigatorReportDataRepository.save(report);
            }

            return ResponseEntity.ok(Map.of(
                    "reportUrl", report.getReportUrl(),
                    "studentName", safe(report.getStudentName()),
                    "status", "generated"
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Report generation failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════ CRUD ═══════════════════════

    @GetMapping("/getAll")
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(navigatorReportDataRepository.findAll());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return navigatorReportDataRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-assessment/{assessmentId}")
    public ResponseEntity<?> getByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(navigatorReportDataRepository.findByAssessmentId(assessmentId));
    }

    @GetMapping("/by-student/{userStudentId}")
    public ResponseEntity<?> getByStudent(@PathVariable Long userStudentId) {
        return ResponseEntity.ok(navigatorReportDataRepository.findByUserStudentUserStudentId(userStudentId));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!navigatorReportDataRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        navigatorReportDataRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    // ═══════════════════════ RESET (on assessment reset) ═══════════════════════

    /**
     * DELETE /navigator-report-data/reset/student/{userStudentId}/assessment/{assessmentId}
     *
     * Resets (deletes) all Navigator report data for a specific student+assessment.
     * Call this when a student's assessment is reset so stale/insignificant data is removed.
     */
    @DeleteMapping("/reset/student/{userStudentId}/assessment/{assessmentId}")
    @Transactional
    public ResponseEntity<?> resetForStudent(
            @PathVariable Long userStudentId, @PathVariable Long assessmentId) {
        navigatorReportDataRepository.deleteByUserStudentUserStudentIdAndAssessmentId(
                userStudentId, assessmentId);
        return ResponseEntity.ok(Map.of(
                "message", "Navigator report data reset for student " + userStudentId
                        + " assessment " + assessmentId));
    }

    /**
     * DELETE /navigator-report-data/reset/assessment/{assessmentId}
     *
     * Resets (deletes) all Navigator report data for an entire assessment.
     * Call this when an assessment is fully reset.
     */
    @DeleteMapping("/reset/assessment/{assessmentId}")
    @Transactional
    public ResponseEntity<?> resetForAssessment(@PathVariable Long assessmentId) {
        navigatorReportDataRepository.deleteByAssessmentId(assessmentId);
        return ResponseEntity.ok(Map.of(
                "message", "Navigator report data reset for assessment " + assessmentId));
    }

    /**
     * GET /navigator-report-data/eligible/{assessmentId}
     *
     * Returns only eligible students' report data for an assessment.
     */
    @GetMapping("/eligible/{assessmentId}")
    public ResponseEntity<?> getEligibleByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(
                navigatorReportDataRepository.findByAssessmentIdAndEligible(assessmentId, true));
    }

    /**
     * GET /navigator-report-data/ineligible/{assessmentId}
     *
     * Returns only ineligible (insignificant) students' report data for an assessment.
     */
    @GetMapping("/ineligible/{assessmentId}")
    public ResponseEntity<?> getIneligibleByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(
                navigatorReportDataRepository.findByAssessmentIdAndEligible(assessmentId, false));
    }

    // ═══════════════════════ EXCEL EXPORT ═══════════════════════

    @GetMapping("/export-excel/{assessmentId}")
    public ResponseEntity<?> exportExcel(@PathVariable Long assessmentId) {
        try {
            List<NavigatorReportData> reports = navigatorReportDataRepository.findByAssessmentId(assessmentId);
            if (reports.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No Navigator report data found for this assessment"));
            }

            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("Navigator Report Data");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            String[] headers = {
                "student_name", "student_class", "student_school",
                "personality_1_text", "personality_2_text", "personality_3_text",
                "intelligence_1_text", "intelligence_2_text", "intelligence_3_text",
                "learning_style_1", "learning_style_2", "learning_style_3",
                "enjoys_with_1", "enjoys_with_2", "enjoys_with_3",
                "struggles_with_1", "struggles_with_2", "struggles_with_3",
                "soi_1", "soi_2", "soi_3", "soi_4", "soi_5",
                "values_1", "values_2", "values_3", "values_4",
                "career_asp_1", "career_asp_2", "career_asp_3", "career_asp_4",
                "ability_1", "ability_2", "ability_3", "ability_4",
                "pathway_1", "pathway_2", "pathway_3", "pathway_4", "pathway_5",
                "pathway_6", "pathway_7", "pathway_8", "pathway_9",
                "pathway_1_text", "pathway_2_text", "pathway_3_text",
                "summary", "learning_style_summary", "recommendations",
                "weak_ability", "career_match_result",
                "report_status", "report_url"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                headerRow.createCell(i).setCellValue(headers[i]);
                headerRow.getCell(i).setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (NavigatorReportData r : reports) {
                Row row = sheet.createRow(rowIdx++);
                int col = 0;
                row.createCell(col++).setCellValue(safe(r.getStudentName()));
                row.createCell(col++).setCellValue(safe(r.getStudentClass()));
                row.createCell(col++).setCellValue(safe(r.getStudentSchool()));
                row.createCell(col++).setCellValue(safe(r.getPersonality1Text()));
                row.createCell(col++).setCellValue(safe(r.getPersonality2Text()));
                row.createCell(col++).setCellValue(safe(r.getPersonality3Text()));
                row.createCell(col++).setCellValue(safe(r.getIntelligence1Text()));
                row.createCell(col++).setCellValue(safe(r.getIntelligence2Text()));
                row.createCell(col++).setCellValue(safe(r.getIntelligence3Text()));
                row.createCell(col++).setCellValue(safe(r.getLearningStyle1()));
                row.createCell(col++).setCellValue(safe(r.getLearningStyle2()));
                row.createCell(col++).setCellValue(safe(r.getLearningStyle3()));
                row.createCell(col++).setCellValue(safe(r.getEnjoysWith1()));
                row.createCell(col++).setCellValue(safe(r.getEnjoysWith2()));
                row.createCell(col++).setCellValue(safe(r.getEnjoysWith3()));
                row.createCell(col++).setCellValue(safe(r.getStrugglesWith1()));
                row.createCell(col++).setCellValue(safe(r.getStrugglesWith2()));
                row.createCell(col++).setCellValue(safe(r.getStrugglesWith3()));
                row.createCell(col++).setCellValue(safe(r.getSoi1()));
                row.createCell(col++).setCellValue(safe(r.getSoi2()));
                row.createCell(col++).setCellValue(safe(r.getSoi3()));
                row.createCell(col++).setCellValue(safe(r.getSoi4()));
                row.createCell(col++).setCellValue(safe(r.getSoi5()));
                row.createCell(col++).setCellValue(safe(r.getValues1()));
                row.createCell(col++).setCellValue(safe(r.getValues2()));
                row.createCell(col++).setCellValue(safe(r.getValues3()));
                row.createCell(col++).setCellValue(safe(r.getValues4()));
                row.createCell(col++).setCellValue(safe(r.getCareerAsp1()));
                row.createCell(col++).setCellValue(safe(r.getCareerAsp2()));
                row.createCell(col++).setCellValue(safe(r.getCareerAsp3()));
                row.createCell(col++).setCellValue(safe(r.getCareerAsp4()));
                row.createCell(col++).setCellValue(safe(r.getAbility1()));
                row.createCell(col++).setCellValue(safe(r.getAbility2()));
                row.createCell(col++).setCellValue(safe(r.getAbility3()));
                row.createCell(col++).setCellValue(safe(r.getAbility4()));
                row.createCell(col++).setCellValue(safe(r.getPathway1()));
                row.createCell(col++).setCellValue(safe(r.getPathway2()));
                row.createCell(col++).setCellValue(safe(r.getPathway3()));
                row.createCell(col++).setCellValue(safe(r.getPathway4()));
                row.createCell(col++).setCellValue(safe(r.getPathway5()));
                row.createCell(col++).setCellValue(safe(r.getPathway6()));
                row.createCell(col++).setCellValue(safe(r.getPathway7()));
                row.createCell(col++).setCellValue(safe(r.getPathway8()));
                row.createCell(col++).setCellValue(safe(r.getPathway9()));
                row.createCell(col++).setCellValue(safe(r.getPathway1Text()));
                row.createCell(col++).setCellValue(safe(r.getPathway2Text()));
                row.createCell(col++).setCellValue(safe(r.getPathway3Text()));
                row.createCell(col++).setCellValue(safe(r.getSummary()));
                row.createCell(col++).setCellValue(safe(r.getLearningStyleSummary()));
                row.createCell(col++).setCellValue(safe(r.getRecommendations()));
                row.createCell(col++).setCellValue(safe(r.getWeakAbility()));
                row.createCell(col++).setCellValue(safe(r.getCareerMatchResult()));
                row.createCell(col++).setCellValue(safe(r.getReportStatus()));
                row.createCell(col++).setCellValue(safe(r.getReportUrl()));
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            workbook.close();

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            responseHeaders.setContentDispositionFormData("attachment", "navigator_report_data.xlsx");
            responseHeaders.setContentLength(out.size());

            return new ResponseEntity<>(out.toByteArray(), responseHeaders, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Export failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════ GENERATE & SAVE ═══════════════════════

    /**
     * POST /navigator-report-data/generate
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     *
     * For each student: fetches answers, computes Navigator report fields
     * (personality, intelligence, learning styles, abilities, pathways, etc.),
     * and upserts into navigator_report_data.
     */
    @PostMapping("/generate")
    @Transactional
    public ResponseEntity<?> generateAndSave(@RequestBody Map<String, Object> request) {
        try {
            if (!request.containsKey("assessmentId") || !request.containsKey("userStudentIds")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assessmentId and userStudentIds are required"));
            }
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> idList = (List<Number>) request.get("userStudentIds");

            List<NavigatorReportData> saved = new ArrayList<>();
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Number idNum : idList) {
                Long userStudentId = idNum.longValue();
                try {
                    NavigatorReportData report = navigatorReportGenerationService
                            .generateForStudent(userStudentId, assessmentId);
                    if (report != null) {
                        saved.add(report);
                    } else {
                        errors.add(Map.of("userStudentId", userStudentId,
                                "reason", "No completed assessment found"));
                    }
                } catch (Exception e) {
                    errors.add(Map.of("userStudentId", userStudentId,
                            "reason", e.getMessage()));
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("generated", saved.size());
            response.put("errors", errors);
            response.put("data", saved);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate Navigator report data: " + e.getMessage()));
        }
    }

    // ═══════════════════════ GENERATE HTML REPORTS ═══════════════════════

    /**
     * POST /navigator-report-data/generate-reports
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     *
     * For each student: reads navigator_report_data, selects the class-appropriate
     * HTML template (6-8, 9-10, or 11-12), fills placeholders, uploads to
     * DigitalOcean Spaces, and updates reportStatus/reportUrl.
     */
    @PostMapping("/generate-reports")
    @Transactional
    public ResponseEntity<?> generateHtmlReports(@RequestBody Map<String, Object> request) {
        try {
            if (!request.containsKey("assessmentId") || !request.containsKey("userStudentIds")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assessmentId and userStudentIds are required"));
            }
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> idList = (List<Number>) request.get("userStudentIds");

            List<Map<String, Object>> results = new ArrayList<>();
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Number idNum : idList) {
                Long userStudentId = idNum.longValue();
                try {
                    Optional<NavigatorReportData> reportOpt = navigatorReportDataRepository
                            .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
                    if (reportOpt.isEmpty()) {
                        errors.add(Map.of("userStudentId", userStudentId,
                                "reason", "No report data found. Generate report data first."));
                        continue;
                    }

                    NavigatorReportData report = reportOpt.get();

                    // Select template based on student class
                    String templateName = resolveTemplateName(report.getStudentClass());
                    String template = loadNavigatorTemplate(templateName);
                    if (template == null) {
                        errors.add(Map.of("userStudentId", userStudentId,
                                "reason", "Could not load template: " + templateName));
                        continue;
                    }

                    // Fill template with report data
                    String filledHtml = fillTemplate(template, report);

                    // Upload to DigitalOcean Spaces
                    String safeName = (report.getStudentName() != null ? report.getStudentName() : "student")
                            .replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
                    String reportType = resolveReportType(report.getStudentClass());
                    String fileName = safeName + "_" + userStudentId + "_" + reportType + ".html";
                    String folder = "navigator-reports/assessment-" + assessmentId;

                    String reportUrl = digitalOceanSpacesService.uploadBytes(
                            filledHtml.getBytes(StandardCharsets.UTF_8),
                            "text/html",
                            folder,
                            fileName
                    );

                    report.setReportStatus("generated");
                    report.setReportUrl(reportUrl);
                    navigatorReportDataRepository.save(report);

                    results.add(Map.of(
                            "userStudentId", userStudentId,
                            "studentName", safe(report.getStudentName()),
                            "reportUrl", reportUrl
                    ));
                } catch (Exception e) {
                    errors.add(Map.of("userStudentId", userStudentId,
                            "reason", e.getMessage()));
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("generated", results.size());
            response.put("errors", errors);
            response.put("reports", results);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate reports: " + e.getMessage()));
        }
    }

    // ═══════════════════════ UPLOAD NAVIGATOR TEMPLATE ASSETS ═══════════════════════

    /**
     * POST /navigator-report-data/upload-template-assets
     *
     * One-time operation: uploads navigator template assets from classpath
     * (navigator-template/assets/* and navigator-template/images/*)
     * to DigitalOcean Spaces under navigator-template-assets/.
     */
    @PostMapping("/upload-template-assets")
    public ResponseEntity<?> uploadTemplateAssets() {
        try {
            String[] assetPaths = {
                // Static assets
                "assets/career-nine-logo.png",
                "assets/cover.png",
                "assets/process-steps.png",
                "assets/hexagon.png",
                "assets/summary-divider.png",
                "assets/learning-style-hero.png",
                "assets/csi-1.png", "assets/csi-2.png", "assets/csi-3.png",
                "assets/csi-4.png", "assets/csi-5.png", "assets/csi-6.png",
                "assets/csi-7.png", "assets/csi-8.png", "assets/csi-9.png",
                "assets/pathway-1.png",
                "assets/feedback.jpg",
                "assets/questionmark.jpg",
                "assets/knowmore.jpg",
                "assets/qr.png",
                // Dynamic personality images
                "images/doer.png",
                "images/thinker.png",
                "images/creator.png",
                "images/helper.png",
                "images/persuader.png",
                "images/organizer.png",
                // Dynamic intelligence images
                "images/bodily.png",
                "images/interpersonal.png",
                "images/intrapersonal.png",
                "images/linguistic.png",
                "images/logical.png",
                "images/musical.png",
                "images/musical.jpg",
                "images/spatial.png",
                "images/naturalistic.png",
            };

            List<String> uploaded = new ArrayList<>();
            List<String> failed = new ArrayList<>();

            for (String assetPath : assetPaths) {
                try {
                    var is = getClass().getClassLoader()
                            .getResourceAsStream("navigator-template/" + assetPath);
                    if (is == null) {
                        failed.add(assetPath + " (not found in classpath)");
                        continue;
                    }
                    byte[] bytes = is.readAllBytes();
                    is.close();

                    String contentType = guessContentType(assetPath);
                    String fileName = assetPath.substring(assetPath.lastIndexOf('/') + 1);
                    String folder = "navigator-template-assets/" + assetPath.substring(0, assetPath.lastIndexOf('/'));

                    digitalOceanSpacesService.uploadBytes(bytes, contentType, folder, fileName);
                    uploaded.add(assetPath);
                } catch (Exception e) {
                    failed.add(assetPath + " (" + e.getMessage() + ")");
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("uploaded", uploaded.size());
            response.put("failed", failed);
            response.put("uploadedFiles", uploaded);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Asset upload failed: " + e.getMessage()));
        }
    }

    private String guessContentType(String path) {
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    // ═══════════════════════ TEMPLATE HELPERS ═══════════════════════

    private String resolveTemplateName(String studentClass) {
        if (studentClass == null) return "9-10.html";
        try {
            int classNum = Integer.parseInt(studentClass.trim());
            if (classNum >= 6 && classNum <= 8) return "6-8.html";
            if (classNum >= 9 && classNum <= 10) return "9-10.html";
            if (classNum >= 11 && classNum <= 12) return "11-12.html";
        } catch (NumberFormatException ignored) {}
        return "9-10.html";
    }

    private String resolveReportType(String studentClass) {
        if (studentClass == null) return "stream_navigator";
        try {
            int classNum = Integer.parseInt(studentClass.trim());
            if (classNum >= 6 && classNum <= 8) return "insight_navigator";
            if (classNum >= 9 && classNum <= 10) return "stream_navigator";
            if (classNum >= 11 && classNum <= 12) return "career_navigator";
        } catch (NumberFormatException ignored) {}
        return "stream_navigator";
    }

    private String loadNavigatorTemplate(String templateName) {
        try {
            var is = getClass().getClassLoader()
                    .getResourceAsStream("navigator-template/" + templateName);
            if (is != null) {
                String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                is.close();
                return content;
            }
        } catch (Exception e) {
            System.err.println("Failed to read navigator template: " + e.getMessage());
        }
        return null;
    }

    /**
     * Fill HTML template using regex replacement (matches Python Phase 6 behavior).
     * Handles {{ placeholder }} with optional whitespace.
     * Image placeholders (_image suffix) get wrapped in <img> tags.
     * Asset paths get rewritten to DO Spaces CDN URLs.
     */
    private String fillTemplate(String template, NavigatorReportData r) {
        String assetBase = "https://storage-c9.sgp1.digitaloceanspaces.com/navigator-template-assets";

        // Build placeholder → value map
        Map<String, String> placeholders = new LinkedHashMap<>();

        // Basic info
        placeholders.put("name", safe(r.getStudentName()));
        placeholders.put("name_caps", safe(r.getStudentNameCaps()));
        placeholders.put("f_name", safe(r.getStudentFirstName()));
        placeholders.put("class", safe(r.getStudentClass()));
        placeholders.put("school", safe(r.getStudentSchool()));

        // Personality
        placeholders.put("personality_1_text", safe(r.getPersonality1Text()));
        placeholders.put("personality_1_image", safe(r.getPersonality1Image()));
        placeholders.put("personality_2_text", safe(r.getPersonality2Text()));
        placeholders.put("personality_2_image", safe(r.getPersonality2Image()));
        placeholders.put("personality_3_text", safe(r.getPersonality3Text()));
        placeholders.put("personality_3_image", safe(r.getPersonality3Image()));
        placeholders.put("personality_graph", safe(r.getPersonalityGraph()));

        // Intelligence
        placeholders.put("intelligence_1_text", safe(r.getIntelligence1Text()));
        placeholders.put("intelligence_1_image", safe(r.getIntelligence1Image()));
        placeholders.put("intelligence_2_text", safe(r.getIntelligence2Text()));
        placeholders.put("intelligence_2_image", safe(r.getIntelligence2Image()));
        placeholders.put("intelligence_3_text", safe(r.getIntelligence3Text()));
        placeholders.put("intelligence_3_image", safe(r.getIntelligence3Image()));
        placeholders.put("intelligence_graph", safe(r.getIntelligenceGraph()));

        // Learning styles — "learning_style" (no number) = AI-generated summary
        placeholders.put("learning_style", safe(r.getLearningStyleSummary()));
        placeholders.put("learning_style_1", safe(r.getLearningStyle1()));
        placeholders.put("learning_style_2", safe(r.getLearningStyle2()));
        placeholders.put("learning_style_3", safe(r.getLearningStyle3()));
        placeholders.put("enjoys_with_1", safe(r.getEnjoysWith1()));
        placeholders.put("enjoys_with_2", safe(r.getEnjoysWith2()));
        placeholders.put("enjoys_with_3", safe(r.getEnjoysWith3()));
        placeholders.put("struggles_with_1", safe(r.getStrugglesWith1()));
        placeholders.put("struggles_with_2", safe(r.getStrugglesWith2()));
        placeholders.put("struggles_with_3", safe(r.getStrugglesWith3()));

        // SOI
        placeholders.put("soi_1", safe(r.getSoi1()));
        placeholders.put("soi_2", safe(r.getSoi2()));
        placeholders.put("soi_3", safe(r.getSoi3()));
        placeholders.put("soi_4", safe(r.getSoi4()));
        placeholders.put("soi_5", safe(r.getSoi5()));

        // Values
        placeholders.put("values_1", safe(r.getValues1()));
        placeholders.put("values_2", safe(r.getValues2()));
        placeholders.put("values_3", safe(r.getValues3()));
        placeholders.put("values_4", safe(r.getValues4()));

        // Career aspirations
        placeholders.put("career_asp_1", safe(r.getCareerAsp1()));
        placeholders.put("career_asp_2", safe(r.getCareerAsp2()));
        placeholders.put("career_asp_3", safe(r.getCareerAsp3()));
        placeholders.put("career_asp_4", safe(r.getCareerAsp4()));

        // Abilities
        placeholders.put("ability_1", safe(r.getAbility1()));
        placeholders.put("ability_2", safe(r.getAbility2()));
        placeholders.put("ability_3", safe(r.getAbility3()));
        placeholders.put("ability_4", safe(r.getAbility4()));

        // Pathways
        placeholders.put("pathway_1", safe(r.getPathway1()));
        placeholders.put("pathway_2", safe(r.getPathway2()));
        placeholders.put("pathway_3", safe(r.getPathway3()));
        placeholders.put("pathway_4", safe(r.getPathway4()));
        placeholders.put("pathway_5", safe(r.getPathway5()));
        placeholders.put("pathway_6", safe(r.getPathway6()));
        placeholders.put("pathway_7", safe(r.getPathway7()));
        placeholders.put("pathway_8", safe(r.getPathway8()));
        placeholders.put("pathway_9", safe(r.getPathway9()));

        // Pathway texts
        placeholders.put("pathway_1_text", safe(r.getPathway1Text()));
        placeholders.put("pathway_2_text", safe(r.getPathway2Text()));
        placeholders.put("pathway_3_text", safe(r.getPathway3Text()));

        // CP1-3 details
        placeholders.put("cp1_subjects", safe(r.getCp1Subjects()));
        placeholders.put("cp1_skills", safe(r.getCp1Skills()));
        placeholders.put("cp1_courses", safe(r.getCp1Courses()));
        placeholders.put("cp1_exams", safe(r.getCp1Exams()));
        placeholders.put("cp1_personality_has", safe(r.getCp1PersonalityHas()));
        placeholders.put("cp1_personality_lacks", safe(r.getCp1PersonalityLacks()));
        placeholders.put("cp1_intelligence_has", safe(r.getCp1IntelligenceHas()));
        placeholders.put("cp1_intelligence_lacks", safe(r.getCp1IntelligenceLacks()));
        placeholders.put("cp1_soi_has", safe(r.getCp1SoiHas()));
        placeholders.put("cp1_soi_lacks", safe(r.getCp1SoiLacks()));
        placeholders.put("cp1_ability_has", safe(r.getCp1AbilityHas()));
        placeholders.put("cp1_ability_lacks", safe(r.getCp1AbilityLacks()));
        placeholders.put("cp1_values_has", safe(r.getCp1ValuesHas()));
        placeholders.put("cp1_values_lacks", safe(r.getCp1ValuesLacks()));

        placeholders.put("cp2_subjects", safe(r.getCp2Subjects()));
        placeholders.put("cp2_skills", safe(r.getCp2Skills()));
        placeholders.put("cp2_courses", safe(r.getCp2Courses()));
        placeholders.put("cp2_exams", safe(r.getCp2Exams()));
        placeholders.put("cp2_personality_has", safe(r.getCp2PersonalityHas()));
        placeholders.put("cp2_personality_lacks", safe(r.getCp2PersonalityLacks()));
        placeholders.put("cp2_intelligence_has", safe(r.getCp2IntelligenceHas()));
        placeholders.put("cp2_intelligence_lacks", safe(r.getCp2IntelligenceLacks()));
        placeholders.put("cp2_soi_has", safe(r.getCp2SoiHas()));
        placeholders.put("cp2_soi_lacks", safe(r.getCp2SoiLacks()));
        placeholders.put("cp2_ability_has", safe(r.getCp2AbilityHas()));
        placeholders.put("cp2_ability_lacks", safe(r.getCp2AbilityLacks()));
        placeholders.put("cp2_values_has", safe(r.getCp2ValuesHas()));
        placeholders.put("cp2_values_lacks", safe(r.getCp2ValuesLacks()));

        placeholders.put("cp3_subjects", safe(r.getCp3Subjects()));
        placeholders.put("cp3_skills", safe(r.getCp3Skills()));
        placeholders.put("cp3_courses", safe(r.getCp3Courses()));
        placeholders.put("cp3_exams", safe(r.getCp3Exams()));
        placeholders.put("cp3_personality_has", safe(r.getCp3PersonalityHas()));
        placeholders.put("cp3_personality_lacks", safe(r.getCp3PersonalityLacks()));
        placeholders.put("cp3_intelligence_has", safe(r.getCp3IntelligenceHas()));
        placeholders.put("cp3_intelligence_lacks", safe(r.getCp3IntelligenceLacks()));
        placeholders.put("cp3_soi_has", safe(r.getCp3SoiHas()));
        placeholders.put("cp3_soi_lacks", safe(r.getCp3SoiLacks()));
        placeholders.put("cp3_ability_has", safe(r.getCp3AbilityHas()));
        placeholders.put("cp3_ability_lacks", safe(r.getCp3AbilityLacks()));
        placeholders.put("cp3_values_has", safe(r.getCp3ValuesHas()));
        placeholders.put("cp3_values_lacks", safe(r.getCp3ValuesLacks()));

        // Suggestions & summaries
        placeholders.put("can_at_school", safe(r.getCanAtSchool()));
        placeholders.put("can_at_home", safe(r.getCanAtHome()));
        placeholders.put("summary", safe(r.getSummary()));
        placeholders.put("recommendations", safe(r.getRecommendations()));
        placeholders.put("weak_ability", safe(r.getWeakAbility()));
        placeholders.put("result", safe(r.getCareerMatchResult()));

        // Regex replace all {{ placeholder }} occurrences (matches Python Phase 6)
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\{\\{([^}]+)\\}\\}");
        java.util.regex.Matcher matcher = pattern.matcher(template);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String placeholder = matcher.group(1).trim();
            String value = placeholders.getOrDefault(placeholder, "");

            // Image placeholders: wrap filename in <img> tag (like Python get_value)
            if (placeholder.contains("_image") && !value.isEmpty() && !value.startsWith("<")) {
                String imgPath = value;
                if (!imgPath.startsWith("images/") && !imgPath.startsWith("assets/")
                        && !imgPath.startsWith("http") && !imgPath.startsWith("/")) {
                    imgPath = "images/" + imgPath;
                }
                String altText = placeholder.replace('_', ' ');
                altText = altText.substring(0, 1).toUpperCase() + altText.substring(1);
                value = "<img src=\"" + imgPath + "\" style=\"width: 100%; max-width: 200px;\" alt=\""
                        + altText + "\">";
            }

            // Graph placeholders: return empty if not available
            if (("personality_graph".equals(placeholder) || "intelligence_graph".equals(placeholder))
                    && value.isEmpty()) {
                value = "";
            }

            matcher.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(value));
        }
        matcher.appendTail(sb);
        String html = sb.toString();

        // Replace relative asset paths with absolute DO Spaces URLs
        html = html.replace("src=\"assets/", "src=\"" + assetBase + "/assets/");
        html = html.replace("src=\"images/", "src=\"" + assetBase + "/images/");
        html = html.replace("data=\"assets/", "data=\"" + assetBase + "/assets/");
        html = html.replace("url(assets/", "url(" + assetBase + "/assets/");
        html = html.replace("url(images/", "url(" + assetBase + "/images/");

        return html;
    }

    private String safe(String val) {
        return val != null ? val : "";
    }
}
