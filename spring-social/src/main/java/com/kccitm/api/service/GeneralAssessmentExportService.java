package com.kccitm.api.service;

import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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

    private static final int DEMO_COLS = 5; // Roll Number, Name, Class, School, Section

    // ── Internal helper: tracks how one questionnaire section maps to Excel columns ──

    private enum SectionType { MULTI_SELECT, SINGLE_ANSWER }

    private static class SectionMapping {
        final String letter;
        final SectionType type;
        Long questionnaireQuestionId;                         // only for MULTI_SELECT (the single question's ID)
        final Map<Long, Integer> optionIdToCol = new LinkedHashMap<>();   // optionId  → colIndex (MULTI_SELECT)
        final Map<Long, Integer> questionIdToCol = new LinkedHashMap<>(); // qqId      → colIndex (SINGLE_ANSWER)

        SectionMapping(String letter, SectionType type) {
            this.letter = letter;
            this.type = type;
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public byte[] exportToOldFormat(Long assessmentId) throws Exception {

        // ── 1. Load assessment → questionnaire ──────────────────────
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found: " + assessmentId));

        Questionnaire questionnaire = assessment.getQuestionnaire();
        if (questionnaire == null) {
            throw new RuntimeException("No questionnaire linked to assessment " + assessmentId);
        }

        // ── 2. Sort sections by orderIndex → A, B, C, D, E, F ──────
        List<QuestionnaireSection> sortedSections = questionnaire.getSections().stream()
                .sorted(Comparator.comparingInt(s -> parseInt(s.getOrder())))
                .collect(Collectors.toList());

        // ── 3. Build headers + column mappings ──────────────────────
        List<String> headers = new ArrayList<>(Arrays.asList(
                "Roll Number", "Name", "Class", "School", "Section"));

        List<SectionMapping> sectionMappings = new ArrayList<>();
        int colOffset = DEMO_COLS;

        for (int i = 0; i < sortedSections.size(); i++) {
            QuestionnaireSection qs = sortedSections.get(i);
            String letter = String.valueOf((char) ('A' + i));

            // Force lazy-load questions within this transaction
            Set<QuestionnaireQuestion> questions = qs.getQuestions();
            if (questions == null || questions.isEmpty()) continue;

            if (questions.size() == 1) {
                // ─── MULTI_SELECT: 1 question, N options ───
                colOffset = buildMultiSelectMapping(letter, questions.iterator().next(),
                        headers, sectionMappings, colOffset);
            } else {
                // ─── SINGLE_ANSWER: N questions, 1 answer each ───
                colOffset = buildSingleAnswerMapping(letter, questions,
                        headers, sectionMappings, colOffset);
            }
        }

        logger.info("Export columns: {} headers for assessment {}", headers.size(), assessmentId);

        // ── 4. Load completed students ──────────────────────────────
        List<StudentAssessmentMapping> completed = mappingRepository.findAllByAssessmentId(assessmentId)
                .stream()
                .filter(m -> "completed".equalsIgnoreCase(m.getStatus()))
                .collect(Collectors.toList());

        if (completed.isEmpty()) {
            throw new RuntimeException("No completed students found for assessment " + assessmentId);
        }

        // ── 5. Bulk-load all answers, group by student ──────────────
        List<AssessmentAnswer> allAnswers = answerRepository.findAllByAssessmentIdForExport(assessmentId);
        Map<Long, List<AssessmentAnswer>> answersByStudent = allAnswers.stream()
                .collect(Collectors.groupingBy(a -> a.getUserStudent().getUserStudentId()));

        // ── 6. Section name cache (schoolSectionId → name) ──────────
        Map<Integer, String> sectionNameCache = new HashMap<>();

        // ── 7. Build Excel workbook ─────────────────────────────────
        XSSFWorkbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("General Assessment Data");

        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);

        // Header row
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.size(); i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers.get(i));
            cell.setCellStyle(headerStyle);
        }

        // Data rows — one per completed student
        int rowIdx = 1;
        for (StudentAssessmentMapping sam : completed) {
            UserStudent us = sam.getUserStudent();
            StudentInfo si = us.getStudentInfo(); // lazy — OK inside @Transactional

            Row row = sheet.createRow(rowIdx++);

            // Demographics
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

            // Answer columns
            List<AssessmentAnswer> studentAnswers = answersByStudent.getOrDefault(
                    us.getUserStudentId(), Collections.emptyList());

            writeAnswerColumns(row, studentAnswers, sectionMappings);
        }

        // Auto-size demographic columns only (section cols are narrow single-char)
        for (int i = 0; i < DEMO_COLS; i++) {
            sheet.autoSizeColumn(i);
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        workbook.write(out);
        workbook.close();

        logger.info("Exported {} students for assessment {}", completed.size(), assessmentId);
        return out.toByteArray();
    }

    // ══════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════════

    private int buildMultiSelectMapping(String letter, QuestionnaireQuestion qq,
            List<String> headers, List<SectionMapping> mappings, int colOffset) {

        // Sort options by optionId ascending (creation order = questionnaire order)
        List<AssessmentQuestionOptions> options = qq.getQuestion().getOptions().stream()
                .sorted(Comparator.comparingLong(AssessmentQuestionOptions::getOptionId))
                .collect(Collectors.toList());

        SectionMapping sm = new SectionMapping(letter, SectionType.MULTI_SELECT);
        sm.questionnaireQuestionId = qq.getQuestionnaireQuestionId();

        for (int j = 0; j < options.size(); j++) {
            headers.add("Sec_" + letter + "_" + (j + 1));
            sm.optionIdToCol.put(options.get(j).getOptionId(), colOffset++);
        }
        mappings.add(sm);
        return colOffset;
    }

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

    private void writeAnswerColumns(Row row, List<AssessmentAnswer> answers,
            List<SectionMapping> sectionMappings) {

        for (SectionMapping sm : sectionMappings) {
            if (sm.type == SectionType.MULTI_SELECT) {
                // Check which options the student selected for this question
                for (AssessmentAnswer answer : answers) {
                    if (answer.getQuestionnaireQuestion() == null || answer.getOption() == null) continue;
                    if (!answer.getQuestionnaireQuestion().getQuestionnaireQuestionId()
                            .equals(sm.questionnaireQuestionId)) continue;

                    Integer col = sm.optionIdToCol.get(answer.getOption().getOptionId());
                    if (col != null) {
                        row.createCell(col).setCellValue("1");
                    }
                }
                // Non-selected options → cell never created → blank
            } else {
                // Write the selected option text for each question
                for (AssessmentAnswer answer : answers) {
                    if (answer.getQuestionnaireQuestion() == null || answer.getOption() == null) continue;

                    Long qqId = answer.getQuestionnaireQuestion().getQuestionnaireQuestionId();
                    Integer col = sm.questionIdToCol.get(qqId);
                    if (col != null) {
                        row.createCell(col).setCellValue(safe(answer.getOption().getOptionText()));
                    }
                }
            }
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
