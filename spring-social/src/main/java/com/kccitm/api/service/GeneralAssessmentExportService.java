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
                .orElseThrow(() -> new RuntimeException("Assessment not found: " + assessmentId));
        Long questionnaireId = (assessment.getQuestionnaire() != null)
                ? assessment.getQuestionnaire().getQuestionnaireId() : null;

        // ── 2. Load target students ─────────────────────────────────
        List<StudentAssessmentMapping> targetStudents;
        if (userStudentId != null) {
            targetStudents = mappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                    .map(Collections::singletonList)
                    .orElseThrow(() -> new RuntimeException(
                            "No mapping found for student " + userStudentId + " assessment " + assessmentId));
        } else {
            // Include both "completed" and "ongoing" students so Firebase-imported
            // students (which may remain "ongoing" if their questionnaire has more
            // questions than the Firebase assessment covered) are not silently excluded.
            targetStudents = mappingRepository.findAllByAssessmentId(assessmentId).stream()
                    .filter(m -> "completed".equalsIgnoreCase(m.getStatus())
                              || "ongoing".equalsIgnoreCase(m.getStatus()))
                    .collect(Collectors.toList());
            if (targetStudents.isEmpty()) {
                throw new RuntimeException("No students found for assessment " + assessmentId);
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
        // Use LinkedHashSet to preserve insertion order (= sequence order from DB)
        // instead of TreeSet which sorts by optionId
        Map<Long, Map<Long, List<Long>>> sectionQQOptions = new LinkedHashMap<>();
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
                    // Iterate options in their natural list order (sequence order from DB)
                    for (AssessmentQuestionOptions opt : qq.getQuestion().getOptions()) {
                        List<Long> optList = sectionQQOptions
                                .computeIfAbsent(secId, k -> new LinkedHashMap<>())
                                .computeIfAbsent(qq.getQuestionnaireQuestionId(), k -> new ArrayList<>());
                        if (!optList.contains(opt.getOptionId())) {
                            optList.add(opt.getOptionId());
                        }
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
                    List<Long> optList = sectionQQOptions
                            .computeIfAbsent(secId, k -> new LinkedHashMap<>())
                            .computeIfAbsent(qq.getQuestionnaireQuestionId(), k -> new ArrayList<>());
                    if (!optList.contains(a.getOption().getOptionId())) {
                        optList.add(a.getOption().getOptionId());
                    }
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
            Map<Long, List<Long>> qqOptions = sectionQQOptions.getOrDefault(secId, Collections.emptyMap());

            if (uniqueQQIds.size() == 1) {
                // MULTI_SELECT: 1 question, N options → "1"/blank
                Long theQQId = uniqueQQIds.iterator().next();
                List<Long> optionIds = qqOptions.getOrDefault(theQQId, Collections.emptyList());

                SectionMapping sm = new SectionMapping(letter, SectionType.MULTI_SELECT);
                sm.singleQuestionQQId = theQQId;
                for (int j = 0; j < optionIds.size(); j++) {
                    Long optId = optionIds.get(j);
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
                int maxOptions = qqOptions.values().stream().mapToInt(List::size).max().orElse(0);

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
                    List<Long> opts = qqOptions.getOrDefault(qqId, Collections.emptyList());
                    sm.questionOptionOrder.put(qqId, new ArrayList<>(opts));
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
            writeAnswerColumns(row, studentAnswers, sectionMappings, optionIdToText);
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
            List<SectionMapping> sectionMappings, Map<Long, String> optionIdToText) {
        for (SectionMapping sm : sectionMappings) {
            switch (sm.type) {
                case MULTI_SELECT:
                    // Pre-fill all MULTI_SELECT columns with "BLANK"
                    for (Integer col : sm.optionIdToCol.values()) {
                        row.createCell(col).setCellValue("BLANK");
                    }
                    // Overwrite selected options with "1" (option or mappedOption FK present)
                    for (AssessmentAnswer a : answers) {
                        // Skip answers not in this section (check QQ if available)
                        if (a.getQuestionnaireQuestion() != null
                                && !a.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(sm.singleQuestionQQId))
                            continue;

                        AssessmentQuestionOptions msOpt = a.getOption() != null ? a.getOption() : a.getMappedOption();

                        if (msOpt != null) {
                            // Option-based: place by optionId
                            Integer col = sm.optionIdToCol.get(msOpt.getOptionId());
                            if (col != null) {
                                row.createCell(col).setCellValue("1");
                            }
                        } else if (a.getTextResponse() != null && !a.getTextResponse().isEmpty() && !sm.textToCol.isEmpty()) {
                            // Text-based fallback (Firebase import without optionId)
                            String txtKey = a.getTextResponse().toLowerCase().trim();
                            Integer col = sm.textToCol.get(txtKey);
                            if (col == null) {
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
                        // Resolve effective option: option → mappedOption → null
                        AssessmentQuestionOptions effectiveOpt = a.getOption() != null ? a.getOption() : a.getMappedOption();

                        // Find column: try QQ first, fall back to option's parent question
                        Long qqId = null;
                        Integer col = null;
                        if (a.getQuestionnaireQuestion() != null) {
                            qqId = a.getQuestionnaireQuestion().getQuestionnaireQuestionId();
                            col = sm.questionIdToCol.get(qqId);
                        }
                        // Fallback: if QQ is null but option exists, find column via option ID
                        if (col == null && effectiveOpt != null) {
                            for (Map.Entry<Long, List<Long>> entry : sm.questionOptionOrder.entrySet()) {
                                if (entry.getValue().contains(effectiveOpt.getOptionId())) {
                                    qqId = entry.getKey();
                                    col = sm.questionIdToCol.get(qqId);
                                    break;
                                }
                            }
                        }

                        if (col != null) {
                            if (effectiveOpt != null) {
                                String label = deriveLabel(effectiveOpt, sm.questionOptionOrder.get(qqId));
                                row.createCell(col).setCellValue(label);
                            } else if (a.getTextResponse() != null && !a.getTextResponse().trim().isEmpty()) {
                                // Text-only answer (Firebase import) — try to match to an option label
                                String txt = a.getTextResponse().trim();
                                List<Long> optOrder = sm.questionOptionOrder.get(qqId);
                                String label = deriveLabelFromText(txt, optOrder, optionIdToText);
                                row.createCell(col).setCellValue(label);
                            }
                        }
                    }
                    break;
            }
        }
    }

    private String deriveLabel(AssessmentQuestionOptions option, List<Long> sortedOptionIds) {
        if (option == null) return "";
        String text = safe(option.getOptionText()).trim();
        // If option text is already a standard label (A-D, YES/NO), use directly
        if (text.matches("(?i)^[A-D]$") || text.matches("(?i)^(YES|NO|Y|N)$")) {
            return text.toUpperCase();
        }
        // Otherwise derive positional label (A/B/C/D)
        if (sortedOptionIds != null) {
            int idx = sortedOptionIds.indexOf(option.getOptionId());
            if (idx >= 0) {
                return String.valueOf((char) ('A' + idx));
            }
        }
        return text;
    }

    private String deriveLabelFromText(String text, List<Long> sortedOptionIds, Map<Long, String> optionIdToText) {
        if (text == null || text.isEmpty()) return "";
        // If text is already a standard label (Yes/No/A-D), use directly
        if (text.matches("(?i)^[A-D]$") || text.matches("(?i)^(YES|NO|Y|N)$")) {
            return text.toUpperCase();
        }
        if (sortedOptionIds == null || sortedOptionIds.isEmpty() || optionIdToText == null) return "BLANK";

        String txtLower = text.toLowerCase().trim();
        // Also normalize: strip non-alphanumeric, collapse whitespace (handles smart quotes, etc.)
        String txtNorm = text.replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit} ]", " ")
                .toLowerCase().replaceAll("\\s+", " ").trim();

        for (int pass = 0; pass < 4; pass++) {
            for (int i = 0; i < sortedOptionIds.size(); i++) {
                String rawOpt = safe(optionIdToText.get(sortedOptionIds.get(i)));
                String optLower = rawOpt.toLowerCase().trim();
                String optNorm = rawOpt.replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit} ]", " ")
                        .toLowerCase().replaceAll("\\s+", " ").trim();
                if (optLower.isEmpty()) continue;

                boolean matched = false;
                switch (pass) {
                    case 0: // Exact match
                        matched = optLower.equals(txtLower) || optNorm.equals(txtNorm);
                        break;
                    case 1: // Contains match
                        matched = optLower.contains(txtLower) || txtLower.contains(optLower)
                                || optNorm.contains(txtNorm) || txtNorm.contains(optNorm);
                        break;
                    case 2: // Normalized exact match (handles smart quotes, special chars)
                        matched = optNorm.equals(txtNorm);
                        break;
                    case 3: // Prefix match (at least 10 chars)
                        int minLen = Math.min(optNorm.length(), txtNorm.length());
                        int overlap = 0;
                        for (int c = 0; c < minLen; c++) {
                            if (optNorm.charAt(c) == txtNorm.charAt(c)) overlap++;
                            else break;
                        }
                        matched = overlap >= 10;
                        break;
                }

                if (matched) {
                    if (rawOpt.trim().matches("(?i)^(YES|NO|Y|N)$")) return rawOpt.trim().toUpperCase();
                    return String.valueOf((char) ('A' + i));
                }
            }
        }
        // Fallback: return BLANK — don't output raw text in OMR export
        return "BLANK";
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
