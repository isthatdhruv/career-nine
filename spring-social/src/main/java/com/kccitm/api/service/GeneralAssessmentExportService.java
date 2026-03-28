package com.kccitm.api.service;

import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class GeneralAssessmentExportService {

    private static final Logger logger = LoggerFactory.getLogger(GeneralAssessmentExportService.class);

    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private SchoolSectionsRepository schoolSectionsRepository;

    private static final int DEMO_COLS = 5;

    // Section types:
    // MULTI_SELECT  = 1 question with N options, each option is a column, value = "1" if selected
    // SINGLE_ANSWER = N questions, each question is a column, value = optionText (YES/NO, A/B/C/D)
    // SELECTION     = N questions, each question is a column, value = "1" if answer exists
    private enum SectionType { MULTI_SELECT, SINGLE_ANSWER, SELECTION }

    private static class SectionMapping {
        final String letter;
        final SectionType type;
        Long questionnaireQuestionId;
        final Map<Long, Integer> optionIdToCol = new LinkedHashMap<>();
        final Map<Long, Integer> questionIdToCol = new LinkedHashMap<>();

        SectionMapping(String letter, SectionType type) {
            this.letter = letter;
            this.type = type;
        }
    }

    /** Export all completed students for an assessment. */
    @Transactional(readOnly = true)
    public byte[] exportToOldFormat(Long assessmentId) throws Exception {
        return exportToOldFormat(assessmentId, null);
    }

    /** Export a single student (or all if userStudentId is null). */
    @Transactional(readOnly = true)
    public byte[] exportToOldFormat(Long assessmentId, Long userStudentId) throws Exception {

        // ── 1. Load assessment → questionnaire ──────────────────────
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found: " + assessmentId));

        Questionnaire questionnaire = assessment.getQuestionnaire();
        if (questionnaire == null) {
            throw new RuntimeException("No questionnaire linked to assessment " + assessmentId);
        }

        // ── 2. Sort sections by orderIndex ──────────────────────────
        List<QuestionnaireSection> sections = questionnaire.getSections();
        Hibernate.initialize(sections); // force lazy load

        List<QuestionnaireSection> sortedSections = sections.stream()
                .sorted(Comparator.comparingInt(s -> parseInt(s.getOrder())))
                .collect(Collectors.toList());

        logger.info("Assessment {} has {} sections", assessmentId, sortedSections.size());

        // ── 3. Build headers + column mappings ──────────────────────
        List<String> headers = new ArrayList<>(Arrays.asList(
                "Roll Number", "Name", "Class", "School", "Section"));

        List<SectionMapping> sectionMappings = new ArrayList<>();
        int colOffset = DEMO_COLS;

        for (int i = 0; i < sortedSections.size(); i++) {
            QuestionnaireSection qs = sortedSections.get(i);
            String letter = String.valueOf((char) ('A' + i));

            Set<QuestionnaireQuestion> questions = qs.getQuestions();
            Hibernate.initialize(questions); // force lazy load

            if (questions == null || questions.isEmpty()) {
                logger.warn("Section {} ({}) has no questions — skipping", letter, qs.getQuestionnaireSectionId());
                continue;
            }

            logger.info("Section {} (id={}): {} questions", letter, qs.getQuestionnaireSectionId(), questions.size());

            if (questions.size() == 1) {
                // 1 question → check if it has multiple options
                QuestionnaireQuestion qq = questions.iterator().next();
                List<AssessmentQuestionOptions> opts = loadOptions(qq);

                if (opts.size() > 1) {
                    // MULTI_SELECT: 1 question, N options — columns are options
                    logger.info("  → MULTI_SELECT: {} options", opts.size());
                    colOffset = buildMultiSelectMapping(letter, qq, opts, headers, sectionMappings, colOffset);
                } else {
                    // 1 question with 0-1 options — treat as SELECTION
                    logger.info("  → SELECTION (single question, {} options)", opts.size());
                    colOffset = buildSelectionMapping(letter, questions, headers, sectionMappings, colOffset);
                }
            } else {
                // N questions — determine if it's MCQ (A/B/C/D, YES/NO) or selection (1 if picked)
                // Peek at first question's options to decide
                QuestionnaireQuestion firstQ = questions.iterator().next();
                List<AssessmentQuestionOptions> firstOpts = loadOptions(firstQ);

                if (firstOpts.size() >= 2) {
                    // Multiple options per question → SINGLE_ANSWER (YES/NO or A/B/C/D)
                    logger.info("  → SINGLE_ANSWER: {} questions, {} opts/q", questions.size(), firstOpts.size());
                    colOffset = buildSingleAnswerMapping(letter, questions, headers, sectionMappings, colOffset);
                } else {
                    // 0-1 options per question → SELECTION (answer exists = "1")
                    logger.info("  → SELECTION: {} questions", questions.size());
                    colOffset = buildSelectionMapping(letter, questions, headers, sectionMappings, colOffset);
                }
            }
        }

        logger.info("Total columns: {} for assessment {}", headers.size(), assessmentId);

        // ── 4. Load students ────────────────────────────────────────
        List<StudentAssessmentMapping> targetStudents;
        if (userStudentId != null) {
            targetStudents = mappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                    .map(Collections::singletonList)
                    .orElseThrow(() -> new RuntimeException(
                            "No mapping found for student " + userStudentId + " assessment " + assessmentId));
        } else {
            targetStudents = mappingRepository.findAllByAssessmentId(assessmentId)
                    .stream()
                    .filter(m -> "completed".equalsIgnoreCase(m.getStatus()))
                    .collect(Collectors.toList());
            if (targetStudents.isEmpty()) {
                throw new RuntimeException("No completed students found for assessment " + assessmentId);
            }
        }

        // ── 5. Load answers, group by student ───────────────────────
        List<AssessmentAnswer> allAnswers;
        if (userStudentId != null) {
            allAnswers = answerRepository.findByAssessmentIdAndStudentIdForExport(assessmentId, userStudentId);
        } else {
            allAnswers = answerRepository.findAllByAssessmentIdForExport(assessmentId);
        }

        logger.info("Loaded {} answers for assessment {}", allAnswers.size(), assessmentId);

        Map<Long, List<AssessmentAnswer>> answersByStudent = allAnswers.stream()
                .filter(a -> a.getUserStudent() != null)
                .collect(Collectors.groupingBy(a -> a.getUserStudent().getUserStudentId()));

        // ── 6. Section name cache ───────────────────────────────────
        Map<Integer, String> sectionNameCache = new HashMap<>();

        // ── 7. Build Excel ──────────────────────────────────────────
        XSSFWorkbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("General Assessment Data");

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

            row.createCell(0).setCellValue(si != null ? safe(si.getSchoolRollNumber()) : "");
            row.createCell(1).setCellValue(si != null ? safe(si.getName()) : "");
            row.createCell(2).setCellValue(si != null && si.getStudentClass() != null
                    ? si.getStudentClass().toString() : "");
            row.createCell(3).setCellValue(us.getInstitute() != null
                    ? safe(us.getInstitute().getInstituteName()) : "");

            String sectionName = "";
            if (si != null && si.getSchoolSectionId() != null) {
                sectionName = sectionNameCache.computeIfAbsent(si.getSchoolSectionId(), id ->
                        schoolSectionsRepository.findById(id)
                                .map(SchoolSections::getSectionName).orElse(""));
            }
            row.createCell(4).setCellValue(sectionName);

            List<AssessmentAnswer> studentAnswers = answersByStudent.getOrDefault(
                    us.getUserStudentId(), Collections.emptyList());

            writeAnswerColumns(row, studentAnswers, sectionMappings);
        }

        for (int i = 0; i < DEMO_COLS; i++) {
            sheet.autoSizeColumn(i);
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        workbook.write(out);
        workbook.close();

        logger.info("Exported {} students for assessment {}", targetStudents.size(), assessmentId);
        return out.toByteArray();
    }

    // ══════════════════════════════════════════════════════════════════
    // COLUMN MAPPING BUILDERS
    // ══════════════════════════════════════════════════════════════════

    /** Load options for a QuestionnaireQuestion, forcing Hibernate initialization. */
    private List<AssessmentQuestionOptions> loadOptions(QuestionnaireQuestion qq) {
        if (qq.getQuestion() == null) return Collections.emptyList();
        List<AssessmentQuestionOptions> opts = qq.getQuestion().getOptions();
        if (opts == null) return Collections.emptyList();
        Hibernate.initialize(opts);
        return opts.stream()
                .sorted(Comparator.comparingLong(AssessmentQuestionOptions::getOptionId))
                .collect(Collectors.toList());
    }

    /** MULTI_SELECT: 1 question with N options — each option becomes a column. */
    private int buildMultiSelectMapping(String letter, QuestionnaireQuestion qq,
            List<AssessmentQuestionOptions> options,
            List<String> headers, List<SectionMapping> mappings, int colOffset) {

        SectionMapping sm = new SectionMapping(letter, SectionType.MULTI_SELECT);
        sm.questionnaireQuestionId = qq.getQuestionnaireQuestionId();

        for (int j = 0; j < options.size(); j++) {
            headers.add("Sec_" + letter + "_" + (j + 1));
            sm.optionIdToCol.put(options.get(j).getOptionId(), colOffset++);
        }
        mappings.add(sm);
        return colOffset;
    }

    /** SINGLE_ANSWER: N questions — each question becomes a column, value = optionText. */
    private int buildSingleAnswerMapping(String letter, Set<QuestionnaireQuestion> questions,
            List<String> headers, List<SectionMapping> mappings, int colOffset) {

        List<QuestionnaireQuestion> sorted = questions.stream()
                .sorted(Comparator.comparingInt(q -> parseInt(q.getOrder())))
                .collect(Collectors.toList());

        SectionMapping sm = new SectionMapping(letter, SectionType.SINGLE_ANSWER);
        for (int j = 0; j < sorted.size(); j++) {
            headers.add("Sec_" + letter + "_" + (j + 1));
            sm.questionIdToCol.put(sorted.get(j).getQuestionnaireQuestionId(), colOffset++);
        }
        mappings.add(sm);
        return colOffset;
    }

    /** SELECTION: N questions — each question becomes a column, value = "1" if answered. */
    private int buildSelectionMapping(String letter, Set<QuestionnaireQuestion> questions,
            List<String> headers, List<SectionMapping> mappings, int colOffset) {

        List<QuestionnaireQuestion> sorted = questions.stream()
                .sorted(Comparator.comparingInt(q -> parseInt(q.getOrder())))
                .collect(Collectors.toList());

        SectionMapping sm = new SectionMapping(letter, SectionType.SELECTION);
        for (int j = 0; j < sorted.size(); j++) {
            headers.add("Sec_" + letter + "_" + (j + 1));
            sm.questionIdToCol.put(sorted.get(j).getQuestionnaireQuestionId(), colOffset++);
        }
        mappings.add(sm);
        return colOffset;
    }

    // ══════════════════════════════════════════════════════════════════
    // ANSWER WRITING
    // ══════════════════════════════════════════════════════════════════

    private void writeAnswerColumns(Row row, List<AssessmentAnswer> answers,
            List<SectionMapping> sectionMappings) {

        for (SectionMapping sm : sectionMappings) {
            switch (sm.type) {
                case MULTI_SELECT:
                    writeMultiSelect(row, answers, sm);
                    break;
                case SINGLE_ANSWER:
                    writeSingleAnswer(row, answers, sm);
                    break;
                case SELECTION:
                    writeSelection(row, answers, sm);
                    break;
            }
        }
    }

    /** MULTI_SELECT: "1" if student selected that option, blank if not. */
    private void writeMultiSelect(Row row, List<AssessmentAnswer> answers, SectionMapping sm) {
        for (AssessmentAnswer answer : answers) {
            if (answer.getQuestionnaireQuestion() == null) continue;
            if (!answer.getQuestionnaireQuestion().getQuestionnaireQuestionId()
                    .equals(sm.questionnaireQuestionId)) continue;

            if (answer.getOption() != null) {
                Integer col = sm.optionIdToCol.get(answer.getOption().getOptionId());
                if (col != null) {
                    row.createCell(col).setCellValue("1");
                }
            }
        }
    }

    /** SINGLE_ANSWER: write option label (A/B/C/D or YES/NO). */
    private void writeSingleAnswer(Row row, List<AssessmentAnswer> answers, SectionMapping sm) {
        for (AssessmentAnswer answer : answers) {
            if (answer.getQuestionnaireQuestion() == null || answer.getOption() == null) continue;

            Long qqId = answer.getQuestionnaireQuestion().getQuestionnaireQuestionId();
            Integer col = sm.questionIdToCol.get(qqId);
            if (col != null) {
                String optionText = safe(answer.getOption().getOptionText()).trim();

                // If optionText is already a short label (A/B/C/D/YES/NO), use it directly
                if (optionText.matches("(?i)^[A-D]$") || optionText.matches("(?i)^(YES|NO|Y|N)$")) {
                    row.createCell(col).setCellValue(optionText.toUpperCase());
                } else {
                    // Derive letter from option position within the question's options
                    String label = getOptionLabel(answer);
                    row.createCell(col).setCellValue(label);
                }
            }
        }
    }

    /** Determine the option label (A/B/C/D or YES/NO) from the option's position. */
    private String getOptionLabel(AssessmentAnswer answer) {
        if (answer.getOption() == null || answer.getQuestionnaireQuestion() == null) return "";

        // Try to get all options for this question to find position
        if (answer.getQuestionnaireQuestion().getQuestion() != null) {
            List<AssessmentQuestionOptions> allOptions = loadOptions(answer.getQuestionnaireQuestion());
            if (!allOptions.isEmpty()) {
                Long selectedId = answer.getOption().getOptionId();
                for (int i = 0; i < allOptions.size(); i++) {
                    if (allOptions.get(i).getOptionId().equals(selectedId)) {
                        if (allOptions.size() == 2) {
                            // 2 options → YES/NO
                            return i == 0 ? "YES" : "NO";
                        } else {
                            // N options → A, B, C, D...
                            return String.valueOf((char) ('A' + i));
                        }
                    }
                }
            }
        }

        // Fallback: use optionText as-is
        return safe(answer.getOption().getOptionText()).trim();
    }

    /** SELECTION: "1" if answer exists for that question, blank if not. */
    private void writeSelection(Row row, List<AssessmentAnswer> answers, SectionMapping sm) {
        for (AssessmentAnswer answer : answers) {
            if (answer.getQuestionnaireQuestion() == null) continue;

            Long qqId = answer.getQuestionnaireQuestion().getQuestionnaireQuestionId();
            Integer col = sm.questionIdToCol.get(qqId);
            if (col != null) {
                row.createCell(col).setCellValue("1");
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════

    private static int parseInt(String s) {
        if (s == null || s.trim().isEmpty()) return 0;
        try { return Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return 0; }
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }
}
