package com.kccitm.api.controller.career9;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
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

import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.BetReportData;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.BetReportDataRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
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
    @Autowired private FirebaseService firebaseService;

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

        // Upsert
        betReportDataRepository.findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .ifPresent(existing -> betReportDataRepository.delete(existing));

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

        return betReportDataRepository.save(report);
    }

    // ── Live score interpreters (use Map<mqtId, score> instead of AssessmentRawScore) ──

    private String computeSelfEfficacyLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_SELF_EFFICACY, 0);
        if (score < 11) return "";
        else if (score <= 14) return "Your child often doubts their abilities and may want to give up quickly because they worry they aren't \"naturally good\" at a task.";
        else if (score <= 18) return "Your child feels confident with things they already know but might need a little extra encouragement to try something brand new or difficult.";
        else return "Your child has a \"can-do\" attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough";
    }

    private String computeSelfRegulationLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_SELF_MANAGEMENT, 0);
        if (score < 9) return "";
        else if (score <= 11) return "Your child finds it difficult to manage impulses or stay quiet when asked, often needing an adult's help to stay organized and finish tasks.";
        else if (score <= 15) return "Your child generally follows rules well but can get distracted or impulsive when they are very excited or in a noisy environment.";
        else return "Your child shows great independence, staying focused on their work even if it's a bit boring and waiting patiently for their turn.";
    }

    private String computeEmotionRegulationLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_EMOTION_REGULATION, 0);
        if (score < 7) return "";
        else if (score <= 9) return "Your child often feels overwhelmed by \"big\" feelings like anger or worry and may find it hard to explain exactly why they are upset.";
        else if (score <= 12) return "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.";
        else return "Your child is very aware of their emotions, knows how to cheer themselves up when sad, and shows a kind understanding of why friends might be upset.";
    }

    private String computeSocialInsightLive(Map<Long, Integer> scores) {
        int score = scores.getOrDefault(MQT_ID_SOCIAL_INSIGHT, 0);
        if (score < 0) return "";
        else if (score <= 6) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Literal Thinker.\" He/She may find sarcasm or \"polite lies\" confusing.";
        else if (score <= 12) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Social Detective.\" He/She can tell the difference between mistakes and mean intent.";
        else return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Mind Reader.\" He/She picks up on subtle hints and complex social layers.";
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
        betReportDataRepository.findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .ifPresent(existing -> betReportDataRepository.delete(existing));

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
        if(score<11) return "";
        else if (score>=11 && score<=14) return "Your child often doubts their abilities and may want to give up quickly because they worry they aren't \"naturally good\" at a task.";
        else if (score>=15 && score<=18) return "Your child feels confident with things they already know but might need a little extra encouragement to try something brand new or difficult.";
        else return "Your child has a \"can-do\" attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough";
    }

    private String computeSelfRegulation(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_SELF_MANAGEMENT);
        if (score < 9) return "";
        else if (score >= 9 && score <= 11) return "Your child finds it difficult to manage impulses or stay quiet when asked, often needing an adult’s help to stay organized and finish tasks.";
        else if (score >= 12 && score <= 15) return "Your child generally follows rules well but can get distracted or impulsive when they are very excited or in a noisy environment.";
        else return "Your child shows great independence, staying focused on their work even if it’s a bit boring and waiting patiently for their turn.";
    }

    private String computeEmotionRegulation(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_EMOTION_REGULATION);
        if (score < 7) return "";
        else if (score >= 7 && score <= 9) return "Your child often feels overwhelmed by \"big\" feelings like anger or worry and may find it hard to explain exactly why they are upset.";
        else if (score >= 10 && score <= 12) return "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.";
        else return "Your child is very aware of their emotions, knows how to cheer themselves up when sad, and shows a kind understanding of why friends might be upset.";
    }

    private String computeSocialInsight(List<AssessmentRawScore> rawScores) {
        int score = findRawScore(rawScores, MQT_ID_SOCIAL_INSIGHT);
        if (score < 0) return "";
        else if (score >= 0 && score <= 6) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Literal Thinker.\" He/She may find sarcasm or \"polite lies\" confusing.";
        else if (score >= 7 && score <= 12) return "In our cultural context, social \"politeness\" often involves indirect speech. We use these results to help your child navigate these subtle social rules with confidence. Your child is the \"Social Detective.\" He/She can tell the difference between mistakes and mean intent.";
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
        String[] result = {"", "", "", ""};
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

    // ── Cognitive classification functions (mirror frontend logic) ──

    private String getCognitiveFlexibilityStyle(double time, double aimlessClicks) {
        if (time < 75 && aimlessClicks <= 2) return "High Mental Efficiency: Your child quickly visualizes the solution and executes it with precision. They have strong working memory.\n Challenge Them: Provide multi- step projects like robotics, coding, or strategy games (Chess) that require long-term planning.";
        if (time < 75 && aimlessClicks >= 2) return "Impulsive Agility: Your child has a quick mind but acts before a plan is formed. They rely on speed rather than strategy, leading to 'hurried' logic.\n The 'Pause' Rule: Ask them to 'explain the first two moves' out loud before they touch the screen. This builds the habit of thinking before acting.";
        if (time >= 75 && aimlessClicks <= 2) return "Careful Accuracy: Your child prioritizes being 'correct' over 'fast.' They are internalizing the logic and double-checking their mental map.\n Build Fluency: Use timed 'fun' challenges with low stakes (like 'Beat the Clock' math) to reduce perfectionism and build confidence in quick thinking.";
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
