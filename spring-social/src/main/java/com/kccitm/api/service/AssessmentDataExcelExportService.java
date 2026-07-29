package com.kccitm.api.service;

import java.io.ByteArrayOutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.AssessmentDemographicMapping;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.DemographicFieldDefinition;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentDemographicResponse;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentDemographicMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.StudentDemographicResponseRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * "Generate Data Excel" export: one row per student, covering everything from
 * the registration page (student info + the assessment's demographic form)
 * through every answer the student gave in the assessment. Question columns
 * are built dynamically from the assessment's questionnaire, in section/
 * question order, and each cell holds the answer(s) the student selected or
 * typed for that question.
 */
@Service
public class AssessmentDataExcelExportService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentDataExcelExportService.class);

    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private FirebaseService firebaseService;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private AssessmentDemographicMappingRepository demographicMappingRepository;
    @Autowired private StudentDemographicResponseRepository demographicResponseRepository;
    @Autowired private SchoolSectionsRepository schoolSectionsRepository;

    // Registration basics already emitted as fixed columns — system demographic
    // fields with these keys would duplicate them, so they are skipped.
    private static final Set<String> FIXED_SYSTEM_KEYS = new HashSet<>(List.of(
            "name", "email", "phoneNumber", "gender", "studentClass",
            "schoolRollNumber", "schoolBoard", "address"));

    // Each game question expands into one numeric column per metric instead of
    // a single packed text cell. Game codes match GameRenderer in the
    // assessment portal: 101 Jungle-Spot (animal_reaction), 102 Rabbit-Path
    // (rabbit_path), 103 Hydro-Tube (hydro_tube).
    private static final Map<Integer, String[]> GAME_COLUMN_HEADERS = Map.of(
            101, new String[] {
                    "Jungle Spot - Hits", "Jungle Spot - Misses",
                    "Jungle Spot - False Positives", "Jungle Spot - Targets Shown",
                    "Jungle Spot - Avg Reaction (ms)" },
            102, new String[] {
                    "Rabbit Path - Score", "Rabbit Path - Total Rounds",
                    "Rabbit Path - Rounds Played" },
            103, new String[] {
                    "Hydro Tube - Patterns Completed", "Hydro Tube - Total Patterns",
                    "Hydro Tube - Aimless Rotations", "Hydro Tube - Curious Clicks",
                    "Hydro Tube - Tiles Correct", "Hydro Tube - Total Tiles",
                    "Hydro Tube - Time (sec)" });

    @Transactional(readOnly = true)
    public byte[] exportStudentData(Long assessmentId, List<Long> userStudentIds) throws Exception {

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));
        Long questionnaireId = (assessment.getQuestionnaire() != null)
                ? assessment.getQuestionnaire().getQuestionnaireId() : null;

        // ── 1. Target students (attempted the assessment) ───────────────
        Set<Long> requestedIds = (userStudentIds == null || userStudentIds.isEmpty())
                ? null : new HashSet<>(userStudentIds);
        List<StudentAssessmentMapping> targetStudents = mappingRepository
                .findAllByAssessmentId(assessmentId).stream()
                .filter(m -> "completed".equalsIgnoreCase(m.getStatus())
                          || "ongoing".equalsIgnoreCase(m.getStatus()))
                .filter(m -> requestedIds == null
                          || requestedIds.contains(m.getUserStudent().getUserStudentId()))
                .collect(Collectors.toList());
        if (targetStudents.isEmpty()) {
            throw new ResourceNotFoundException("StudentAssessmentMapping",
                    "assessmentId (no attempted students)", assessmentId);
        }

        // ── 2. Question columns from the questionnaire ──────────────────
        List<QuestionnaireQuestion> orderedQuestions = new ArrayList<>();
        if (questionnaireId != null) {
            Map<Long, QuestionnaireQuestion> byId = new LinkedHashMap<>();
            for (QuestionnaireQuestion qq : questionnaireQuestionRepository
                    .findByQuestionnaireIdWithOptions(questionnaireId)) {
                byId.putIfAbsent(qq.getQuestionnaireQuestionId(), qq);
            }
            orderedQuestions = byId.values().stream()
                    .sorted(Comparator
                            .comparingInt((QuestionnaireQuestion qq) ->
                                    qq.getSection() != null ? parseInt(qq.getSection().getOrder()) : 0)
                            .thenComparingInt(qq -> parseInt(qq.getOrder()))
                            .thenComparing(QuestionnaireQuestion::getQuestionnaireQuestionId))
                    .collect(Collectors.toList());
        }

        // ── 3. Demographic (registration form) columns ──────────────────
        List<AssessmentDemographicMapping> demoFields = demographicMappingRepository
                .findByAssessmentIdOrderByDisplayOrderAsc(assessmentId).stream()
                .filter(m -> m.getFieldDefinition() != null)
                .filter(m -> !FIXED_SYSTEM_KEYS.contains(
                        safe(m.getFieldDefinition().getSystemFieldKey())))
                .collect(Collectors.toList());

        // responses: student → fieldId → value
        Map<Long, Map<Long, String>> demoResponses = new HashMap<>();
        for (StudentDemographicResponse r : demographicResponseRepository.findByAssessmentId(assessmentId)) {
            if (r.getFieldDefinition() == null) continue;
            demoResponses.computeIfAbsent(r.getUserStudentId(), k -> new HashMap<>())
                    .put(r.getFieldDefinition().getFieldId(), safe(r.getResponseValue()));
        }

        // ── 3b. Game questions ──────────────────────────────────────────
        // Game questions (an option flagged is_game linked to game_table) have
        // no assessment_answer rows — the games write their results to the
        // Firestore game_results/{userStudentId} document instead. Map each
        // game question to its gameCode so cells can be filled from there.
        Map<Long, Integer> gameCodeByQuestion = new HashMap<>();
        for (QuestionnaireQuestion qq : orderedQuestions) {
            if (qq.getQuestion() == null || qq.getQuestion().getOptions() == null) continue;
            for (AssessmentQuestionOptions opt : qq.getQuestion().getOptions()) {
                if (Boolean.TRUE.equals(opt.getIsGame()) && opt.getGame() != null) {
                    gameCodeByQuestion.put(qq.getQuestionnaireQuestionId(), opt.getGame().getGameCode());
                    break;
                }
            }
        }

        // ── 4. Answers: student → questionnaireQuestionId → answers ─────
        Map<Long, Map<Long, List<AssessmentAnswer>>> answersByStudent = new HashMap<>();
        for (AssessmentAnswer a : answerRepository.findAllByAssessmentIdForExport(assessmentId)) {
            if (a.getUserStudent() == null || a.getQuestionnaireQuestion() == null) continue;
            answersByStudent
                    .computeIfAbsent(a.getUserStudent().getUserStudentId(), k -> new HashMap<>())
                    .computeIfAbsent(a.getQuestionnaireQuestion().getQuestionnaireQuestionId(),
                            k -> new ArrayList<>())
                    .add(a);
        }

        // ── 5. Headers ──────────────────────────────────────────────────
        List<String> headers = new ArrayList<>(List.of(
                "Student ID", "Name", "Email", "Phone Number", "Gender", "Date of Birth",
                "Class", "Section", "Roll Number", "School", "School Board", "Address"));
        for (AssessmentDemographicMapping m : demoFields) {
            DemographicFieldDefinition f = m.getFieldDefinition();
            headers.add(m.getCustomLabel() != null && !m.getCustomLabel().isEmpty()
                    ? m.getCustomLabel() : safe(f.getDisplayLabel()));
        }
        headers.add("Assessment Status");
        int qNum = 0;
        for (QuestionnaireQuestion qq : orderedQuestions) {
            qNum++;
            Integer gameCode = gameCodeByQuestion.get(qq.getQuestionnaireQuestionId());
            String[] gameHeaders = (gameCode != null) ? GAME_COLUMN_HEADERS.get(gameCode) : null;
            if (gameHeaders != null) {
                headers.addAll(Arrays.asList(gameHeaders));
                continue;
            }
            String custom = qq.getExcelQuestionHeader();
            if (custom != null && !custom.trim().isEmpty()) {
                headers.add(custom.trim());
            } else {
                String text = (qq.getQuestion() != null) ? safe(qq.getQuestion().getQuestionText()) : "";
                headers.add(text.isEmpty() ? ("Q" + qNum) : ("Q" + qNum + ": " + text.trim()));
            }
        }

        // ── 6. Workbook ─────────────────────────────────────────────────
        SimpleDateFormat dobFormat = new SimpleDateFormat("dd-MM-yyyy");
        Map<Integer, String> sectionNameCache = new HashMap<>();
        Map<Long, Map<String, Object>> gameDocCache = new HashMap<>();

        XSSFWorkbook workbook = new XSSFWorkbook();
        try {
            Sheet sheet = workbook.createSheet("Assessment Data");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (StudentAssessmentMapping sam : targetStudents) {
                UserStudent us = sam.getUserStudent();
                StudentInfo si = us.getStudentInfo();
                Row row = sheet.createRow(rowIdx++);
                int col = 0;

                row.createCell(col++).setCellValue(us.getUserStudentId());
                row.createCell(col++).setCellValue(si != null ? safe(si.getName()) : "");
                row.createCell(col++).setCellValue(si != null ? safe(si.getEmail()) : "");
                row.createCell(col++).setCellValue(si != null ? safe(si.getPhoneNumber()) : "");
                row.createCell(col++).setCellValue(si != null ? safe(si.getGender()) : "");
                row.createCell(col++).setCellValue(si != null && si.getStudentDob() != null
                        ? dobFormat.format(si.getStudentDob()) : "");
                row.createCell(col++).setCellValue(si != null && si.getStudentClass() != null
                        ? String.valueOf(si.getStudentClass()) : "");

                String sectionName = "";
                if (si != null && si.getSchoolSectionId() != null) {
                    sectionName = sectionNameCache.computeIfAbsent(si.getSchoolSectionId(), id ->
                            schoolSectionsRepository.findById(id)
                                    .map(SchoolSections::getSectionName).orElse(""));
                }
                row.createCell(col++).setCellValue(sectionName);

                row.createCell(col++).setCellValue(si != null ? safe(si.getSchoolRollNumber()) : "");
                String school = us.getInstitute() != null
                        ? safe(us.getInstitute().getInstituteName())
                        : (si != null ? safe(si.getSchoolName()) : "");
                row.createCell(col++).setCellValue(school);
                row.createCell(col++).setCellValue(si != null ? safe(si.getSchoolBoard()) : "");
                row.createCell(col++).setCellValue(si != null ? safe(si.getAddress()) : "");

                Map<Long, String> studentDemo = demoResponses.getOrDefault(
                        us.getUserStudentId(), Collections.emptyMap());
                for (AssessmentDemographicMapping m : demoFields) {
                    DemographicFieldDefinition f = m.getFieldDefinition();
                    String value = studentDemo.get(f.getFieldId());
                    if ((value == null || value.isEmpty()) && si != null
                            && "system".equalsIgnoreCase(safe(f.getFieldSource()))) {
                        value = systemFieldValue(si, f.getSystemFieldKey());
                    }
                    row.createCell(col++).setCellValue(safe(value));
                }

                row.createCell(col++).setCellValue(safe(sam.getStatus()));

                Map<Long, List<AssessmentAnswer>> studentAnswers = answersByStudent.getOrDefault(
                        us.getUserStudentId(), Collections.emptyMap());
                Map<String, Object> gameDoc = gameCodeByQuestion.isEmpty()
                        ? null : fetchGameResults(us.getUserStudentId(), gameDocCache);
                for (QuestionnaireQuestion qq : orderedQuestions) {
                    Long qqId = qq.getQuestionnaireQuestionId();
                    Integer gameCode = gameCodeByQuestion.get(qqId);
                    if (gameCode != null && GAME_COLUMN_HEADERS.containsKey(gameCode)) {
                        for (Long value : gameColumnValues(gameCode, gameDoc)) {
                            Cell cell = row.createCell(col++);
                            if (value != null) {
                                cell.setCellValue(value);
                            }
                        }
                        continue;
                    }
                    row.createCell(col++).setCellValue(formatAnswers(studentAnswers.get(qqId)));
                }
            }

            // Only size the fixed columns — autosizing hundreds of question
            // columns over many rows is very slow.
            for (int i = 0; i < 12; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            logger.info("Data excel: exported {} students x {} columns for assessment {}",
                    targetStudents.size(), headers.size(), assessmentId);
            return out.toByteArray();
        } finally {
            workbook.close();
        }
    }

    /**
     * Fetches (and caches) the student's Firestore game_results document.
     * Returns null when the student has no game data or Firestore is
     * unavailable — game cells then just stay empty.
     */
    private Map<String, Object> fetchGameResults(Long userStudentId,
            Map<Long, Map<String, Object>> cache) {
        if (cache.containsKey(userStudentId)) {
            return cache.get(userStudentId);
        }
        Map<String, Object> doc = null;
        try {
            doc = firebaseService.getDocument("game_results", String.valueOf(userStudentId));
        } catch (Exception e) {
            logger.warn("Data excel: could not fetch game_results for student {}: {}",
                    userStudentId, e.getMessage());
        }
        cache.put(userStudentId, doc);
        return doc;
    }

    /**
     * One value per GAME_COLUMN_HEADERS column for this game, in the same
     * order. A null entry means "no data" and leaves the cell blank — the
     * whole list is null-filled when the student never played the game.
     */
    @SuppressWarnings("unchecked")
    private List<Long> gameColumnValues(int gameCode, Map<String, Object> gameDoc) {
        String docKey;
        switch (gameCode) {
            case 101: docKey = "animal_reaction"; break;
            case 102: docKey = "rabbit_path"; break;
            case 103: docKey = "hydro_tube"; break;
            default:  return Collections.emptyList();
        }
        Map<String, Object> m = (gameDoc != null)
                ? (Map<String, Object>) gameDoc.get(docKey) : null;
        if (m == null) {
            return Collections.nCopies(GAME_COLUMN_HEADERS.get(gameCode).length, null);
        }
        switch (gameCode) {
            case 101:
                return Arrays.asList(
                        numOrNull(m.get("hits")), numOrNull(m.get("misses")),
                        numOrNull(m.get("falsePositives")), numOrNull(m.get("targetsShown")),
                        avgReactionMs(m.get("hitRTsMs")));
            case 102:
                return Arrays.asList(
                        numOrNull(m.get("score")), numOrNull(m.get("totalRounds")),
                        numOrNull(m.get("roundsPlayed")));
            default: // 103
                return Arrays.asList(
                        numOrNull(m.get("patternsCompleted")), numOrNull(m.get("totalPatterns")),
                        numOrNull(m.get("aimlessRotations")), numOrNull(m.get("curiousClicks")),
                        numOrNull(m.get("tilesCorrect")), numOrNull(m.get("totalTiles")),
                        numOrNull(m.get("timeSpentSeconds")));
        }
    }

    private static Long avgReactionMs(Object rts) {
        if (!(rts instanceof List) || ((List<?>) rts).isEmpty()) return null;
        long sum = 0;
        for (Object v : (List<?>) rts) sum += toLong(v);
        return sum / ((List<?>) rts).size();
    }

    private static Long numOrNull(Object o) {
        return (o == null) ? null : toLong(o);
    }

    private static long toLong(Object o) {
        if (o instanceof Number) return ((Number) o).longValue();
        if (o instanceof String) {
            try { return (long) Double.parseDouble((String) o); }
            catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    /** Joins everything a student answered for one question into a single cell. */
    private String formatAnswers(List<AssessmentAnswer> answers) {
        if (answers == null || answers.isEmpty()) return "";
        List<AssessmentAnswer> sorted = answers.stream()
                .sorted(Comparator.comparingInt(a ->
                        a.getRankOrder() != null ? a.getRankOrder() : Integer.MAX_VALUE))
                .collect(Collectors.toList());
        List<String> parts = new ArrayList<>();
        for (AssessmentAnswer a : sorted) {
            AssessmentQuestionOptions opt = a.getOption() != null ? a.getOption() : a.getMappedOption();
            String value = opt != null ? safe(opt.getOptionText()).trim() : "";
            if (value.isEmpty() && a.getTextResponse() != null) {
                value = a.getTextResponse().trim();
            }
            if (!value.isEmpty() && !parts.contains(value)) {
                parts.add(value);
            }
        }
        return String.join("; ", parts);
    }

    private String systemFieldValue(StudentInfo si, String key) {
        if (key == null) return null;
        switch (key) {
            case "sibling": return si.getSibling() != null ? String.valueOf(si.getSibling()) : null;
            case "family":  return si.getFamily();
            default:        return null;
        }
    }

    private static int parseInt(String s) {
        if (s == null || s.trim().isEmpty()) return 0;
        try { return Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return 0; }
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }
}
