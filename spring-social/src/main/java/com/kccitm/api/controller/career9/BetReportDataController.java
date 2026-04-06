package com.kccitm.api.controller.career9;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

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

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.BetReportData;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.BetReportDataRepository;
import com.kccitm.api.repository.Career9.MeasuredQualitiesRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.FirebaseService;

@RestController
@RequestMapping("/bet-report-data")
public class BetReportDataController {

    // ── MQT / MQ IDs (must match frontend constants) ──
    private static final long MQT_ID_SOCIAL_INSIGHT = 36;
    private static final long MQT_ID_SELF_EFFICACY = 48;
    private static final long MQT_ID_EMOTION_REGULATION = 49;
    private static final long MQT_ID_SELF_MANAGEMENT = 52;
    private static final long MQ_ID_VALUES = 7;
    private static final long MQ_ID_ENVIRONMENTAL_AWARENESS = 8;

    @Autowired private BetReportDataRepository betReportDataRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private AssessmentAnswerRepository assessmentAnswerRepository;
    @Autowired private AssessmentRawScoreRepository assessmentRawScoreRepository;
    @Autowired private SchoolSectionsRepository schoolSectionsRepository;
    @Autowired private MeasuredQualityTypesRepository measuredQualityTypesRepository;
    @Autowired private MeasuredQualitiesRepository measuredQualitiesRepository;
    @Autowired private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private FirebaseService firebaseService;
    @Autowired private DigitalOceanSpacesService digitalOceanSpacesService;

    // ═══════════════════════ ONE-CLICK REPORT ═══════════════════════

    /**
     * POST /bet-report-data/one-click-report
     * Body: { "assessmentId": 5, "userStudentId": 874 }
     *
     * Generates report data (if not exists) + generates HTML report + returns URL.
     * Single endpoint for the "Download Report" button in student assessment modal.
     */
    @PostMapping("/one-click-report")
    @Transactional
    public ResponseEntity<?> oneClickReport(@RequestBody Map<String, Object> request) {
        try {
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            Long userStudentId = ((Number) request.get("userStudentId")).longValue();

            // Step 1: Check if report data already exists
            Optional<BetReportData> existing = betReportDataRepository
                    .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

            // Step 2: Generate data if missing or force=true
            boolean force = Boolean.TRUE.equals(request.get("force"));
            if (force && existing.isPresent()) {
                betReportDataRepository.deleteByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
                existing = Optional.empty();
            }
            if (existing.isEmpty()) {
                BetReportData report = generateForStudentLive(userStudentId, assessmentId);
                if (report == null) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("error", "No completed assessment found for this student"));
                }
                existing = Optional.of(report);
            }

            BetReportData report = existing.get();

            // Step 3: Generate HTML if not already generated
            if (!"generated".equals(report.getReportStatus()) || report.getReportUrl() == null) {
                String template = loadHtmlTemplate();
                if (template == null) {
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Could not load BET HTML template"));
                }

                String filledHtml = fillTemplate(template, report);
                String safeName = (report.getStudentName() != null ? report.getStudentName() : "student")
                        .replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
                String fileName = safeName + "_" + userStudentId + "_bet_report.html";
                String folder = "bet-reports/assessment-" + assessmentId;

                try {
                    String reportUrl = digitalOceanSpacesService.uploadBytes(
                            filledHtml.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                            "text/html", folder, fileName);

                    report.setReportStatus("generated");
                    report.setReportUrl(reportUrl);
                    betReportDataRepository.save(report);
                } catch (Exception uploadEx) {
                    // DO Spaces upload failed — return HTML directly for download
                    byte[] htmlBytes = filledHtml.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.TEXT_HTML);
                    headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
                    headers.setContentLength(htmlBytes.length);
                    return new ResponseEntity<>(htmlBytes, headers, HttpStatus.OK);
                }
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
        return ResponseEntity.ok(betReportDataRepository.findAll());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return betReportDataRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-assessment/{assessmentId}")
    public ResponseEntity<?> getByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(betReportDataRepository.findByAssessmentId(assessmentId));
    }

    @GetMapping("/by-student/{userStudentId}")
    public ResponseEntity<?> getByStudent(@PathVariable Long userStudentId) {
        return ResponseEntity.ok(betReportDataRepository.findByUserStudentUserStudentId(userStudentId));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!betReportDataRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        betReportDataRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    // ═══════════════════════ DOWNLOAD REPORT (HTML) ═══════════════════════

    @GetMapping("/download/{userStudentId}/{assessmentId}")
    public ResponseEntity<?> downloadReport(
            @PathVariable Long userStudentId,
            @PathVariable Long assessmentId) {
        Optional<BetReportData> opt = betReportDataRepository
                .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        if (opt.isEmpty() || opt.get().getReportUrl() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "No generated report found for this student"));
        }
        BetReportData rd = opt.get();
        byte[] htmlBytes = digitalOceanSpacesService.downloadFileByUrl(rd.getReportUrl());
        if (htmlBytes == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to download report file"));
        }
        // Inline all images as base64 data URIs so the HTML is self-contained
        String html = inlineImages(new String(htmlBytes, StandardCharsets.UTF_8));

        String safeName = (rd.getStudentName() != null ? rd.getStudentName() : "report")
                .replaceAll("[^a-zA-Z0-9_\\- ]", "").replaceAll("\\s+", "_");
        String fileName = safeName + "_bet_report.html";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
        return new ResponseEntity<>(html.getBytes(StandardCharsets.UTF_8), headers, HttpStatus.OK);
    }

    // ═══════════════════════ BATCH DOWNLOAD (HTML files) ═══════════════════════

    /**
     * POST /bet-report-data/download-zip
     * Body: { "assessmentId": 5, "userStudentIds": [1, 2, 3] }
     *
     * Returns report URLs for the given students (frontend handles PDF conversion + ZIP).
     */
    @PostMapping("/download-zip")
    public ResponseEntity<?> downloadZipInfo(@RequestBody Map<String, Object> request) {
        if (!request.containsKey("assessmentId") || !request.containsKey("userStudentIds")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "assessmentId and userStudentIds are required"));
        }
        Long assessmentId = ((Number) request.get("assessmentId")).longValue();
        @SuppressWarnings("unchecked")
        List<Number> idList = (List<Number>) request.get("userStudentIds");

        List<Map<String, Object>> reports = new ArrayList<>();
        for (Number idNum : idList) {
            Long userStudentId = idNum.longValue();
            Optional<BetReportData> opt = betReportDataRepository
                    .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
            if (opt.isEmpty() || opt.get().getReportUrl() == null) continue;
            BetReportData rd = opt.get();
            String safeName = (rd.getStudentName() != null ? rd.getStudentName() : "student_" + userStudentId)
                    .replaceAll("[^a-zA-Z0-9_\\- ]", "").replaceAll("\\s+", "_");
            reports.add(Map.of(
                    "userStudentId", userStudentId,
                    "studentName", safe(rd.getStudentName()),
                    "fileName", safeName + "_" + userStudentId + "_bet_report",
                    "reportUrl", rd.getReportUrl()
            ));
        }
        if (reports.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "No generated reports found"));
        }
        return ResponseEntity.ok(Map.of("reports", reports));
    }

    // ═══════════════════════ EXCEL EXPORT ═══════════════════════

    @GetMapping("/export-excel/{assessmentId}")
    public ResponseEntity<?> exportExcel(@PathVariable Long assessmentId) {
        try {
            List<BetReportData> reports = betReportDataRepository.findByAssessmentId(assessmentId);
            if (reports.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No BET report data found for this assessment"));
            }

            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("BET Report Data");

            // Header style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            // Header row
            String[] headers = {
                "student_name", "student_grade", "cog1", "cog2",
                "cog3", "cog3_description",
                "self_management_1", "self_management_2", "self_management_3",
                "social_insight", "environment",
                "value1", "value2", "value3", "value_overview"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                headerRow.createCell(i).setCellValue(headers[i]);
                headerRow.getCell(i).setCellStyle(headerStyle);
            }

            // Data rows
            int rowIdx = 1;
            for (BetReportData r : reports) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(safe(r.getStudentName()));
                row.createCell(1).setCellValue(safe(r.getStudentGrade()));
                row.createCell(2).setCellValue(safe(r.getCog1()));
                row.createCell(3).setCellValue(safe(r.getCog2()));
                row.createCell(4).setCellValue(safe(r.getCog3()));
                row.createCell(5).setCellValue(safe(r.getCog3Description()));
                row.createCell(6).setCellValue(safe(r.getSelfManagement1()));
                row.createCell(7).setCellValue(safe(r.getSelfManagement2()));
                row.createCell(8).setCellValue(safe(r.getSelfManagement3()));
                row.createCell(9).setCellValue(safe(r.getSocialInsight()));
                row.createCell(10).setCellValue(safe(r.getEnvironment()));
                row.createCell(11).setCellValue(safe(r.getValue1()));
                row.createCell(12).setCellValue(safe(r.getValue2()));
                row.createCell(13).setCellValue(safe(r.getValue3()));
                row.createCell(14).setCellValue(safe(r.getValueOverview()));
            }

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            workbook.close();

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            responseHeaders.setContentDispositionFormData("attachment", "bet_report_data.xlsx");
            responseHeaders.setContentLength(out.size());

            return new ResponseEntity<>(out.toByteArray(), responseHeaders, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Export failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════ MQ/MQT SCORE EXPORT ═══════════════════════

    /**
     * POST /bet-report-data/export-mqt-scores
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     * If userStudentIds is empty or absent, exports all students for the assessment.
     *
     * Exports an Excel file with columns:
     * Student Name | Roll No | Grade | Section | [MQ1: MQT1] | [MQ1: MQT2] | ... | [MQ2: MQT3] | ...
     */
    @PostMapping("/export-mqt-scores")
    public ResponseEntity<?> exportMqtScores(@RequestBody Map<String, Object> request) {
        try {
            if (!request.containsKey("assessmentId")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assessmentId is required"));
            }
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();

            // 1. Get student mappings for this assessment
            List<StudentAssessmentMapping> allMappings = studentAssessmentMappingRepository.findAllByAssessmentId(assessmentId);
            if (allMappings.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No student mappings found for this assessment"));
            }

            // 2. Filter by selected student IDs if provided
            @SuppressWarnings("unchecked")
            List<Number> selectedIds = (List<Number>) request.get("userStudentIds");
            if (selectedIds != null && !selectedIds.isEmpty()) {
                java.util.Set<Long> selectedSet = selectedIds.stream()
                        .map(Number::longValue).collect(Collectors.toSet());
                allMappings = allMappings.stream()
                        .filter(m -> selectedSet.contains(m.getUserStudent().getUserStudentId()))
                        .collect(Collectors.toList());
            }

            if (allMappings.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No matching students found"));
            }

            // 3. Get all active MQTs grouped by their parent MQ
            List<MeasuredQualityTypes> allMqts = measuredQualityTypesRepository.findByIsDeletedFalseOrIsDeletedIsNull();

            // Group MQTs by MQ, maintaining order
            LinkedHashMap<String, List<MeasuredQualityTypes>> mqToMqts = new LinkedHashMap<>();
            for (MeasuredQualityTypes mqt : allMqts) {
                String mqName = mqt.getMeasuredQuality() != null
                        ? safe(mqt.getMeasuredQuality().getQualityDisplayName() != null
                            ? mqt.getMeasuredQuality().getQualityDisplayName()
                            : mqt.getMeasuredQuality().getMeasuredQualityName())
                        : "Ungrouped";
                mqToMqts.computeIfAbsent(mqName, k -> new ArrayList<>()).add(mqt);
            }

            // 4. Build ordered list of MQT columns
            List<MeasuredQualityTypes> orderedMqts = new ArrayList<>();
            List<String> mqtColumnHeaders = new ArrayList<>();
            for (Map.Entry<String, List<MeasuredQualityTypes>> entry : mqToMqts.entrySet()) {
                String mqName = entry.getKey();
                for (MeasuredQualityTypes mqt : entry.getValue()) {
                    orderedMqts.add(mqt);
                    String mqtName = mqt.getMeasuredQualityTypeDisplayName() != null
                            ? mqt.getMeasuredQualityTypeDisplayName()
                            : mqt.getMeasuredQualityTypeName();
                    mqtColumnHeaders.add(mqName + ": " + safe(mqtName));
                }
            }

            // 5. Bulk-fetch all raw scores for these mappings
            List<Long> mappingIds = allMappings.stream()
                    .map(StudentAssessmentMapping::getStudentAssessmentId)
                    .collect(Collectors.toList());
            List<AssessmentRawScore> allScores = assessmentRawScoreRepository
                    .findByStudentAssessmentMappingStudentAssessmentIdIn(mappingIds);

            // Index scores by (mappingId -> mqtId -> rawScore)
            Map<Long, Map<Long, Integer>> scoreIndex = new HashMap<>();
            for (AssessmentRawScore score : allScores) {
                Long mapId = score.getStudentAssessmentMapping().getStudentAssessmentId();
                Long mqtId = score.getMeasuredQualityType() != null
                        ? score.getMeasuredQualityType().getMeasuredQualityTypeId() : null;
                if (mqtId != null) {
                    scoreIndex.computeIfAbsent(mapId, k -> new HashMap<>())
                            .put(mqtId, score.getRawScore());
                }
            }

            // 6. Build Excel
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("MQ-MQT Scores");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            // Header row: Student Name | Roll No | Grade | Section | [MQT columns...]
            List<String> baseHeaders = List.of("Student Name", "Roll No", "Grade", "Section");
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < baseHeaders.size(); i++) {
                headerRow.createCell(i).setCellValue(baseHeaders.get(i));
                headerRow.getCell(i).setCellStyle(headerStyle);
            }
            for (int i = 0; i < mqtColumnHeaders.size(); i++) {
                int col = baseHeaders.size() + i;
                headerRow.createCell(col).setCellValue(mqtColumnHeaders.get(i));
                headerRow.getCell(col).setCellStyle(headerStyle);
            }

            // Data rows
            int rowIdx = 1;
            for (StudentAssessmentMapping mapping : allMappings) {
                UserStudent us = mapping.getUserStudent();
                StudentInfo si = us.getStudentInfo();
                Row row = sheet.createRow(rowIdx++);

                row.createCell(0).setCellValue(safe(si != null ? si.getName() : ""));
                row.createCell(1).setCellValue(safe(si != null ? si.getSchoolRollNumber() : ""));
                row.createCell(2).setCellValue(resolveGrade(si));
                row.createCell(3).setCellValue(resolveSection(si));

                Map<Long, Integer> studentScores = scoreIndex.getOrDefault(
                        mapping.getStudentAssessmentId(), Map.of());
                for (int i = 0; i < orderedMqts.size(); i++) {
                    Long mqtId = orderedMqts.get(i).getMeasuredQualityTypeId();
                    Integer score = studentScores.get(mqtId);
                    row.createCell(baseHeaders.size() + i).setCellValue(score != null ? score : 0);
                }
            }

            // Auto-size first 4 columns
            for (int i = 0; i < baseHeaders.size(); i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            workbook.close();

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            responseHeaders.setContentDispositionFormData("attachment", "mqt_scores_export.xlsx");
            responseHeaders.setContentLength(out.size());

            return new ResponseEntity<>(out.toByteArray(), responseHeaders, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Export failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════ GENERATE & SAVE ═══════════════════════

    /**
     * POST /bet-report-data/generate
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     *
     * For each student: fetches answers + rawScores + game results,
     * computes BET report fields, and upserts into bet_report_data.
     */
    @PostMapping("/generate")
    @Transactional
    public ResponseEntity<?> generateAndSave(@RequestBody Map<String, Object> request) {
        try {
            // 1. Parse request
            if (!request.containsKey("assessmentId") || !request.containsKey("userStudentIds")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assessmentId and userStudentIds are required"));
            }
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> idList = (List<Number>) request.get("userStudentIds");

            // 2. Validate assessment is BET type
            Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(assessmentId);
            if (assessmentOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Assessment not found"));
            }
            AssessmentTable assessment = assessmentOpt.get();
            if (assessment.getQuestionnaire() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Assessment has no linked questionnaire"));
            }
            Boolean qType = assessment.getQuestionnaire().getType();
            if (qType == null || !qType) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Assessment is not a BET type"));
            }

            // 3. Process each student
            List<BetReportData> saved = new ArrayList<>();
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Number idNum : idList) {
                Long userStudentId = idNum.longValue();
                try {
                    BetReportData report = generateForStudent(userStudentId, assessmentId);
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
                    .body(Map.of("error", "Failed to generate BET report data: " + e.getMessage()));
        }
    }

    // ═══════════════════════ GENERATE LIVE (calculates raw scores from answers) ═══════════════════════

    /**
     * POST /bet-report-data/generate-live
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     *
     * Same as /generate but calculates raw scores live from answers
     * instead of reading from assessment_raw_score table.
     */
    @PostMapping("/generate-live")
    @Transactional
    public ResponseEntity<?> generateLiveAndSave(@RequestBody Map<String, Object> request) {
        try {
            if (!request.containsKey("assessmentId") || !request.containsKey("userStudentIds")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assessmentId and userStudentIds are required"));
            }
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> idList = (List<Number>) request.get("userStudentIds");

            Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(assessmentId);
            if (assessmentOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Assessment not found"));
            }
            AssessmentTable assessment = assessmentOpt.get();
            if (assessment.getQuestionnaire() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Assessment has no linked questionnaire"));
            }
            Boolean qType = assessment.getQuestionnaire().getType();
            if (qType == null || !qType) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Assessment is not a BET type"));
            }

            List<BetReportData> saved = new ArrayList<>();
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Number idNum : idList) {
                Long userStudentId = idNum.longValue();
                try {
                    BetReportData report = generateForStudentLive(userStudentId, assessmentId);
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
                    .body(Map.of("error", "Failed to generate BET report data: " + e.getMessage()));
        }
    }

    private BetReportData generateForStudentLive(Long userStudentId, Long assessmentId) {
        UserStudent us = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new RuntimeException("Student not found: " + userStudentId));

        Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        if (mappingOpt.isEmpty() || !"completed".equals(mappingOpt.get().getStatus())) {
            return null;
        }

        StudentInfo si = us.getStudentInfo();
        String studentName = (si != null && si.getName() != null) ? si.getName() : "";
        String studentGrade = resolveGrade(si);

        // Fetch all answers with option scores loaded
        var answers = assessmentAnswerRepository
                .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

        // Calculate raw scores LIVE from answers
        // Each option may have DUPLICATE score rows for the same MQT.
        // Take only the FIRST score per MQT per answer (matches /submit behavior).
        Map<Long, Integer> liveRawScores = new HashMap<>();
        for (AssessmentAnswer aa : answers) {
            var option = aa.getOption() != null ? aa.getOption() : aa.getMappedOption();
            if (option == null || option.getOptionScores() == null) continue;
            // Track which MQT IDs we've already counted for THIS answer
            java.util.Set<Long> seenMqtsForThisAnswer = new java.util.HashSet<>();
            for (OptionScoreBasedOnMEasuredQualityTypes os : option.getOptionScores()) {
                if (os.getMeasuredQualityType() != null && os.getScore() != null) {
                    long mqtId = os.getMeasuredQualityType().getMeasuredQualityTypeId();
                    if (seenMqtsForThisAnswer.add(mqtId)) {
                        // First occurrence of this MQT for this answer — count it
                        liveRawScores.merge(mqtId, os.getScore(), Integer::sum);
                    }
                }
            }
        }

        // DEBUG: log live scores
        System.out.println("=== LIVE RAW SCORES for student " + userStudentId + " ===");
        liveRawScores.forEach((mqtId, score) ->
                System.out.println("  MQT ID=" + mqtId + " liveScore=" + score));

        // Compute fields using live scores
        String sm1 = computeSelfEfficacyLive(liveRawScores);
        String sm2 = computeSelfRegulationLive(liveRawScores);
        String sm3 = computeEmotionRegulationLive(liveRawScores);
        String socialInsight = computeSocialInsightLive(liveRawScores);
        String env = computeEnvironmentalAwareness(answers);
        String[] values = computeTopValues(answers);
        String[] cognitive = computeCognitive(userStudentId);

        // Upsert: preserve reportStatus/reportUrl if re-generating data
        Optional<BetReportData> existingOpt = betReportDataRepository
                .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        String prevReportStatus = null;
        String prevReportUrl = null;
        if (existingOpt.isPresent()) {
            prevReportStatus = existingOpt.get().getReportStatus();
            prevReportUrl = existingOpt.get().getReportUrl();
            betReportDataRepository.deleteByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
            betReportDataRepository.flush();
        }

        BetReportData report = new BetReportData();
        report.setUserStudent(us);
        report.setAssessmentId(assessmentId);
        report.setStudentName(studentName);
        report.setStudentGrade(studentGrade);
        report.setCog1(cognitive[0]);
        report.setCog2(cognitive[1]);
        report.setCog3(cognitive[2]);
        report.setCog3Description(cognitive[3]);
        report.setSelfManagement1(sm1);
        report.setSelfManagement2(sm2);
        report.setSelfManagement3(sm3);
        report.setEnvironment(env);
        report.setValue1(values[0]);
        report.setValue2(values[1]);
        report.setValue3(values[2]);
        report.setValueOverview(buildValueOverview(values));
        report.setSocialInsight(socialInsight);

        // Preserve previous report generation state
        if (prevReportStatus != null) {
            report.setReportStatus(prevReportStatus);
            report.setReportUrl(prevReportUrl);
        }

        return betReportDataRepository.save(report);
    }

    // ── Live score interpreters (use Map<mqtId, score> instead of AssessmentRawScore) ──

    private String computeSelfEfficacyLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_SELF_EFFICACY, 0);
        // Fallback to lowest tier if below threshold (no blanks)
        if (score <= 14) return "Your child often doubts their abilities and may want to give up quickly because they worry they aren't \"naturally good\" at a task.";
        else if (score <= 18) return "Your child feels confident with things they already know but might need a little extra encouragement to try something brand new or difficult.";
        else return "Your child has a \"can-do\" attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough";
    }

    private String computeSelfRegulationLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_SELF_MANAGEMENT, 0);
        if (score <= 11) return "Your child finds it difficult to manage impulses or stay quiet when asked, often needing an adult's help to stay organized and finish tasks.";
        else if (score <= 15) return "Your child generally follows rules well but can get distracted or impulsive when they are very excited or in a noisy environment.";
        else return "Your child shows great independence, staying focused on their work even if it's a bit boring and waiting patiently for their turn.";
    }

    private String computeEmotionRegulationLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_EMOTION_REGULATION, 0);
        if (score <= 9) return "Your child often feels overwhelmed by \"big\" feelings like anger or worry and may find it hard to explain exactly why they are upset.";
        else if (score <= 12) return "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.";
        else return "Your child is very aware of their emotions, knows how to cheer themselves up when sad, and shows a kind understanding of why friends might be upset.";
    }

    private String computeSocialInsightLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_SOCIAL_INSIGHT, 0);
        if (score <= 6) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Literal Thinker.\" He/She may find sarcasm or \"polite lies\" confusing.";
        else if (score <= 12) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Social Detective.\" He/She can tell the difference between mistakes and mean intent.";
        else return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Mind Reader.\" He/She picks up on subtle hints and complex social layers.";
    }

    // ═══════════════════════ GENERATE HTML REPORTS ═══════════════════════

    /**
     * POST /bet-report-data/generate-reports
     * Body: { "assessmentId": 123, "userStudentIds": [1, 2, 3] }
     *
     * For each student: reads bet_report_data, fills the combined.html template,
     * uploads to DigitalOcean Spaces, and updates reportStatus/reportUrl.
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

            // Read the HTML template
            String template = loadHtmlTemplate();
            if (template == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Could not load HTML template"));
            }

            List<Map<String, Object>> results = new ArrayList<>();
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Number idNum : idList) {
                Long userStudentId = idNum.longValue();
                try {
                    Optional<BetReportData> reportOpt = betReportDataRepository
                            .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
                    if (reportOpt.isEmpty()) {
                        errors.add(Map.of("userStudentId", userStudentId,
                                "reason", "No report data found. Generate report data first."));
                        continue;
                    }

                    BetReportData report = reportOpt.get();

                    // Fill template with report data
                    String filledHtml = fillTemplate(template, report);

                    // Upload to DigitalOcean Spaces
                    String safeName = (report.getStudentName() != null ? report.getStudentName() : "student")
                            .replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
                    String fileName = safeName + "_" + userStudentId + "_bet_report.html";
                    String folder = "bet-reports/assessment-" + assessmentId;

                    try {
                        String reportUrl = digitalOceanSpacesService.uploadBytes(
                                filledHtml.getBytes(StandardCharsets.UTF_8),
                                "text/html",
                                folder,
                                fileName
                        );

                        report.setReportStatus("generated");
                        report.setReportUrl(reportUrl);
                        betReportDataRepository.save(report);

                        results.add(Map.of(
                                "userStudentId", userStudentId,
                                "studentName", safe(report.getStudentName()),
                                "reportUrl", reportUrl
                        ));
                    } catch (Exception uploadEx) {
                        String dataUri = "data:text/html;base64," + Base64.getEncoder().encodeToString(filledHtml.getBytes(StandardCharsets.UTF_8));
                        results.add(Map.of(
                                "userStudentId", userStudentId,
                                "studentName", safe(report.getStudentName()),
                                "reportUrl", dataUri,
                                "fileName", fileName,
                                "downloadFallback", true
                        ));
                    }
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

    // ═══════════════════════ UPLOAD TEMPLATE ASSETS TO DO SPACES ═══════════════════════

    /**
     * POST /bet-report-data/upload-template-assets
     *
     * One-time operation: reads all template assets from classpath (bet-template/assets/*)
     * and uploads them to DigitalOcean Spaces under bet-template-assets/.
     */
    @PostMapping("/upload-template-assets")
    public ResponseEntity<?> uploadTemplateAssets() {
        try {
            String[] assetPaths = {
                "assets/cover/img.png",
                "assets/cover/col.png",
                "assets/cover/career.png",
                "assets/report-details/card-img1.png",
                "assets/report-details/card-img2.png",
                "assets/report-details/card-img3.png",
                "assets/report-details/card-img4.png",
                "assets/report-details/card-left-img.png",
                "assets/report-details/graphic1.svg",
                "assets/report-details/graphic2.svg",
                "assets/closing/card-img1.png",
                "assets/closing/card-img2.png",
                "assets/closing/card-img3.png",
                "assets/closing/card-left-img.png",
                "assets/closing/card-left-group.png",
                "assets/closing/graphic.svg",
                "assets/closing/card-graphic.svg",
                "assets/graphic.svg",
                "assets/cog-2-assets/attentive.png",
                "assets/cog-2-assets/distracted.png",
                "assets/cog-2-assets/inattentive.png",
                "assets/cog-2-assets/inconsistent.png",
                "assets/cog-2-assets/detached.png",
                "assets/cog-2-assets/vigilant.png",
                "assets/closing/qr-code.png",
            };

            List<String> uploaded = new ArrayList<>();
            List<String> failed = new ArrayList<>();

            for (String assetPath : assetPaths) {
                try {
                    var is = getClass().getClassLoader()
                            .getResourceAsStream("bet-template/" + assetPath);
                    if (is == null) {
                        failed.add(assetPath + " (not found in classpath)");
                        continue;
                    }
                    byte[] bytes = is.readAllBytes();
                    is.close();

                    String contentType = guessContentType(assetPath);
                    String fileName = assetPath.substring(assetPath.lastIndexOf('/') + 1);
                    String folder = "bet-template-assets/" + assetPath.substring(0, assetPath.lastIndexOf('/'));

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
        if (path.endsWith(".gif")) return "image/gif";
        if (path.endsWith(".ttf")) return "font/ttf";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    // ═══════════════════════ TEMPLATE HELPERS ═══════════════════════

    private String loadHtmlTemplate() {
        try {
            var is = getClass().getClassLoader().getResourceAsStream("bet-template/combined.html");
            if (is != null) {
                String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                is.close();
                return content;
            }
        } catch (Exception e) {
            System.err.println("Failed to read template from classpath: " + e.getMessage());
        }
        return null;
    }

    private String fillTemplate(String template, BetReportData r) {
        // Asset base URL on DO Spaces (uploaded separately)
        String assetBase = "https://storage-c9.sgp1.digitaloceanspaces.com/bet-template-assets";

        String html = template;

        // Replace student info
        html = html.replace("{{studentName}}", safe(r.getStudentName()));
        html = html.replace("{{studentGrade}}", safe(r.getStudentGrade()));

        // Cognitive fields
        // cog1 contains the full flexibility description
        html = html.replace("{{cog1}}", safe(r.getCog1()));

        // cog2 is the attention category (e.g., "Attentive", "Distracted")
        // The image src uses {{cog2}}.png pattern — build absolute URL directly
        String attentionCategory = safe(r.getCog2()).toLowerCase();
        html = html.replace("{{cog2}}.png", assetBase + "/assets/cog-2-assets/" + attentionCategory + ".png");
        html = html.replace("{{cog_2_label}}", safe(r.getCog2()));

        // cog3 is working memory category, cog3Description is the interpretation
        html = html.replace("{{cog_3}}", safe(r.getCog3()));
        html = html.replace("{{cognitive_3_description}}", safe(r.getCog3Description()));

        // Self management
        html = html.replace("{{self_management_1}}", safe(r.getSelfManagement1()));
        html = html.replace("{{self_management_2}}", safe(r.getSelfManagement2()));
        html = html.replace("{{self_management_3}}", safe(r.getSelfManagement3()));

        // Social insight
        html = html.replace("{{social_insight}}", safe(r.getSocialInsight()));

        // Environment
        html = html.replace("{{environment}}", safe(r.getEnvironment()));

        // Values
        html = html.replace("{{value_overview}}", safe(r.getValueOverview()));

        // Replace relative asset paths with absolute DO Spaces URLs
        html = html.replace("src=\"assets/", "src=\"" + assetBase + "/assets/");
        html = html.replace("data=\"assets/", "data=\"" + assetBase + "/assets/");
        html = html.replace("url(assets/", "url(" + assetBase + "/assets/");
        html = html.replace("url(fonts/", "url(" + assetBase + "/fonts/");

        return html;
    }

    // ═══════════════════════ FILL MISSING RANKING ANSWERS ═══════════════════════

    /**
     * POST /bet-report-data/fill-missing-ranks
     * Body: { "assessmentId": 5, "questionnaireQuestionId": 40, "valueOptionIds": [272,...,280], "maxRanks": 3 }
     *
     * For each completed student in this assessment who has entries in assessment_answer:
     * - Checks which ranks (1..maxRanks) they already have for this question
     * - For missing ranks, randomly picks from unused value options and inserts answers
     */
    @PostMapping("/fill-missing-ranks")
    @Transactional
    public ResponseEntity<?> fillMissingRanks(@RequestBody Map<String, Object> request) {
        try {
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();
            Long qqId = ((Number) request.get("questionnaireQuestionId")).longValue();
            @SuppressWarnings("unchecked")
            List<Number> optIdNums = (List<Number>) request.get("valueOptionIds");
            int maxRanks = request.containsKey("maxRanks") ? ((Number) request.get("maxRanks")).intValue() : 3;

            List<Long> allValueOptionIds = new ArrayList<>();
            for (Number n : optIdNums) allValueOptionIds.add(n.longValue());

            // Load entities once
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));
            QuestionnaireQuestion qq = questionnaireQuestionRepository.findById(qqId)
                    .orElseThrow(() -> new RuntimeException("QuestionnaireQuestion not found"));

            Map<Long, AssessmentQuestionOptions> optionCache = new HashMap<>();
            for (Long optId : allValueOptionIds) {
                assessmentQuestionOptionsRepository.findById(optId)
                        .ifPresent(opt -> optionCache.put(optId, opt));
            }

            // Get all completed mappings
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findAllByAssessmentId(assessmentId);

            int studentsProcessed = 0;
            int answersInserted = 0;
            List<Map<String, Object>> details = new ArrayList<>();

            for (StudentAssessmentMapping mapping : mappings) {
                if (!"completed".equals(mapping.getStatus())) continue;

                Long userStudentId = mapping.getUserStudent().getUserStudentId();
                UserStudent us = mapping.getUserStudent();

                // Check this student has ANY answers (only process those with entries)
                var allAnswers = assessmentAnswerRepository
                        .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);
                if (allAnswers == null || allAnswers.isEmpty()) continue;

                // Find existing ranking answers for this question
                java.util.Set<Integer> existingRanks = new java.util.HashSet<>();
                java.util.Set<Long> usedOptionIds = new java.util.HashSet<>();
                for (var aa : allAnswers) {
                    if (aa.getRankOrder() != null && aa.getQuestionnaireQuestion() != null
                            && aa.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(qqId)) {
                        existingRanks.add(aa.getRankOrder());
                        var opt = aa.getOption() != null ? aa.getOption() : aa.getMappedOption();
                        if (opt != null) usedOptionIds.add(opt.getOptionId());
                    }
                }

                // Find missing ranks
                List<Integer> missingRanks = new ArrayList<>();
                for (int r = 1; r <= maxRanks; r++) {
                    if (!existingRanks.contains(r)) missingRanks.add(r);
                }
                if (missingRanks.isEmpty()) continue;

                // Available options (not already used by this student)
                List<Long> available = new ArrayList<>();
                for (Long optId : allValueOptionIds) {
                    if (!usedOptionIds.contains(optId)) available.add(optId);
                }
                java.util.Collections.shuffle(available);

                int filled = 0;
                for (int i = 0; i < missingRanks.size() && i < available.size(); i++) {
                    Long optId = available.get(i);
                    AssessmentQuestionOptions opt = optionCache.get(optId);
                    if (opt == null) continue;

                    AssessmentAnswer newAnswer = new AssessmentAnswer();
                    newAnswer.setUserStudent(us);
                    newAnswer.setAssessment(assessment);
                    newAnswer.setQuestionnaireQuestion(qq);
                    newAnswer.setOption(opt);
                    newAnswer.setRankOrder(missingRanks.get(i));
                    assessmentAnswerRepository.save(newAnswer);
                    filled++;
                    answersInserted++;
                }

                studentsProcessed++;
                details.add(Map.of(
                        "userStudentId", userStudentId,
                        "existingRanks", existingRanks.toString(),
                        "filledRanks", missingRanks.subList(0, Math.min(filled, missingRanks.size())).toString()
                ));
            }

            Map<String, Object> response = new HashMap<>();
            response.put("studentsProcessed", studentsProcessed);
            response.put("answersInserted", answersInserted);
            response.put("details", details);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Fill missing ranks failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════ RECALCULATE RAW SCORES ═══════════════════════

    /**
     * POST /bet-report-data/recalculate-raw-scores
     * Body: { "assessmentId": 123 }
     *
     * For every completed student mapping in this assessment:
     * - Fetches answers with option scores
     * - Recalculates raw score per MQT (deduped: first score per MQT per answer)
     * - Deletes old assessment_raw_score rows and saves fresh ones
     */
    @PostMapping("/recalculate-raw-scores")
    @Transactional
    public ResponseEntity<?> recalculateRawScores(@RequestBody Map<String, Object> request) {
        try {
            if (!request.containsKey("assessmentId")) {
                return ResponseEntity.badRequest().body(Map.of("error", "assessmentId is required"));
            }
            Long assessmentId = ((Number) request.get("assessmentId")).longValue();

            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findAllByAssessmentId(assessmentId);

            int updated = 0;
            List<Map<String, Object>> errors = new ArrayList<>();

            for (StudentAssessmentMapping mapping : mappings) {
                if (!"completed".equals(mapping.getStatus())) continue;

                Long userStudentId = mapping.getUserStudent().getUserStudentId();
                Long mappingId = mapping.getStudentAssessmentId();

                try {
                    // Fetch answers with full option score details
                    var answers = assessmentAnswerRepository
                            .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

                    // Calculate live raw scores: dedup per MQT per answer
                    Map<Long, Integer> liveScores = new HashMap<>();
                    for (AssessmentAnswer aa : answers) {
                        var option = aa.getOption() != null ? aa.getOption() : aa.getMappedOption();
                        if (option == null || option.getOptionScores() == null) continue;

                        java.util.Set<Long> seenMqts = new java.util.HashSet<>();
                        for (OptionScoreBasedOnMEasuredQualityTypes os : option.getOptionScores()) {
                            if (os.getMeasuredQualityType() != null && os.getScore() != null) {
                                long mqtId = os.getMeasuredQualityType().getMeasuredQualityTypeId();
                                if (seenMqts.add(mqtId)) {
                                    liveScores.merge(mqtId, os.getScore(), Integer::sum);
                                }
                            }
                        }
                    }

                    // Delete old raw scores for this mapping
                    assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(mappingId);

                    // Save fresh raw scores
                    for (Map.Entry<Long, Integer> entry : liveScores.entrySet()) {
                        Long mqtId = entry.getKey();
                        Integer score = entry.getValue();

                        MeasuredQualityTypes mqt = measuredQualityTypesRepository.findById(mqtId).orElse(null);
                        if (mqt == null) continue;

                        AssessmentRawScore rawScore = new AssessmentRawScore();
                        rawScore.setStudentAssessmentMapping(mapping);
                        rawScore.setMeasuredQualityType(mqt);
                        rawScore.setMeasuredQuality(mqt.getMeasuredQuality());
                        rawScore.setRawScore(score);
                        assessmentRawScoreRepository.save(rawScore);
                    }

                    updated++;
                } catch (Exception e) {
                    errors.add(Map.of("userStudentId", userStudentId, "reason", e.getMessage()));
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("updated", updated);
            response.put("totalMappings", mappings.size());
            response.put("errors", errors);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Recalculation failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════ CORE LOGIC ═══════════════════════

    private BetReportData generateForStudent(Long userStudentId, Long assessmentId) {
        // 1. Fetch student
        UserStudent us = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new RuntimeException("Student not found: " + userStudentId));

        // 2. Check completed assessment
        Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        if (mappingOpt.isEmpty() || !"completed".equals(mappingOpt.get().getStatus())) {
            return null;
        }

        // 3. Get student name and grade
        StudentInfo si = us.getStudentInfo();
        String studentName = (si != null && si.getName() != null) ? si.getName() : "";
        String studentGrade = resolveGrade(si);

        // 4. Fetch answers and raw scores
        var answers = assessmentAnswerRepository
                .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);
        List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                .findByStudentAssessmentMappingStudentAssessmentId(
                        mappingOpt.get().getStudentAssessmentId());

        // DEBUG: log raw scores for this student
        System.out.println("=== RAW SCORES for student " + userStudentId + " (mappingId=" + mappingOpt.get().getStudentAssessmentId() + ") ===");
        System.out.println("Raw scores count: " + rawScores.size());
        for (AssessmentRawScore rs : rawScores) {
            Long mqtId = rs.getMeasuredQualityType() != null ? rs.getMeasuredQualityType().getMeasuredQualityTypeId() : null;
            String mqtName = rs.getMeasuredQualityType() != null ? rs.getMeasuredQualityType().getMeasuredQualityTypeName() : "null";
            System.out.println("  MQT ID=" + mqtId + " name=" + mqtName + " rawScore=" + rs.getRawScore());
        }

        // 5. Compute self-management fields from rawScores
        String sm1 = computeSelfEfficacy(rawScores);
        String sm2 = computeSelfRegulation(rawScores);
        String sm3 = computeEmotionRegulation(rawScores);

        // 6. Compute social insight from rawScores
        String socialInsight = computeSocialInsight(rawScores);

        // 7. Compute environmental awareness from answers
        String env = computeEnvironmentalAwareness(answers);

        // 8. Compute top 3 values from answers (ranking questions)
        String[] values = computeTopValues(answers);

        // 9. Compute cognitive fields from Firebase game results
        String[] cognitive = computeCognitive(userStudentId);

        // 10. Upsert: delete existing then save new
        betReportDataRepository.deleteByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        BetReportData report = new BetReportData();
        report.setUserStudent(us);
        report.setAssessmentId(assessmentId);
        report.setStudentName(studentName);
        report.setStudentGrade(studentGrade);
        report.setCog1(cognitive[0]);   // cognitive flexibility style
        report.setCog2(cognitive[1]);   // attention category
        report.setCog3(cognitive[2]);   // working memory category
        report.setCog3Description(cognitive[3]); // working memory interpretation
        report.setSelfManagement1(sm1);
        report.setSelfManagement2(sm2);
        report.setSelfManagement3(sm3);
        report.setEnvironment(env);
        report.setValue1(values[0]);
        report.setValue2(values[1]);
        report.setValue3(values[2]);
        report.setValueOverview(buildValueOverview(values));
        report.setSocialInsight(socialInsight);

        return betReportDataRepository.save(report);
    }

    private String buildValueOverview(String[] values) {
        String v1 = (values[0] != null && !values[0].isEmpty()) ? values[0] : "";
        String v2 = (values[1] != null && !values[1].isEmpty()) ? values[1] : "";
        String v3 = (values[2] != null && !values[2].isEmpty()) ? values[2] : "";
        if (v1.isEmpty() && v2.isEmpty() && v3.isEmpty()) return "";
        return "Your child's top choices form an Internal Compass of " + v1 + ", " + v2 + ", and " + v3
                + ". As primary motivators, supporting these specific values nurtures your child's confidence, emotional growth, and ability to build empathetic connections.";
    }

    // ═══════════════════════ SCORE INTERPRETERS ═══════════════════════

    private String computeSelfEfficacy(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_SELF_EFFICACY);
        if (score <= 14) return "Your child often doubts their abilities and may want to give up quickly because they worry they aren’t \"naturally good\" at a task.";
        else if (score <= 18) return "Your child feels confident with things they already know but might need a little extra encouragement to try something brand new or difficult.";
        else return "Your child has a \"can-do\" attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough";
    }

    private String computeSelfRegulation(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_SELF_MANAGEMENT);
        if (score <= 11) return "Your child finds it difficult to manage impulses or stay quiet when asked, often needing an adult’s help to stay organized and finish tasks.";
        else if (score <= 15) return "Your child generally follows rules well but can get distracted or impulsive when they are very excited or in a noisy environment.";
        else return "Your child shows great independence, staying focused on their work even if it’s a bit boring and waiting patiently for their turn.";
    }

    private String computeEmotionRegulation(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_EMOTION_REGULATION);
        if (score <= 9) return "Your child often feels overwhelmed by \"big\" feelings like anger or worry and may find it hard to explain exactly why they are upset.";
        else if (score <= 12) return "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.";
        else return "Your child is very aware of their emotions, knows how to cheer themselves up when sad, and shows a kind understanding of why friends might be upset.";
    }

    private String computeSocialInsight(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_SOCIAL_INSIGHT);
        if (score <= 6) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Literal Thinker.\" He/She may find sarcasm or \"polite lies\" confusing.";
        else if (score <= 12) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Social Detective.\" He/She can tell the difference between mistakes and mean intent.";
        else return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Mind Reader.\" He/She picks up on subtle hints and complex social layers.";
    }

    private String computeEnvironmentalAwareness(List<AssessmentAnswer> answers) {
        int friendly = 0;
        int unfriendly = 0;
        for (AssessmentAnswer aa : answers) {
            var option = aa.getOption() != null ? aa.getOption() : aa.getMappedOption();
            if (option == null || option.getOptionScores() == null) continue;
            for (OptionScoreBasedOnMEasuredQualityTypes os : option.getOptionScores()) {
                if (os.getMeasuredQualityType() != null
                        && os.getMeasuredQualityType().getMeasuredQuality() != null
                        && os.getMeasuredQualityType().getMeasuredQuality().getMeasuredQualityId() == MQ_ID_ENVIRONMENTAL_AWARENESS) {
                    if (os.getScore() != null && os.getScore() > 0) friendly++;
                    else if (os.getScore() != null && os.getScore() < 0) unfriendly++;
                }
            }
        }
        int net = friendly - unfriendly;
        if(net==-4) return "11%";
        else if(net==-3) return "22%";
        else if(net==-2) return "33%";
        else if(net==-1) return "44%";
        else if(net==0) return "55%";
        else if(net==1) return "66%";
        else if(net==2) return "77%";
        else if(net==3) return "88%";
        else if(net==4) return "100%";
        else return "";
    }

    private String[] computeTopValues(List<AssessmentAnswer> answers) {
        // Collect value names from ranking answers, keep best (lowest) rank per value
        Map<String, Integer> bestRankByValue = new HashMap<>();
        for (AssessmentAnswer aa : answers) {
            if (aa.getRankOrder() == null) continue;
            var option = aa.getOption() != null ? aa.getOption() : aa.getMappedOption();
            if (option == null || option.getOptionScores() == null) continue;
            for (OptionScoreBasedOnMEasuredQualityTypes os : option.getOptionScores()) {
                if (os.getMeasuredQualityType() != null
                        && os.getMeasuredQualityType().getMeasuredQuality() != null
                        && os.getMeasuredQualityType().getMeasuredQuality().getMeasuredQualityId() == MQ_ID_VALUES) {
                    String valueName = os.getMeasuredQualityType().getMeasuredQualityTypeName();
                    int rank = aa.getRankOrder();
                    if (!bestRankByValue.containsKey(valueName) || rank < bestRankByValue.get(valueName)) {
                        bestRankByValue.put(valueName, rank);
                    }
                }
            }
        }
        // Sort by rank ascending, take top 3
        List<Map.Entry<String, Integer>> sorted = new ArrayList<>(bestRankByValue.entrySet());
        sorted.sort(Map.Entry.comparingByValue());

        String[] result = {"", "", ""};
        for (int i = 0; i < Math.min(3, sorted.size()); i++) {
            result[i] = sorted.get(i).getKey();
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private String[] computeCognitive(Long userStudentId) {
        // cog1 = cognitive flexibility style, cog2 = attention category,
        // cog3 = working memory category, cog3_desc = working memory interpretation
        // Defaults: lowest-tier interpretations if no game data
        String[] result = {
            "Trial-and-Error Learning: Your child is highly persistent but may be feeling overwhelmed. They use physical action (tapping) to solve what they can't yet visualize.\n Visual Mapping: Teach them to 'scratchpad' a problem. Drawing out the puzzle on paper helps move thinking from impulsive tapping to visual planning.",
            "Distracted",
            "Unitary",
            "You are a 'Careful Processor.' You take your time to make sure things are right, but because your 'mental post-it note' is a bit small, you might feel overwhelmed if too much info comes at once.\n Chunk it up. Ask teachers to give you instructions one step at a time. Instead of trying to remember a whole paragraph, focus on one sentence, finish it, and then move to the next."
        };
        try {
            Map<String, Object> gameData = firebaseService.getDocument("game_results",
                    String.valueOf(userStudentId));
            if (gameData == null) return result;

            // Cognitive Flexibility (hydro_tube)
            Map<String, Object> hydroTube = (Map<String, Object>) gameData.get("hydro_tube");
            if (hydroTube != null) {
                double time = toDouble(hydroTube.get("timeSpentSeconds"));
                double aimless = toDouble(hydroTube.get("aimlessRotations"));
                result[0] = getCognitiveFlexibilityStyle(time, aimless);
            }

            // Attention (animal_reaction)
            Map<String, Object> animalReaction = (Map<String, Object>) gameData.get("animal_reaction");
            if (animalReaction != null) {
                int hits = toInt(animalReaction.get("hits"));
                int totalTargets = toInt(animalReaction.getOrDefault("targetsShown", 24));
                int falsePositives = toInt(animalReaction.get("falsePositives"));
                int totalTrials = toInt(animalReaction.getOrDefault("totalTrials", 120));
                int totalNonTargets = totalTrials - totalTargets;
                double dPrime = calculateDPrime(hits, totalTargets, falsePositives, totalNonTargets);
                result[1] = getAttentionCategory(dPrime);
            }

            // Working Memory (rabbit_path)
            Map<String, Object> rabbitPath = (Map<String, Object>) gameData.get("rabbit_path");
            if (rabbitPath != null) {
                int rawScore = toInt(rabbitPath.get("score"));
                result[2] = getWorkingMemoryCategory(rawScore);
                result[3] = getWorkingMemoryInterpretation(result[2]);
            }
        } catch (Exception e) {
            System.err.println("Error fetching game results for student " + userStudentId + ": " + e.getMessage());
        }
        return result;
    }

    // ═══════════════════════ HELPERS ═══════════════════════

    private int findRawScore(List<AssessmentRawScore> rawScores, long mqtId) {
        for (AssessmentRawScore rs : rawScores) {
            if (rs.getMeasuredQualityType() != null
                    && rs.getMeasuredQualityType().getMeasuredQualityTypeId() == mqtId) {
                return rs.getRawScore();
            }
        }
        return 0;
    }

    private String resolveGrade(StudentInfo si) {
        if (si == null || si.getSchoolSectionId() == null) return "";
        try {
            Optional<SchoolSections> sectionOpt = schoolSectionsRepository.findById(si.getSchoolSectionId());
            if (sectionOpt.isPresent() && sectionOpt.get().getSchoolClasses() != null) {
                return sectionOpt.get().getSchoolClasses().getClassName();
            }
        } catch (Exception e) {
            // ignore
        }
        return "";
    }

    private String resolveSection(StudentInfo si) {
        if (si == null || si.getSchoolSectionId() == null) return "";
        try {
            Optional<SchoolSections> sectionOpt = schoolSectionsRepository.findById(si.getSchoolSectionId());
            if (sectionOpt.isPresent()) {
                return safe(sectionOpt.get().getSectionName());
            }
        } catch (Exception e) {
            // ignore
        }
        return "";
    }

    // ── Cognitive classification functions (mirror frontend logic) ──

    private String getCognitiveFlexibilityStyle(double time, double aimlessClicks) {
        if (time < 90 && aimlessClicks < 2) return "High Mental Efficiency: Your child quickly visualizes the solution and executes it with precision. They have strong working memory.\n Challenge Them: Provide multi- step projects like robotics, coding, or strategy games (Chess) that require long-term planning.";
        if (time < 90 && aimlessClicks >= 2) return "Impulsive Agility: Your child has a quick mind but acts before a plan is formed. They rely on speed rather than strategy, leading to 'hurried' logic.\n The 'Pause' Rule: Ask them to 'explain the first two moves' out loud before they touch the screen. This builds the habit of thinking before acting.";
        if (time >= 90 && aimlessClicks < 2) return "Careful Accuracy: Your child prioritizes being 'correct' over 'fast.' They are internalizing the logic and double-checking their mental map.\n Build Fluency: Use timed 'fun' challenges with low stakes (like 'Beat the Clock' math) to reduce perfectionism and build confidence in quick thinking.";
        return "Trial-and-Error Learning: Your child is highly persistent but may be feeling overwhelmed. They use physical action (tapping) to solve what they can't yet visualize.\n Visual Mapping: Teach them to 'scratchpad' a problem. Drawing out the puzzle on paper helps move thinking from impulsive tapping to visual planning.";
    }

    private String getAttentionCategory(double dPrime) {
        if (dPrime >= 3.01) return "Vigilant";
        if (dPrime >= 1.51) return "Attentive";
        if (dPrime >= 0.51) return "Inconsistent";
        if (dPrime >= -0.50) return "Distracted";
        return "Detached";
    }

    private String getWorkingMemoryCategory(int rawScore) {
        if (rawScore >= 10 && rawScore <= 12) return "Multifaceted";
        if (rawScore >= 6 && rawScore <= 9) return "Sequential";
        return "Unitary";
    }

    private String getWorkingMemoryInterpretation(String category) {
        switch (category) {
            case "Multifaceted":
                return "You are a 'Great Collector.' You are excellent at gathering and remembering facts, but you find it tricky to 'flip' or change that information once it’s in your head.\n Slow down the 'flip.' When you get a list of tasks, write them down and then physically number them in the order you want to do them. Don't try to re-order things purely in your head.";
            case "Sequential":
                return "You are a 'Deep Voyager.' You can do great work when it’s quiet, but your 'mental workspace' is sensitive. When something moves or makes a noise, it 'bumps' the information out of your head. \n Clear your workspace. Use noise- canceling headphones or a 'study carrel' (desk dividers). Before starting a task, clear your screen or desk of anything that isn't related to the work.";
            case "Unitary":
                return "You are a 'Careful Processor.' You take your time to make sure things are right, but because your 'mental post-it note' is a bit small, you might feel overwhelmed if too much info comes at once.\n Chunk it up. Ask teachers to give you instructions one step at a time. Instead of trying to remember a whole paragraph, focus on one sentence, finish it, and then move to the next.";
            default:
                return "";
        }
    }

    private double calculateDPrime(int hits, int totalTargets, int falsePositives, int totalNonTargets) {
        double hitRate = Math.max(0.01, Math.min(0.99, (double) hits / Math.max(1, totalTargets)));
        double faRate = Math.max(0.01, Math.min(0.99, (double) falsePositives / Math.max(1, totalNonTargets)));
        return inverseCumulativeNormal(hitRate) - inverseCumulativeNormal(faRate);
    }

    /**
     * Rational approximation of the inverse cumulative normal distribution (probit).
     * Mirrors the frontend's rationalApproximation + normalInverse.
     */
    private double inverseCumulativeNormal(double p) {
        // Abramowitz & Stegun approximation
        double a1 = -3.969683028665376e+01;
        double a2 = 2.209460984245205e+02;
        double a3 = -2.759285104469687e+02;
        double a4 = 1.383577518672690e+02;
        double a5 = -3.066479806614716e+01;
        double a6 = 2.506628277459239e+00;

        double b1 = -5.447609879822406e+01;
        double b2 = 1.615858368580409e+02;
        double b3 = -1.556989798598866e+02;
        double b4 = 6.680131188771972e+01;
        double b5 = -1.328068155288572e+01;

        double c1 = -7.784894002430293e-03;
        double c2 = -3.223964580411365e-01;
        double c3 = -2.400758277161838e+00;
        double c4 = -2.549732539343734e+00;
        double c5 = 4.374664141464970e+00;
        double c6 = 2.938163982698780e+00;

        double d1 = 7.784695709041462e-03;
        double d2 = 3.224671290700398e-01;
        double d3 = 2.445134137142996e+00;
        double d4 = 3.754408661907416e+00;

        double pLow = 0.02425;
        double pHigh = 1.0 - pLow;

        double q, r;

        if (p < pLow) {
            q = Math.sqrt(-2.0 * Math.log(p));
            return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1.0);
        } else if (p <= pHigh) {
            q = p - 0.5;
            r = q * q;
            return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
                    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1.0);
        } else {
            q = Math.sqrt(-2.0 * Math.log(1.0 - p));
            return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1.0);
        }
    }

    private String safe(String value) {
        return value != null ? value : "";
    }

    /**
     * Replace all external image/font URLs in the HTML with inline base64 data URIs.
     * Handles both src="..." attributes and CSS url(...) references.
     */
    private String inlineImages(String html) {
        // 0) Convert <object data="..." type="image/svg+xml"></object> to <img src="..." />
        //    because html2canvas cannot render <object> elements
        html = html.replaceAll(
                "<object([^>]*?)data=\"([^\"]+)\"([^>]*?)type=\"image/svg\\+xml\"([^>]*?)>\\s*</object>",
                "<img$1src=\"$2\"$3$4/>");
        html = html.replaceAll(
                "<object([^>]*?)type=\"image/svg\\+xml\"([^>]*?)data=\"([^\"]+)\"([^>]*?)>\\s*</object>",
                "<img$1$2src=\"$3\"$4/>");

        // 1) Inline src="https://..." attributes
        html = inlinePattern(html, Pattern.compile("src=\"(https?://[^\"]+)\""),
                (url, dataUri) -> "src=\"" + dataUri + "\"");

        // 2) Inline CSS url(https://...) — with or without quotes
        html = inlinePattern(html, Pattern.compile("url\\((\"?)(https?://[^)\"]+)\\1\\)"),
                (url, dataUri) -> "url(\"" + dataUri + "\")");

        return html;
    }

    private String inlinePattern(String html, Pattern pattern,
            java.util.function.BiFunction<String, String, String> replacer) {
        Matcher matcher = pattern.matcher(html);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            // The actual URL is in the last capturing group
            String imgUrl = matcher.group(matcher.groupCount());
            try {
                URL url = new URL(imgUrl);
                try (InputStream is = url.openStream()) {
                    byte[] bytes = is.readAllBytes();
                    String mime = guessMime(imgUrl);
                    String dataUri = "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(replacer.apply(imgUrl, dataUri)));
                }
            } catch (Exception e) {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private String guessMime(String url) {
        String lower = url.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        return "image/png";
    }

    private int toInt(Object obj) {
        if (obj == null) return 0;
        if (obj instanceof Number) return ((Number) obj).intValue();
        try { return Integer.parseInt(obj.toString()); } catch (Exception e) { return 0; }
    }

    private double toDouble(Object obj) {
        if (obj == null) return 0.0;
        if (obj instanceof Number) return ((Number) obj).doubleValue();
        try { return Double.parseDouble(obj.toString()); } catch (Exception e) { return 0.0; }
    }
}
