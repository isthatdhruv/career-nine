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

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class GeneralAssessmentExportService {

    private static final Logger logger = LoggerFactory.getLogger(GeneralAssessmentExportService.class);

    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private SchoolSectionsRepository schoolSectionsRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    private static final int DEMO_COLS = 5;

    private enum SectionType { MULTI_SELECT, SINGLE_ANSWER, SELECTION }

    private static class SectionMapping {
        final String letter;
        final SectionType type;
        Long singleQuestionQQId;
        final Map<Long, Integer> optionIdToCol = new LinkedHashMap<>();
        final Map<Long, Integer> questionIdToCol = new LinkedHashMap<>();
        final Map<Long, List<Long>> questionOptionOrder = new LinkedHashMap<>();
        // text-based fallback for MULTI_SELECT (option text lowercase → col index)
        final Map<String, Integer> textToCol = new LinkedHashMap<>();

        SectionMapping(String letter, SectionType type) {
            this.letter = letter;
            this.type = type;
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportToOldFormat(Long assessmentId) throws Exception {
        return exportToOldFormat(assessmentId, null);
    }

    @Transactional(readOnly = true)
    public byte[] exportToOldFormat(Long assessmentId, Long userStudentId) throws Exception {

        // ── 1. Validate assessment and get questionnaire ──────────────
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));
        Long questionnaireId = (assessment.getQuestionnaire() != null)
                ? assessment.getQuestionnaire().getQuestionnaireId() : null;

        // ── 2. Load target students ─────────────────────────────────
        List<StudentAssessmentMapping> targetStudents;
        if (userStudentId != null) {
            targetStudents = mappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                    .map(Collections::singletonList)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "StudentAssessmentMapping", "studentId/assessmentId", userStudentId + "/" + assessmentId));
        } else {
            targetStudents = mappingRepository.findAllByAssessmentId(assessmentId).stream()
                    .filter(m -> "completed".equalsIgnoreCase(m.getStatus()))
                    .collect(Collectors.toList());
            if (targetStudents.isEmpty()) {
                throw new ResourceNotFoundException("StudentAssessmentMapping", "assessmentId (completed)", assessmentId);
            }
        }

        // ── 3. Load ALL answers (needed for section type detection) ─
        List<AssessmentAnswer> allAnswers = answerRepository.findAllByAssessmentIdForExport(assessmentId);
        logger.info("Loaded {} answers for assessment {}", allAnswers.size(), assessmentId);

        // ── 4. Discover sections from QUESTIONNAIRE (not answers) ────
        // This ensures all options are present even if no student selected them,
        // so position-based label derivation (A/B/C/D, YES/NO) is always correct.
        Map<Long, QuestionnaireSection> sectionById = new LinkedHashMap<>();
        Map<Long, Set<Long>> sectionUniqueQQIds = new LinkedHashMap<>();
        Map<Long, Map<Long, Set<Long>>> sectionQQOptions = new LinkedHashMap<>();
        Map<Long, String> optionIdToText = new LinkedHashMap<>();

        if (questionnaireId != null) {
            List<QuestionnaireQuestion> allQQs = questionnaireQuestionRepository
                    .findByQuestionnaireIdWithOptions(questionnaireId);
            for (QuestionnaireQuestion qq : allQQs) {
                QuestionnaireSection sec = qq.getSection();
                if (sec == null) continue;

                Long secId = sec.getQuestionnaireSectionId();
                sectionById.putIfAbsent(secId, sec);
                sectionUniqueQQIds.computeIfAbsent(secId, k -> new TreeSet<>())
                        .add(qq.getQuestionnaireQuestionId());

                if (qq.getQuestion() != null && qq.getQuestion().getOptions() != null) {
                    for (AssessmentQuestionOptions opt : qq.getQuestion().getOptions()) {
                        sectionQQOptions
                                .computeIfAbsent(secId, k -> new LinkedHashMap<>())
                                .computeIfAbsent(qq.getQuestionnaireQuestionId(), k -> new TreeSet<>())
                                .add(opt.getOptionId());
                        optionIdToText.putIfAbsent(opt.getOptionId(), safe(opt.getOptionText()));
                    }
                }
            }
        }

        // Fallback: if no questionnaire linked, discover from answers (legacy behavior)
        if (sectionById.isEmpty()) {
            for (AssessmentAnswer a : allAnswers) {
                if (a.getQuestionnaireQuestion() == null) continue;
                QuestionnaireQuestion qq = a.getQuestionnaireQuestion();
                QuestionnaireSection sec = qq.getSection();
                if (sec == null) continue;

                Long secId = sec.getQuestionnaireSectionId();
                sectionById.putIfAbsent(secId, sec);
                sectionUniqueQQIds.computeIfAbsent(secId, k -> new TreeSet<>())
                        .add(qq.getQuestionnaireQuestionId());

                if (a.getOption() != null) {
                    sectionQQOptions
                            .computeIfAbsent(secId, k -> new LinkedHashMap<>())
                            .computeIfAbsent(qq.getQuestionnaireQuestionId(), k -> new TreeSet<>())
                            .add(a.getOption().getOptionId());
                    optionIdToText.putIfAbsent(a.getOption().getOptionId(), safe(a.getOption().getOptionText()));
                }
            }
        }

        List<QuestionnaireSection> sortedSections = sectionById.values().stream()
                .sorted(Comparator.comparingInt(s -> parseInt(s.getOrder())))
                .collect(Collectors.toList());

        // Build a QQ lookup map for ordering (works with questionnaire-sourced data)
        Map<Long, QuestionnaireQuestion> qqById = new LinkedHashMap<>();
        if (questionnaireId != null) {
            List<QuestionnaireQuestion> allQQsList = questionnaireQuestionRepository
                    .findByQuestionnaireIdWithOptions(questionnaireId);
            for (QuestionnaireQuestion qq : allQQsList) {
                qqById.put(qq.getQuestionnaireQuestionId(), qq);
            }
        }
        // Also index from answers as fallback
        for (AssessmentAnswer a : allAnswers) {
            if (a.getQuestionnaireQuestion() != null) {
                qqById.putIfAbsent(a.getQuestionnaireQuestion().getQuestionnaireQuestionId(),
                        a.getQuestionnaireQuestion());
            }
        }

        // ── 5. Build headers + column mappings ──────────────────────
        List<String> headers = new ArrayList<>(Arrays.asList(
                "Roll Number", "Name", "Class", "School", "Section"));

        List<SectionMapping> sectionMappings = new ArrayList<>();
        int colOffset = DEMO_COLS;

        for (int i = 0; i < sortedSections.size(); i++) {
            QuestionnaireSection sec = sortedSections.get(i);
            Long secId = sec.getQuestionnaireSectionId();
            String letter = String.valueOf((char) ('A' + i));

            Set<Long> uniqueQQIds = sectionUniqueQQIds.getOrDefault(secId, Collections.emptySet());
            Map<Long, Set<Long>> qqOptions = sectionQQOptions.getOrDefault(secId, Collections.emptyMap());

            if (uniqueQQIds.size() == 1) {
                // MULTI_SELECT: 1 question, N options → "1"/blank
                Long theQQId = uniqueQQIds.iterator().next();
                List<Long> sortedOptionIds = new ArrayList<>(
                        qqOptions.getOrDefault(theQQId, Collections.emptySet()));
                Collections.sort(sortedOptionIds);

                SectionMapping sm = new SectionMapping(letter, SectionType.MULTI_SELECT);
                sm.singleQuestionQQId = theQQId;
                for (int j = 0; j < sortedOptionIds.size(); j++) {
                    Long optId = sortedOptionIds.get(j);
                    int col = colOffset++;
                    headers.add("Sec_" + letter + "_" + (j + 1));
                    sm.optionIdToCol.put(optId, col);
                    String optText = optionIdToText.get(optId);
                    if (optText != null && !optText.isEmpty()) {
                        sm.textToCol.put(optText.toLowerCase().trim(), col);
                    }
                }
                sectionMappings.add(sm);
            } else {
                int maxOptions = qqOptions.values().stream().mapToInt(Set::size).max().orElse(0);

                List<Long> sortedQQIds = uniqueQQIds.stream()
                        .sorted((a2, b) -> {
                            QuestionnaireQuestion qqA = qqById.get(a2);
                            QuestionnaireQuestion qqB = qqById.get(b);
                            return Integer.compare(
                                    parseInt(qqA != null ? qqA.getOrder() : "0"),
                                    parseInt(qqB != null ? qqB.getOrder() : "0"));
                        })
                        .collect(Collectors.toList());

                SectionType type = maxOptions >= 2 ? SectionType.SINGLE_ANSWER : SectionType.SELECTION;

                SectionMapping sm = new SectionMapping(letter, type);
                for (int j = 0; j < sortedQQIds.size(); j++) {
                    Long qqId = sortedQQIds.get(j);
                    headers.add("Sec_" + letter + "_" + (j + 1));
                    sm.questionIdToCol.put(qqId, colOffset++);
                    Set<Long> opts = qqOptions.getOrDefault(qqId, Collections.emptySet());
                    sm.questionOptionOrder.put(qqId, new ArrayList<>(new TreeSet<>(opts)));
                }
                sectionMappings.add(sm);
            }
        }

        // ── 6. Group answers by student ─────────────────────────────
        Map<Long, List<AssessmentAnswer>> answersByStudent = allAnswers.stream()
                .filter(a -> a.getUserStudent() != null)
                .collect(Collectors.groupingBy(a -> a.getUserStudent().getUserStudentId()));

        // ── 7. Build Excel ──────────────────────────────────────────
        Map<Integer, String> sectionNameCache = new HashMap<>();
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

    private void writeAnswerColumns(Row row, List<AssessmentAnswer> answers,
            List<SectionMapping> sectionMappings) {
        for (SectionMapping sm : sectionMappings) {
            switch (sm.type) {
                case MULTI_SELECT:
                    // Pre-fill all MULTI_SELECT columns with "BLANK"
                    for (Integer col : sm.optionIdToCol.values()) {
                        row.createCell(col).setCellValue("BLANK");
                    }
                    // Overwrite selected options with "1" (option FK present)
                    for (AssessmentAnswer a : answers) {
                        if (a.getQuestionnaireQuestion() == null || a.getOption() == null) continue;
                        if (!a.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(sm.singleQuestionQQId))
                            continue;
                        Integer col = sm.optionIdToCol.get(a.getOption().getOptionId());
                        if (col != null) {
                            row.createCell(col).setCellValue("1");
                        }
                    }
                    // Fallback: text-based answers (imported from Firebase without optionId)
                    if (!sm.textToCol.isEmpty()) {
                        for (AssessmentAnswer a : answers) {
                            if (a.getQuestionnaireQuestion() == null || a.getOption() != null) continue;
                            if (!a.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(sm.singleQuestionQQId))
                                continue;
                            String txt = a.getTextResponse();
                            if (txt == null || txt.isEmpty()) continue;
                            String txtKey = txt.toLowerCase().trim();
                            // Exact match first
                            Integer col = sm.textToCol.get(txtKey);
                            if (col == null) {
                                // Partial match: check if any option text contains or is contained by textResponse
                                for (Map.Entry<String, Integer> entry : sm.textToCol.entrySet()) {
                                    if (entry.getKey().contains(txtKey) || txtKey.contains(entry.getKey())) {
                                        col = entry.getValue();
                                        break;
                                    }
                                }
                            }
                            if (col != null) {
                                row.createCell(col).setCellValue("1");
                            }
                        }
                    }
                    break;

                case SELECTION:
                    for (AssessmentAnswer a : answers) {
                        if (a.getQuestionnaireQuestion() == null) continue;
                        Long qqId = a.getQuestionnaireQuestion().getQuestionnaireQuestionId();
                        Integer col = sm.questionIdToCol.get(qqId);
                        if (col != null) {
                            row.createCell(col).setCellValue("1");
                        }
                    }
                    break;

                case SINGLE_ANSWER:
                    for (AssessmentAnswer a : answers) {
                        if (a.getQuestionnaireQuestion() == null || a.getOption() == null) continue;
                        Long qqId = a.getQuestionnaireQuestion().getQuestionnaireQuestionId();
                        Integer col = sm.questionIdToCol.get(qqId);
                        if (col != null) {
                            String label = deriveLabel(a.getOption(), sm.questionOptionOrder.get(qqId));
                            row.createCell(col).setCellValue(label);
                        }
                    }
                    break;
            }
        }
    }

    private String deriveLabel(AssessmentQuestionOptions option, List<Long> sortedOptionIds) {
        if (option == null) return "";
        String text = safe(option.getOptionText()).trim();
        if (text.matches("(?i)^[A-D]$") || text.matches("(?i)^(YES|NO|Y|N)$")) {
            return text.toUpperCase();
        }
        if (sortedOptionIds != null) {
            int idx = sortedOptionIds.indexOf(option.getOptionId());
            if (idx >= 0) {
                if (sortedOptionIds.size() == 2) return idx == 0 ? "YES" : "NO";
                return String.valueOf((char) ('A' + idx));
            }
        }
        return text;
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
