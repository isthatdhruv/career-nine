package com.kccitm.api.service;

import java.io.ByteArrayOutputStream;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentDemographicResponse;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentDemographicMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.StudentDemographicResponseRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * BET-format "Generate Data Excel": reproduces the analyst-supplied
 * "BET_ template" sheet layout (one row per student, 94 fixed columns).
 * Item columns (SE-01..SM-09) hold the numeric mark of the option the
 * student clicked (the same per-option score the raw-score pipeline uses,
 * normally 2 for the Group A sentence and 1 for Group B), so the item
 * columns sum to the domain-total columns at the end of the sheet.
 *
 * Questions are matched to their item codes by the Group A sentence text
 * (normalized), because the questionnaire stores no code of its own.
 * {@link #exportIfBetTemplate} returns null when the assessment's
 * questionnaire doesn't match the BET item set, so callers can fall back
 * to the generic export.
 */
@Service
public class BetTemplateExcelExportService {

    private static final Logger logger = LoggerFactory.getLogger(BetTemplateExcelExportService.class);

    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private AssessmentDemographicMappingRepository demographicMappingRepository;
    @Autowired private StudentDemographicResponseRepository demographicResponseRepository;
    @Autowired private AssessmentRawScoreRepository rawScoreRepository;
    @Autowired private FirebaseService firebaseService;

    /** Item codes in the exact column order of the BET template sheet. */
    private static final String[] ITEM_CODE_ORDER = {
            "SE-01", "SE-02", "SE-03", "SE-04", "ER-01", "SD-01", "BU-01", "SM-01",
            "BU-02", "ER-02", "SD-02", "SM-02", "SE-05", "SM-03", "SM-04", "SD-03",
            "SE-06", "SM-05", "SD-04", "SM-06", "BU-03", "SM-07", "SD-05", "SE-07",
            "SM-08", "BU-04", "BU-05", "SE-08", "ER-03", "ER-04", "SE-09", "ER-05",
            "ER-06", "SM-09", "SE-10", "ER-07", "SE-11" };

    /**
     * Group A sentence of each item, from the template's "item codes" sheet.
     * Matched against option text after {@link #normalize}, so punctuation,
     * ellipses and mojibake don't matter. SM-04 carries the DB's actual
     * wording ("feel fine even if they lose a game") as an alias because the
     * live questionnaire text drifted from the template sheet.
     */
    private static final String[][] GROUP_A_TEXTS = {
            { "SE-01", "find it easy to solve hard puzzles" },
            { "SE-02", "try again if they fail the first time" },
            { "SE-03", "feel they can learn any new sport" },
            { "SE-04", "feel sure they can learn from others" },
            { "ER-01", "stay calm before a big school test" },
            { "SD-01", "never get angry with anyone" },
            { "BU-01", "can talk out a disagreement" },
            { "SM-01", "can finish even boring schoolwork" },
            { "BU-02", "can stand up to bossy people" },
            { "ER-02", "know how to cheer themselves up" },
            { "SD-02", "always tell the truth every time" },
            { "SM-02", "follow rules even when friends dont" },
            { "SE-05", "think of many ways to fix a problem" },
            { "SM-03", "feel proud of what they do alone" },
            { "SM-04", "stay calm even if they lose a game" },
            { "SM-04", "feel fine even if they lose a game" },
            { "SD-03", "are always happy to share everything" },
            { "SE-06", "like trying new scary things" },
            { "SM-05", "are good at waiting for their turn" },
            { "SD-04", "never say anything mean to others" },
            { "SM-06", "can ignore noise while working" },
            { "BU-03", "blame the teacher for low marks" },
            { "SM-07", "can be quiet when they are asked" },
            { "SD-05", "always listen to parents and teachers" },
            { "SE-07", "feel brave trying new activities" },
            { "SM-08", "like to fix their own mistakes" },
            { "BU-04", "like to keep the best toysgames" },
            { "BU-05", "find it easy to say im sorry" },
            { "SE-08", "think practice makes them smarter" },
            { "ER-03", "usually stay calm when they get angry" },
            { "ER-04", "feel bad about themselves when they lose a game" },
            { "SE-09", "keep trying at a hard task even if its tough" },
            { "ER-05", "find it easy to know exactly how they are feeling" },
            { "ER-06", "feel they have to hide their feelings from friends" },
            { "SM-09", "can wait patiently for their turn" },
            { "SE-10", "worry a lot about what others think of them" },
            { "ER-07", "understand why their friends get upset" },
            { "SE-11", "feel they are good at handling their problems" } };

    /** At least this many of the 37 item codes must match to call it a BET questionnaire. */
    private static final int MIN_ITEM_MATCHES = 30;

    private static final String[] GAME_HEADERS = {
            "Jungle Spot - Hits", "Jungle Spot - Misses",
            "Jungle Spot - False Positives", "Jungle Spot - Targets Shown",
            "Rabbit Path - Score", "Rabbit Path - Total Rounds", "Rabbit Path - Rounds Played",
            "Hydro Tube - Patterns Completed", "Hydro Tube - Total Patterns",
            "Hydro Tube - Aimless Rotations", "Hydro Tube - Curious Clicks",
            "Hydro Tube - Tiles Correct", "Hydro Tube - Total Tiles", "Hydro Tube - Time (sec)" };

    /** Domain-score columns, keyed exactly like the MQT-score export ("MQ: MQT"). */
    private static final String[] SCORE_HEADERS = {
            "Self Management: Self Efficacy", "Self Management: Emotion Regulation",
            "Self Management: Social Desirability", "Self Management: Bully",
            "Self Management: Self Management", "Social Insight: Social Insight",
            "Values: Honesty", "Values: Hard Work", "Values: Curiosity", "Values: Courage",
            "Values: Cleanliness", "Values: Kindness", "Values: Respect", "Values: Fairness",
            "Values: Gratitude", "Values: Patience",
            "Environmental Awareness: Environmental Awareness" };

    private static final Pattern SOCIAL_INSIGHT_HEADER = Pattern.compile("Social_Insight_(\\d+)");

    /**
     * Exports the BET template layout, or returns null when this assessment's
     * questionnaire is not the BET one (caller falls back to the generic export).
     */
    @Transactional(readOnly = true)
    public byte[] exportIfBetTemplate(Long assessmentId, List<Long> userStudentIds) throws Exception {

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));
        if (assessment.getQuestionnaire() == null) {
            return null;
        }
        Long questionnaireId = assessment.getQuestionnaire().getQuestionnaireId();

        // ── Questionnaire questions (deduped — language variants repeat rows) ──
        Map<Long, QuestionnaireQuestion> questionsById = new LinkedHashMap<>();
        for (QuestionnaireQuestion qq : questionnaireQuestionRepository
                .findByQuestionnaireIdWithOptions(questionnaireId)) {
            questionsById.putIfAbsent(qq.getQuestionnaireQuestionId(), qq);
        }

        // ── Match questions to BET item codes by Group A sentence ──
        Map<String, String> groupATextToCode = new HashMap<>();
        for (String[] entry : GROUP_A_TEXTS) {
            groupATextToCode.put(normalize(entry[1]), entry[0]);
        }

        Map<String, Long> codeToQuestionId = new HashMap<>();   // "SE-01" -> questionnaireQuestionId
        Map<Long, Integer> markByOptionId = new HashMap<>();    // optionId -> numeric mark
        Long imageQuestionId = null;                            // Environmental Awareness picture question
        Map<Long, Integer> imagePositionByOptionId = new HashMap<>();   // optionId -> 1-based position
        Long valuesQuestionId = null;                           // "pick 3 values" question
        Map<Integer, Long> siQuestionIds = new HashMap<>();     // SI number (1..9) -> questionnaireQuestionId

        for (QuestionnaireQuestion qq : questionsById.values()) {
            String header = safe(qq.getExcelQuestionHeader());
            if (header.startsWith("Environmental_Awareness")) {
                imageQuestionId = qq.getQuestionnaireQuestionId();
                // Image options carry no text; the cell shows each pick as
                // "Option N (Image)" where N is the option's 1-based position.
                if (qq.getQuestion() != null && qq.getQuestion().getOptions() != null) {
                    List<AssessmentQuestionOptions> imageOptions =
                            new ArrayList<>(qq.getQuestion().getOptions());
                    imageOptions.sort(Comparator.comparing(AssessmentQuestionOptions::getOptionId));
                    for (int i = 0; i < imageOptions.size(); i++) {
                        imagePositionByOptionId.put(imageOptions.get(i).getOptionId(), i + 1);
                    }
                }
            } else if (header.startsWith("Values")) {
                valuesQuestionId = qq.getQuestionnaireQuestionId();
            } else {
                Matcher m = SOCIAL_INSIGHT_HEADER.matcher(header);
                if (m.matches()) {
                    siQuestionIds.put(Integer.parseInt(m.group(1)), qq.getQuestionnaireQuestionId());
                }
            }

            if (qq.getQuestion() == null || qq.getQuestion().getOptions() == null) continue;
            String code = null;
            for (AssessmentQuestionOptions opt : qq.getQuestion().getOptions()) {
                String matched = groupATextToCode.get(normalize(opt.getOptionText()));
                if (matched != null) {
                    code = matched;
                    break;
                }
            }
            if (code == null) continue;
            codeToQuestionId.put(code, qq.getQuestionnaireQuestionId());
            for (AssessmentQuestionOptions opt : qq.getQuestion().getOptions()) {
                Integer mark = optionScore(opt);
                if (mark != null) {
                    markByOptionId.put(opt.getOptionId(), mark);
                }
            }
        }

        if (codeToQuestionId.size() < MIN_ITEM_MATCHES) {
            logger.info("BET template export: assessment {} matched only {}/{} item codes — not BET, "
                    + "falling back to generic export", assessmentId, codeToQuestionId.size(),
                    ITEM_CODE_ORDER.length);
            return null;
        }

        // ── Target students (attempted the assessment) ──
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

        // ── Demographic fields, matched to the template's four columns ──
        Long siblingFieldId = null, familyFieldId = null, genderFieldId = null, gradeFieldId = null;
        for (AssessmentDemographicMapping m : demographicMappingRepository
                .findByAssessmentIdOrderByDisplayOrderAsc(assessmentId)) {
            if (m.getFieldDefinition() == null) continue;
            String label = normalize(m.getFieldDefinition().getDisplayLabel());
            Long fieldId = m.getFieldDefinition().getFieldId();
            if (label.contains("sibling") || label.contains("brothersandsisters")) {
                siblingFieldId = fieldId;
            } else if (label.contains("family")) {
                familyFieldId = fieldId;
            } else if (label.contains("gender")) {
                genderFieldId = fieldId;
            } else if (label.contains("grade") || label.contains("class")) {
                gradeFieldId = fieldId;
            }
        }

        Map<Long, Map<Long, String>> demoResponses = new HashMap<>();
        for (StudentDemographicResponse r : demographicResponseRepository.findByAssessmentId(assessmentId)) {
            if (r.getFieldDefinition() == null) continue;
            demoResponses.computeIfAbsent(r.getUserStudentId(), k -> new HashMap<>())
                    .put(r.getFieldDefinition().getFieldId(), safe(r.getResponseValue()));
        }

        // ── Answers: student -> questionnaireQuestionId -> answers ──
        Map<Long, Map<Long, List<AssessmentAnswer>>> answersByStudent = new HashMap<>();
        for (AssessmentAnswer a : answerRepository.findAllByAssessmentIdForExport(assessmentId)) {
            if (a.getUserStudent() == null || a.getQuestionnaireQuestion() == null) continue;
            answersByStudent
                    .computeIfAbsent(a.getUserStudent().getUserStudentId(), k -> new HashMap<>())
                    .computeIfAbsent(a.getQuestionnaireQuestion().getQuestionnaireQuestionId(),
                            k -> new ArrayList<>())
                    .add(a);
        }

        // ── Raw scores: student -> "MQ: MQT" -> score ──
        Map<Long, Long> studentIdByMappingId = targetStudents.stream()
                .collect(Collectors.toMap(StudentAssessmentMapping::getStudentAssessmentId,
                        m -> m.getUserStudent().getUserStudentId(), (a, b) -> a));
        Map<Long, Map<String, Integer>> scoresByStudent = new HashMap<>();
        List<AssessmentRawScore> rawScores = rawScoreRepository
                .findByStudentAssessmentMappingStudentAssessmentIdIn(
                        new ArrayList<>(studentIdByMappingId.keySet()));
        for (AssessmentRawScore score : rawScores) {
            Long mappingId = score.getStudentAssessmentMapping() != null
                    ? score.getStudentAssessmentMapping().getStudentAssessmentId() : null;
            Long studentId = mappingId != null ? studentIdByMappingId.get(mappingId) : null;
            String key = scoreKey(score.getMeasuredQualityType());
            if (studentId != null && key != null) {
                scoresByStudent.computeIfAbsent(studentId, k -> new HashMap<>())
                        .put(key, score.getRawScore());
            }
        }

        // ── Workbook ──
        List<String> headers = new ArrayList<>(List.of(
                "S.No", "Name", "User ID", "Assessment", "Number of Siblings", "Type of Family",
                "Gender", "What grade are you in?", "Image code,", "total score on env awareness",
                "Value 1", "Value 2", "Value 3", "Remove"));
        headers.addAll(Arrays.asList(ITEM_CODE_ORDER));
        headers.add("");
        headers.add("SI_1 ");   // trailing space matches the template file exactly
        for (int i = 2; i <= 9; i++) headers.add("SI_" + i);
        headers.add("");
        headers.addAll(Arrays.asList(GAME_HEADERS));
        headers.add("");
        headers.addAll(Arrays.asList(SCORE_HEADERS));

        // Start from the bundled workbook whose "item codes" sheet documents
        // every SE/ER/SD/BU/SM code, the Group A/B sentences and the scoring
        // guidelines — it ships as the second sheet of every BET export.
        XSSFWorkbook workbook = openWorkbookWithItemCodes();
        try {
            Sheet sheet = workbook.createSheet("BET Data");
            workbook.setSheetOrder("BET Data", 0);
            workbook.setActiveSheet(0);
            workbook.setSelectedTab(0);

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
                Long studentId = us.getUserStudentId();
                Map<Long, List<AssessmentAnswer>> studentAnswers = answersByStudent
                        .getOrDefault(studentId, Collections.emptyMap());
                Map<Long, String> studentDemo = demoResponses
                        .getOrDefault(studentId, Collections.emptyMap());
                Map<String, Integer> studentScores = scoresByStudent
                        .getOrDefault(studentId, Collections.emptyMap());

                Row row = sheet.createRow(rowIdx);
                int col = 0;
                row.createCell(col++).setCellValue(rowIdx);
                rowIdx++;
                row.createCell(col++).setCellValue(si != null ? safe(si.getName()) : "");
                row.createCell(col++).setCellValue(studentId);
                row.createCell(col++).setCellValue(safe(assessment.getAssessmentName()).trim());

                row.createCell(col++).setCellValue(demoValue(studentDemo, siblingFieldId,
                        si != null && si.getSibling() != null ? String.valueOf(si.getSibling()) : ""));
                row.createCell(col++).setCellValue(demoValue(studentDemo, familyFieldId,
                        si != null ? safe(si.getFamily()) : ""));
                row.createCell(col++).setCellValue(demoValue(studentDemo, genderFieldId,
                        si != null ? safe(si.getGender()) : ""));
                row.createCell(col++).setCellValue(demoValue(studentDemo, gradeFieldId,
                        si != null && si.getStudentClass() != null
                                ? String.valueOf(si.getStudentClass()) : ""));

                row.createCell(col++).setCellValue(imageQuestionId != null
                        ? imageCodes(studentAnswers.get(imageQuestionId), imagePositionByOptionId)
                        : "");

                Integer envScore = studentScores.get("Environmental Awareness: Environmental Awareness");
                writeNumeric(row.createCell(col++), envScore);

                List<String> values = answerTexts(studentAnswers.get(valuesQuestionId));
                for (int i = 0; i < 3; i++) {
                    row.createCell(col++).setCellValue(i < values.size() ? values.get(i) : "");
                }

                row.createCell(col++).setCellValue("");   // "Remove"

                for (String code : ITEM_CODE_ORDER) {
                    writeNumeric(row.createCell(col++),
                            itemMark(studentAnswers.get(codeToQuestionId.get(code)), markByOptionId));
                }

                row.createCell(col++).setCellValue("");   // spacer
                for (int i = 1; i <= 9; i++) {
                    Long siId = siQuestionIds.get(i);
                    row.createCell(col++).setCellValue(siId != null
                            ? formatAnswers(studentAnswers.get(siId)) : "");
                }

                row.createCell(col++).setCellValue("");   // spacer
                Map<String, Object> gameDoc = fetchGameResults(studentId);
                for (Long value : gameColumnValues(gameDoc)) {
                    Cell cell = row.createCell(col++);
                    if (value != null) {
                        cell.setCellValue(value);
                    }
                }

                row.createCell(col++).setCellValue("");   // spacer
                for (String scoreHeader : SCORE_HEADERS) {
                    writeNumeric(row.createCell(col++), studentScores.get(scoreHeader));
                }
            }

            for (int i = 0; i < 10; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            logger.info("BET template export: {} students x {} columns for assessment {}",
                    targetStudents.size(), headers.size(), assessmentId);
            return out.toByteArray();
        } finally {
            workbook.close();
        }
    }

    /**
     * Opens the bundled workbook containing the "item codes" reference sheet.
     * Falls back to an empty workbook (data sheet only) if the resource is
     * missing, so the export never fails over documentation.
     */
    private XSSFWorkbook openWorkbookWithItemCodes() {
        try (java.io.InputStream in = getClass().getResourceAsStream(
                "/bet-template/bet-item-codes.xlsx")) {
            if (in != null) {
                return new XSSFWorkbook(in);
            }
            logger.warn("BET template export: bet-item-codes.xlsx resource missing — "
                    + "exporting without the item codes sheet");
        } catch (Exception e) {
            logger.warn("BET template export: could not load item codes sheet: {}", e.getMessage());
        }
        return new XSSFWorkbook();
    }

    /** The option's raw-score mark (2 = Group A, 1 = Group B, as configured in the score table). */
    private static Integer optionScore(AssessmentQuestionOptions opt) {
        List<OptionScoreBasedOnMEasuredQualityTypes> scores = opt.getOptionScores();
        if (scores == null || scores.isEmpty()) return null;
        return scores.get(0).getScore();
    }

    /** Mark of the option the student clicked for one item question; null = unanswered. */
    private static Integer itemMark(List<AssessmentAnswer> answers, Map<Long, Integer> markByOptionId) {
        if (answers == null) return null;
        for (AssessmentAnswer a : answers) {
            AssessmentQuestionOptions opt = a.getOption() != null ? a.getOption() : a.getMappedOption();
            if (opt != null && markByOptionId.containsKey(opt.getOptionId())) {
                return markByOptionId.get(opt.getOptionId());
            }
        }
        return null;
    }

    private static void writeNumeric(Cell cell, Integer value) {
        if (value != null) {
            cell.setCellValue(value);
        }
    }

    private static String demoValue(Map<Long, String> studentDemo, Long fieldId, String fallback) {
        String value = fieldId != null ? studentDemo.get(fieldId) : null;
        return value != null && !value.isEmpty() ? value : fallback;
    }

    private static String scoreKey(MeasuredQualityTypes mqt) {
        if (mqt == null) return null;
        String mqName = mqt.getMeasuredQuality() != null
                ? safe(mqt.getMeasuredQuality().getQualityDisplayName() != null
                        ? mqt.getMeasuredQuality().getQualityDisplayName()
                        : mqt.getMeasuredQuality().getMeasuredQualityName())
                : "Ungrouped";
        String mqtName = mqt.getMeasuredQualityTypeDisplayName() != null
                ? mqt.getMeasuredQualityTypeDisplayName()
                : mqt.getMeasuredQualityTypeName();
        return mqName + ": " + safe(mqtName);
    }

    /** Answer option texts in rank order (for Value 1/2/3 and the image question). */
    private static List<String> answerTexts(List<AssessmentAnswer> answers) {
        if (answers == null || answers.isEmpty()) return Collections.emptyList();
        List<String> parts = new ArrayList<>();
        answers.stream()
                .sorted(Comparator.comparingInt(a ->
                        a.getRankOrder() != null ? a.getRankOrder() : Integer.MAX_VALUE))
                .forEach(a -> {
                    AssessmentQuestionOptions opt = a.getOption() != null
                            ? a.getOption() : a.getMappedOption();
                    String value = opt != null ? safe(opt.getOptionText()).trim() : "";
                    if (value.isEmpty() && opt != null) {
                        // Image options (env awareness) keep their label in the
                        // description, not the text.
                        value = safe(opt.getOptionDescription()).trim();
                    }
                    if (value.isEmpty() && a.getTextResponse() != null) {
                        value = a.getTextResponse().trim();
                    }
                    if (!value.isEmpty() && !parts.contains(value)) {
                        parts.add(value);
                    }
                });
        return parts;
    }

    private static String formatAnswers(List<AssessmentAnswer> answers) {
        return String.join("; ", answerTexts(answers));
    }

    /** "Option 1 (Image); Option 5 (Image); ..." in the order the student picked the images. */
    private static String imageCodes(List<AssessmentAnswer> answers,
            Map<Long, Integer> imagePositionByOptionId) {
        if (answers == null || answers.isEmpty()) return "";
        List<String> parts = new ArrayList<>();
        for (AssessmentAnswer a : answers) {
            AssessmentQuestionOptions opt = a.getOption() != null ? a.getOption() : a.getMappedOption();
            Integer position = opt != null ? imagePositionByOptionId.get(opt.getOptionId()) : null;
            if (position != null) {
                String label = "Option " + position + " (Image)";
                if (!parts.contains(label)) {
                    parts.add(label);
                }
            }
        }
        return String.join("; ", parts);
    }

    /** One value per GAME_HEADERS column, null-filled where the student has no data. */
    @SuppressWarnings("unchecked")
    private List<Long> gameColumnValues(Map<String, Object> gameDoc) {
        List<Long> values = new ArrayList<>(GAME_HEADERS.length);
        Map<String, Object> jungle = gameDoc != null
                ? (Map<String, Object>) gameDoc.get("animal_reaction") : null;
        if (jungle != null) {
            values.addAll(Arrays.asList(
                    numOrNull(jungle.get("hits")), numOrNull(jungle.get("misses")),
                    numOrNull(jungle.get("falsePositives")), numOrNull(jungle.get("targetsShown"))));
        } else {
            values.addAll(Collections.nCopies(4, null));
        }
        Map<String, Object> rabbit = gameDoc != null
                ? (Map<String, Object>) gameDoc.get("rabbit_path") : null;
        if (rabbit != null) {
            values.addAll(Arrays.asList(
                    numOrNull(rabbit.get("score")), numOrNull(rabbit.get("totalRounds")),
                    numOrNull(rabbit.get("roundsPlayed"))));
        } else {
            values.addAll(Collections.nCopies(3, null));
        }
        Map<String, Object> hydro = gameDoc != null
                ? (Map<String, Object>) gameDoc.get("hydro_tube") : null;
        if (hydro != null) {
            values.addAll(Arrays.asList(
                    numOrNull(hydro.get("patternsCompleted")), numOrNull(hydro.get("totalPatterns")),
                    numOrNull(hydro.get("aimlessRotations")), numOrNull(hydro.get("curiousClicks")),
                    numOrNull(hydro.get("tilesCorrect")), numOrNull(hydro.get("totalTiles")),
                    numOrNull(hydro.get("timeSpentSeconds"))));
        } else {
            values.addAll(Collections.nCopies(7, null));
        }
        return values;
    }

    private Map<String, Object> fetchGameResults(Long userStudentId) {
        try {
            return firebaseService.getDocument("game_results", String.valueOf(userStudentId));
        } catch (Exception e) {
            logger.warn("BET template export: could not fetch game_results for student {}: {}",
                    userStudentId, e.getMessage());
            return null;
        }
    }

    private static Long numOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        if (o instanceof String) {
            try { return (long) Double.parseDouble((String) o); }
            catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    /** Lowercases and strips everything but letters/digits — immune to ellipses, apostrophes, mojibake. */
    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }
}
