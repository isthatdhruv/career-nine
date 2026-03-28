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

    // A section is either:
    //   MULTI_SELECT  — 1 question, N options → columns = options, value = "1"/blank
    //   SINGLE_ANSWER — N questions, each has 2+ options → value = YES/NO or A/B/C/D
    //   SELECTION     — N questions, 0-1 options each → value = "1"/blank
    private enum SectionType { MULTI_SELECT, SINGLE_ANSWER, SELECTION }

    private static class SectionMapping {
        final String letter;
        final SectionType type;
        Long singleQuestionQQId;                              // for MULTI_SELECT
        final Map<Long, Integer> optionIdToCol = new LinkedHashMap<>();   // MULTI_SELECT: optionId → col
        final Map<Long, Integer> questionIdToCol = new LinkedHashMap<>(); // SINGLE_ANSWER/SELECTION: qqId → col
        final Map<Long, List<Long>> questionOptionOrder = new LinkedHashMap<>(); // qqId → sorted optionIds (for label derivation)

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

        // ── 1. Validate assessment exists ───────────────────────────
        assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found: " + assessmentId));

        // ── 2. Load students ────────────────────────────────────────
        List<StudentAssessmentMapping> targetStudents;
        if (userStudentId != null) {
            targetStudents = mappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                    .map(Collections::singletonList)
                    .orElseThrow(() -> new RuntimeException(
                            "No mapping found for student " + userStudentId + " assessment " + assessmentId));
        } else {
            targetStudents = mappingRepository.findAllByAssessmentId(assessmentId).stream()
                    .filter(m -> "completed".equalsIgnoreCase(m.getStatus()))
                    .collect(Collectors.toList());
            if (targetStudents.isEmpty()) {
                throw new RuntimeException("No completed students found for assessment " + assessmentId);
            }
        }

        // ── 3. Load ALL answers for the assessment ──────────────────
        //    This is the single source of truth — no questionnaire navigation needed
        List<AssessmentAnswer> allAnswers;
        if (userStudentId != null) {
            allAnswers = answerRepository.findByAssessmentIdAndStudentIdForExport(assessmentId, userStudentId);
        } else {
            allAnswers = answerRepository.findAllByAssessmentIdForExport(assessmentId);
        }
        logger.info("Loaded {} answers for assessment {}", allAnswers.size(), assessmentId);

        // ── 4. Discover section structure FROM the answers ──────────
        //    Group answers by QuestionnaireSection (via answer → qq → section)
        Map<Long, QuestionnaireSection> sectionById = new LinkedHashMap<>();
        Map<Long, Set<Long>> sectionUniqueQQIds = new LinkedHashMap<>();        // sectionId → unique qqIds
        Map<Long, Map<Long, Set<Long>>> sectionQQOptions = new LinkedHashMap<>(); // sectionId → qqId → optionIds

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
            }
        }

        // Sort sections by orderIndex → A, B, C, D, E, F
        List<QuestionnaireSection> sortedSections = sectionById.values().stream()
                .sorted(Comparator.comparingInt(s -> parseInt(s.getOrder())))
                .collect(Collectors.toList());

        logger.info("Discovered {} sections from answers", sortedSections.size());

        // ── 5. Build column headers + mappings ──────────────────────
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
                // 1 question in this section → MULTI_SELECT (options = columns)
                Long theQQId = uniqueQQIds.iterator().next();
                Set<Long> optionIds = qqOptions.getOrDefault(theQQId, Collections.emptySet());
                List<Long> sortedOptionIds = new ArrayList<>(optionIds);
                Collections.sort(sortedOptionIds);

                logger.info("Section {} (id={}): MULTI_SELECT, 1 question, {} options from answers",
                        letter, secId, sortedOptionIds.size());

                SectionMapping sm = new SectionMapping(letter, SectionType.MULTI_SELECT);
                sm.singleQuestionQQId = theQQId;
                for (int j = 0; j < sortedOptionIds.size(); j++) {
                    headers.add("Sec_" + letter + "_" + (j + 1));
                    sm.optionIdToCol.put(sortedOptionIds.get(j), colOffset++);
                }
                sectionMappings.add(sm);

            } else {
                // N questions → determine type by how many options each question has
                // Check max options across questions
                int maxOptions = 0;
                for (Set<Long> opts : qqOptions.values()) {
                    maxOptions = Math.max(maxOptions, opts.size());
                }

                // Sort questions by their orderIndex
                List<Long> sortedQQIds = uniqueQQIds.stream()
                        .sorted((a2, b) -> {
                            // Find the QQ objects to get orderIndex
                            QuestionnaireQuestion qqA = findQQ(allAnswers, a2);
                            QuestionnaireQuestion qqB = findQQ(allAnswers, b);
                            return Integer.compare(
                                    parseInt(qqA != null ? qqA.getOrder() : "0"),
                                    parseInt(qqB != null ? qqB.getOrder() : "0"));
                        })
                        .collect(Collectors.toList());

                SectionType type;
                if (maxOptions >= 2) {
                    type = SectionType.SINGLE_ANSWER;
                    logger.info("Section {} (id={}): SINGLE_ANSWER, {} questions, max {} opts",
                            letter, secId, sortedQQIds.size(), maxOptions);
                } else {
                    type = SectionType.SELECTION;
                    logger.info("Section {} (id={}): SELECTION, {} questions",
                            letter, secId, sortedQQIds.size());
                }

                SectionMapping sm = new SectionMapping(letter, type);
                for (int j = 0; j < sortedQQIds.size(); j++) {
                    Long qqId = sortedQQIds.get(j);
                    headers.add("Sec_" + letter + "_" + (j + 1));
                    sm.questionIdToCol.put(qqId, colOffset++);

                    // Store option order per question (for deriving A/B/C/D labels)
                    Set<Long> opts = qqOptions.getOrDefault(qqId, Collections.emptySet());
                    sm.questionOptionOrder.put(qqId, new ArrayList<>(new TreeSet<>(opts)));
                }
                sectionMappings.add(sm);
            }
        }

        logger.info("Total columns: {}", headers.size());

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
    // ANSWER WRITING
    // ══════════════════════════════════════════════════════════════════

    private void writeAnswerColumns(Row row, List<AssessmentAnswer> answers,
            List<SectionMapping> sectionMappings) {
        for (SectionMapping sm : sectionMappings) {
            switch (sm.type) {
                case MULTI_SELECT:
                    // "1" for each selected option, blank for unselected
                    for (AssessmentAnswer a : answers) {
                        if (a.getQuestionnaireQuestion() == null || a.getOption() == null) continue;
                        if (!a.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(sm.singleQuestionQQId))
                            continue;
                        Integer col = sm.optionIdToCol.get(a.getOption().getOptionId());
                        if (col != null) {
                            row.createCell(col).setCellValue("1");
                        }
                    }
                    break;

                case SELECTION:
                    // "1" if answer exists for that question, blank otherwise
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
                    // Write option label: YES/NO for 2-option questions, A/B/C/D for 4-option
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

    /** Derive A/B/C/D or YES/NO from the option's position in the sorted option list. */
    private String deriveLabel(AssessmentQuestionOptions option, List<Long> sortedOptionIds) {
        if (option == null) return "";

        // If optionText is already a short label, use it
        String text = safe(option.getOptionText()).trim();
        if (text.matches("(?i)^[A-D]$") || text.matches("(?i)^(YES|NO|Y|N)$")) {
            return text.toUpperCase();
        }

        // Derive from position
        if (sortedOptionIds != null) {
            int idx = sortedOptionIds.indexOf(option.getOptionId());
            if (idx >= 0) {
                if (sortedOptionIds.size() == 2) {
                    return idx == 0 ? "YES" : "NO";
                }
                return String.valueOf((char) ('A' + idx));
            }
        }

        // Fallback
        return text;
    }

    /** Find a QuestionnaireQuestion by ID from the loaded answers. */
    private QuestionnaireQuestion findQQ(List<AssessmentAnswer> answers, Long qqId) {
        for (AssessmentAnswer a : answers) {
            if (a.getQuestionnaireQuestion() != null
                    && qqId.equals(a.getQuestionnaireQuestion().getQuestionnaireQuestionId())) {
                return a.getQuestionnaireQuestion();
            }
        }
        return null;
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
