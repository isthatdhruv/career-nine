package com.kccitm.api.service.Navigator;

import java.util.*;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.NavigatorReportData;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.NavigatorReportDataRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class NavigatorReportGenerationService {

    private static final Logger logger = LoggerFactory.getLogger(NavigatorReportGenerationService.class);

    @Autowired private NavigatorReportDataRepository navigatorReportDataRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private AssessmentAnswerRepository assessmentAnswerRepository;
    @Autowired private NavigatorCoreAnalysis coreAnalysis;
    @Autowired private NavigatorAISummaryService aiSummaryService;

    // ── Section A: Career Aspiration labels (24 options, sorted by option ID) ──
    private static final String[] CAREER_ASP_LABELS = {
        "Architecture", "Art Design", "Entertainment and Mass Media",
        "Management and Administration", "Banking and Finance", "Law Studies",
        "Government and Public Administration", "Marketing", "Entrepreneurship",
        "Sales", "Science and Mathematics", "Computer Science IT and Allied Fields",
        "Life Sciences/Medicine and Healthcare", "Environmental Service",
        "Social Sciences and Humanities", "Defence/Protective Service", "Sports",
        "Engineering and Technology", "Agriculture Food Industry and Forestry",
        "Education and Training", "Paramedical", "Hospitality and Tourism",
        "Community and Social Service", "Personal Care and Services"
    };

    // ── Section B: Value labels (15 options, sorted by option ID) ──
    private static final String[] VALUE_LABELS = {
        "Lucrative Salary", "Job Security", "Variety and Diversity",
        "Building Relations", "High achievement", "Autonomy",
        "Hands on activities", "Prestige/Recognition", "Creativity",
        "Mental Activity", "Physical Activity", "Leadership",
        "Routine Activity", "Supervised Work", "Working Conditions"
    };

    // ── Section C: SOI labels (15 options, sorted by option ID) ──
    private static final String[] SOI_LABELS = {
        "Agriculture", "Art", "Cultural Studies", "English",
        "Home and Consumer Science", "Finance", "Health", "Languages",
        "Management", "Mathematics", "Music", "Science",
        "Vocational studies", "Social Sciences", "Technology"
    };

    // ── Section D: RIASEC letter cycle ──
    private static final String[] RIASEC_LETTERS = {"R", "I", "A", "S", "E", "C"};

    // ── RIASEC display names for bar chart labels ──
    private static final Map<String, String> RIASEC_DISPLAY_NAMES = new LinkedHashMap<>();
    static {
        RIASEC_DISPLAY_NAMES.put("R", "Doer");
        RIASEC_DISPLAY_NAMES.put("I", "Thinker");
        RIASEC_DISPLAY_NAMES.put("A", "Creator");
        RIASEC_DISPLAY_NAMES.put("S", "Helper");
        RIASEC_DISPLAY_NAMES.put("E", "Persuader");
        RIASEC_DISPLAY_NAMES.put("C", "Organizer");
    }

    // ── Section E: Aptitude question-to-ability mapping ──
    // Index = question number (1-based), maps to ability name
    private static final String[] APTITUDE_NAMES = {
        "Speed and accuracy", "Computational", "Creativity/Artistic",
        "Language/Communication", "Technical", "Decision making & problem solving",
        "Finger dexterity", "Form perception", "Logical reasoning", "Motor movement"
    };

    // Q1,Q11,Q21 → ability 0; Q2,Q12,Q22 → ability 1; etc.
    // Pattern: question q (1-based) maps to ability index ((q-1) % 10)

    // ── Section F: MI names by group ──
    private static final String[] MI_NAMES = {
        "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
        "Logical-Mathematical", "Musical", "Visual-Spatial", "Naturalistic"
    };

    // ═══════════════════════ MAIN GENERATE METHOD ═══════════════════════

    /**
     * Generate Navigator report data for a single student.
     * Implements the OMR scoring logic as an intermediary step:
     * converts raw answers into computed scores for personality, intelligence,
     * aptitude, SOI, values, and career aspirations.
     *
     * @return the saved NavigatorReportData, or null if student has no completed assessment
     */
    public NavigatorReportData generateForStudent(Long userStudentId, Long assessmentId) {
        return generateForStudent(userStudentId, assessmentId, false);
    }

    public NavigatorReportData generateForStudent(Long userStudentId, Long assessmentId, boolean skipAI) {
        UserStudent us = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new RuntimeException("Student not found: " + userStudentId));

        Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        if (mappingOpt.isEmpty() || !"completed".equals(mappingOpt.get().getStatus())) {
            return null;
        }

        StudentInfo si = us.getStudentInfo();
        String studentName = (si != null && si.getName() != null) ? si.getName() : "";
        String studentClass = resolveClass(si);
        String studentSchool = (us.getInstitute() != null && us.getInstitute().getInstituteName() != null)
                ? us.getInstitute().getInstituteName() : "";

        // ── 1. Load ALL answers for section structure discovery ──
        List<AssessmentAnswer> allAnswers = assessmentAnswerRepository
                .findAllByAssessmentIdForExport(assessmentId);

        // ── 2. Discover section structure (same logic as GeneralAssessmentExportService) ──
        Map<Long, QuestionnaireSection> sectionById = new LinkedHashMap<>();
        Map<Long, Set<Long>> sectionUniqueQQIds = new LinkedHashMap<>();
        Map<Long, Map<Long, Set<Long>>> sectionQQOptions = new LinkedHashMap<>();

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

        List<QuestionnaireSection> sortedSections = sectionById.values().stream()
                .sorted(Comparator.comparingInt(s -> parseInt(s.getOrder())))
                .collect(Collectors.toList());

        // ── 3. Build section metadata (letter assignments + type detection) ──
        List<SectionMeta> sectionMetas = new ArrayList<>();
        for (int i = 0; i < sortedSections.size(); i++) {
            QuestionnaireSection sec = sortedSections.get(i);
            Long secId = sec.getQuestionnaireSectionId();
            String letter = String.valueOf((char) ('A' + i));

            Set<Long> uniqueQQIds = sectionUniqueQQIds.getOrDefault(secId, Collections.emptySet());
            Map<Long, Set<Long>> qqOptions = sectionQQOptions.getOrDefault(secId, Collections.emptyMap());

            boolean isMultiSelect = (uniqueQQIds.size() == 1);
            int maxOptions = qqOptions.values().stream().mapToInt(Set::size).max().orElse(0);
            boolean isSingleAnswer = !isMultiSelect && maxOptions >= 2;

            // Sort question IDs by their order within the section
            List<Long> sortedQQIds = uniqueQQIds.stream()
                    .sorted((a2, b) -> {
                        QuestionnaireQuestion qqA = findQQ(allAnswers, a2);
                        QuestionnaireQuestion qqB = findQQ(allAnswers, b);
                        return Integer.compare(
                                parseInt(qqA != null ? qqA.getOrder() : "0"),
                                parseInt(qqB != null ? qqB.getOrder() : "0"));
                    })
                    .collect(Collectors.toList());

            // For multi-select, get sorted option IDs
            List<Long> sortedOptionIds = Collections.emptyList();
            Long singleQQId = null;
            if (isMultiSelect && !uniqueQQIds.isEmpty()) {
                singleQQId = uniqueQQIds.iterator().next();
                sortedOptionIds = new ArrayList<>(
                        qqOptions.getOrDefault(singleQQId, Collections.emptySet()));
                Collections.sort(sortedOptionIds);
            }

            String sectionName = "";
            if (sec.getSection() != null && sec.getSection().getSectionName() != null) {
                sectionName = sec.getSection().getSectionName().toLowerCase();
            }
            sectionMetas.add(new SectionMeta(letter, secId, isMultiSelect, isSingleAnswer,
                    sortedQQIds, sortedOptionIds, singleQQId, qqOptions, sectionName));
        }

        logger.info("Discovered {} sections for assessment {}: {}",
                sectionMetas.size(), assessmentId,
                sectionMetas.stream().map(sm -> sm.letter + "(" +
                        (sm.isMultiSelect ? "MULTI:" + sm.sortedOptionIds.size() + "opts" :
                         sm.isSingleAnswer ? "SINGLE:" + sm.sortedQQIds.size() + "qs" :
                         "SEL:" + sm.sortedQQIds.size() + "qs") + ")")
                        .collect(Collectors.joining(", ")));

        // ── 4. Filter to this student's answers ──
        List<AssessmentAnswer> studentAnswers = allAnswers.stream()
                .filter(a -> a.getUserStudent() != null
                        && a.getUserStudent().getUserStudentId().equals(userStudentId))
                .collect(Collectors.toList());

        // ── 5. Compute intermediary scores from student answers ──
        // Maps to hold computed scores
        Map<String, Integer> riasecScores = new LinkedHashMap<>();   // R,I,A,S,E,C → score
        Map<String, Integer> aptitudeScores = new LinkedHashMap<>(); // ability name → score
        Map<String, Integer> miScores = new LinkedHashMap<>();       // MI name → score
        List<String> selectedSOIs = new ArrayList<>();
        List<String> selectedValues = new ArrayList<>();
        List<String> selectedCareerAsps = new ArrayList<>();

        // Initialize score maps
        for (String l : RIASEC_LETTERS) riasecScores.put(l, 0);
        for (String a : APTITUDE_NAMES) aptitudeScores.put(a, 0);
        for (String m : MI_NAMES) miScores.put(m, 0);

        // Detect sections by content (question count + type) instead of letter position.
        // Different questionnaires (Insight/Subject/Career Navigator) have different section orders.
        for (SectionMeta sm : sectionMetas) {
            int qCount = sm.sortedQQIds.size();
            int optCount = sm.sortedOptionIds.size();

            if (sm.isMultiSelect) {
                // MULTI_SELECT sections: identify by section name first (reliable),
                // fall back to option count (unreliable when few students have answered).
                // optCount = distinct options selected by all students — NOT total defined options.
                String name = sm.sectionName;
                boolean isCareerAsp = name.contains("career") || name.contains("aspir");
                boolean isValues    = name.contains("value");
                boolean isSOI       = name.contains("interest") || name.contains("soi")
                                      || name.contains("subject");

                if (isCareerAsp || (!isValues && !isSOI && optCount >= 20)) {
                    selectedCareerAsps = extractMultiSelectLabels(studentAnswers, sm, CAREER_ASP_LABELS);
                } else if (isValues || (!isCareerAsp && !isSOI && optCount >= 14 && optCount <= 16)) {
                    selectedValues = extractMultiSelectLabels(studentAnswers, sm, VALUE_LABELS);
                } else if (isSOI || (!isCareerAsp && !isValues && optCount > 0)) {
                    selectedSOIs = extractMultiSelectLabels(studentAnswers, sm, SOI_LABELS);
                }
            } else if (sm.isSingleAnswer) {
                // SINGLE_ANSWER sections: identify by question count
                // Use flags to avoid overwriting already-detected sections
                boolean riasecDone = riasecScores.values().stream().mapToInt(Integer::intValue).sum() > 0;
                boolean aptitudeDone = aptitudeScores.values().stream().mapToInt(Integer::intValue).sum() > 0;
                boolean miDone = miScores.values().stream().mapToInt(Integer::intValue).sum() > 0;

                if (qCount >= 48 && qCount <= 60 && !riasecDone) {
                    // 54 questions = RIASEC Personality (YES/NO)
                    riasecScores = computeRiasecScores(studentAnswers, sm, allAnswers);
                } else if (qCount >= 25 && qCount <= 35 && !aptitudeDone) {
                    // 30 questions = Aptitude (A/B/C/D)
                    aptitudeScores = computeAptitudeScores(studentAnswers, sm, allAnswers);
                } else if (qCount >= 20 && qCount <= 26 && !miDone) {
                    // 24 questions = Multiple Intelligence (A/B/C/D)
                    miScores = computeMIScores(studentAnswers, sm, allAnswers);
                }
                // Extra sections (e.g., 30 questions in Insight Navigator Sec_F) are skipped
            }
        }

        logger.info("Detected sections: RIASEC={}, Aptitude={}, MI={}, SOI={}, Values={}, CareerAsp={}",
                riasecScores.values().stream().mapToInt(Integer::intValue).sum() > 0 ? "Y" : "N",
                aptitudeScores.values().stream().mapToInt(Integer::intValue).sum() > 0 ? "Y" : "N",
                miScores.values().stream().mapToInt(Integer::intValue).sum() > 0 ? "Y" : "N",
                selectedSOIs.isEmpty() ? "N" : selectedSOIs.size() + " items",
                selectedValues.isEmpty() ? "N" : selectedValues.size() + " items",
                selectedCareerAsps.isEmpty() ? "N" : selectedCareerAsps.size() + " items");

        // ── 6. Phase 0b: Eligibility Check ──
        // Only check sections that were actually detected (different questionnaires have different sections)
        List<String> eligibilityIssues = new ArrayList<>();
        boolean hasRiasec = riasecScores.values().stream().mapToInt(Integer::intValue).sum() > 0;
        boolean hasAptitude = aptitudeScores.values().stream().mapToInt(Integer::intValue).sum() > 0;
        boolean hasMI = miScores.values().stream().mapToInt(Integer::intValue).sum() > 0;

        // Check 1: Each RIASEC personality score >= 9 (only if RIASEC section exists)
        int personalityLowCount = 0;
        if (hasRiasec) {
            for (Map.Entry<String, Integer> entry : riasecScores.entrySet()) {
                int score = entry.getValue();
                if (score < 9) {
                    eligibilityIssues.add("Personality " + entry.getKey() + ": " + score + " (< 9)");
                }
                if (score == 1) {
                    personalityLowCount++;
                }
            }
            if (personalityLowCount > 3) {
                eligibilityIssues.add("DISQUALIFIED: " + personalityLowCount + " personality traits scoring 1 (> 3)");
            }
        }

        // Check 2: Each ability score >= 3 (only if aptitude section exists)
        if (hasAptitude) {
            for (Map.Entry<String, Integer> entry : aptitudeScores.entrySet()) {
                if (entry.getValue() < 3) {
                    eligibilityIssues.add("Ability " + entry.getKey() + ": " + entry.getValue() + " (< 3)");
                }
            }
        }

        // Check 3: Each intelligence score >= 3 (only if MI section exists)
        if (hasMI) {
            for (Map.Entry<String, Integer> entry : miScores.entrySet()) {
                if (entry.getValue() < 3) {
                    eligibilityIssues.add("Intelligence " + entry.getKey() + ": " + entry.getValue() + " (< 3)");
                }
            }
        }

        boolean isEligible = eligibilityIssues.isEmpty();

        if (!isEligible) {
            logger.warn("Student {} INELIGIBLE: {}", userStudentId, eligibilityIssues);
        } else {
            logger.info("Student {} eligible for report generation", userStudentId);
        }

        // ── 7. Delete existing and create new report ──
        navigatorReportDataRepository.deleteByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        NavigatorReportData report = new NavigatorReportData();
        report.setUserStudent(us);
        report.setAssessmentId(assessmentId);
        report.setStudentName(studentName);
        report.setStudentNameCaps(studentName.toUpperCase());
        report.setStudentFirstName(studentName.contains(" ") ? studentName.split(" ")[0] : studentName);
        report.setStudentClass(studentClass);
        report.setStudentSchool(studentSchool);

        // ── Set eligibility ──
        report.setEligible(isEligible);
        report.setEligibilityIssues(isEligible ? null : String.join("; ", eligibilityIssues));
        report.setDataSignificance(isEligible ? "significant" : "insignificant");

        // ── Set SOI fields (up to 5) ──
        if (selectedSOIs.size() > 0) report.setSoi1(selectedSOIs.get(0));
        if (selectedSOIs.size() > 1) report.setSoi2(selectedSOIs.get(1));
        if (selectedSOIs.size() > 2) report.setSoi3(selectedSOIs.get(2));
        if (selectedSOIs.size() > 3) report.setSoi4(selectedSOIs.get(3));
        if (selectedSOIs.size() > 4) report.setSoi5(selectedSOIs.get(4));

        // ── Set Values fields (up to 4) ──
        if (selectedValues.size() > 0) report.setValues1(selectedValues.get(0));
        if (selectedValues.size() > 1) report.setValues2(selectedValues.get(1));
        if (selectedValues.size() > 2) report.setValues3(selectedValues.get(2));
        if (selectedValues.size() > 3) report.setValues4(selectedValues.get(3));

        // ── Set Career Aspiration fields (up to 4) ──
        if (selectedCareerAsps.size() > 0) report.setCareerAsp1(selectedCareerAsps.get(0));
        if (selectedCareerAsps.size() > 1) report.setCareerAsp2(selectedCareerAsps.get(1));
        if (selectedCareerAsps.size() > 2) report.setCareerAsp3(selectedCareerAsps.get(2));
        if (selectedCareerAsps.size() > 3) report.setCareerAsp4(selectedCareerAsps.get(3));

        // Log intermediary scores
        logger.info("=== NAVIGATOR INTERMEDIARY for student {} ===", userStudentId);
        logger.info("  RIASEC: {}", riasecScores);
        logger.info("  Aptitudes: {}", aptitudeScores);
        logger.info("  MI: {}", miScores);
        logger.info("  SOIs: {}", selectedSOIs);
        logger.info("  Values: {}", selectedValues);
        logger.info("  Career Aspirations: {}", selectedCareerAsps);

        // ── Phase 1: Core Analysis ──
        NavigatorCoreAnalysis.CoreAnalysisResult coreResult = coreAnalysis.analyze(
                riasecScores, miScores, aptitudeScores, studentClass,
                selectedSOIs, selectedValues, selectedCareerAsps);

        // Set Ability fields (from Phase 1 Step 4 — proper tie-break ordering)
        report.setAbility1(coreResult.abilityTop1);
        report.setAbility2(coreResult.abilityTop2);
        report.setAbility3(coreResult.abilityTop3);
        report.setAbility4(coreResult.abilityTop4);

        // Set weak ability (from Phase 1 Step 6 — based on career pathway requirements)
        report.setWeakAbility(coreResult.weakAbility);

        // Set learning styles (from Phase 1 Step 3)
        report.setLearningStyle1(coreResult.learningStyle1);
        report.setLearningStyle2(coreResult.learningStyle2);
        report.setLearningStyle3(coreResult.learningStyle3);
        report.setEnjoysWith1(coreResult.enjoysWith1);
        report.setEnjoysWith2(coreResult.enjoysWith2);
        report.setEnjoysWith3(coreResult.enjoysWith3);
        report.setStrugglesWith1(coreResult.strugglesWith1);
        report.setStrugglesWith2(coreResult.strugglesWith2);
        report.setStrugglesWith3(coreResult.strugglesWith3);

        // Set career pathway suitability (from Phase 1 Step 5)
        report.setPathway1(coreResult.suitabilityIndex[0]);
        report.setPathway2(coreResult.suitabilityIndex[1]);
        report.setPathway3(coreResult.suitabilityIndex[2]);
        report.setPathway4(coreResult.suitabilityIndex[3]);
        report.setPathway5(coreResult.suitabilityIndex[4]);
        report.setPathway6(coreResult.suitabilityIndex[5]);
        report.setPathway7(coreResult.suitabilityIndex[6]);
        report.setPathway8(coreResult.suitabilityIndex[7]);
        report.setPathway9(coreResult.suitabilityIndex[8]);

        // Set Phase 2 fields: pathway text, subjects, skills, courses, exams, has/lacks
        report.setPathway1Text(coreResult.pathway1Text);
        report.setPathway2Text(coreResult.pathway2Text);
        report.setPathway3Text(coreResult.pathway3Text);
        // CP1
        report.setCp1Subjects(coreResult.cp1Subjects);
        report.setCp1Skills(coreResult.cp1Skills);
        report.setCp1Courses(coreResult.cp1Courses);
        report.setCp1Exams(coreResult.cp1Exams);
        report.setCp1PersonalityHas(coreResult.cp1PersonalityHas);
        report.setCp1PersonalityLacks(coreResult.cp1PersonalityLacks);
        report.setCp1IntelligenceHas(coreResult.cp1IntelligenceHas);
        report.setCp1IntelligenceLacks(coreResult.cp1IntelligenceLacks);
        report.setCp1SoiHas(coreResult.cp1SoiHas);
        report.setCp1SoiLacks(coreResult.cp1SoiLacks);
        report.setCp1AbilityHas(coreResult.cp1AbilityHas);
        report.setCp1AbilityLacks(coreResult.cp1AbilityLacks);
        report.setCp1ValuesHas(coreResult.cp1ValuesHas);
        report.setCp1ValuesLacks(coreResult.cp1ValuesLacks);
        // CP2
        report.setCp2Subjects(coreResult.cp2Subjects);
        report.setCp2Skills(coreResult.cp2Skills);
        report.setCp2Courses(coreResult.cp2Courses);
        report.setCp2Exams(coreResult.cp2Exams);
        report.setCp2PersonalityHas(coreResult.cp2PersonalityHas);
        report.setCp2PersonalityLacks(coreResult.cp2PersonalityLacks);
        report.setCp2IntelligenceHas(coreResult.cp2IntelligenceHas);
        report.setCp2IntelligenceLacks(coreResult.cp2IntelligenceLacks);
        report.setCp2SoiHas(coreResult.cp2SoiHas);
        report.setCp2SoiLacks(coreResult.cp2SoiLacks);
        report.setCp2AbilityHas(coreResult.cp2AbilityHas);
        report.setCp2AbilityLacks(coreResult.cp2AbilityLacks);
        report.setCp2ValuesHas(coreResult.cp2ValuesHas);
        report.setCp2ValuesLacks(coreResult.cp2ValuesLacks);
        // CP3
        report.setCp3Subjects(coreResult.cp3Subjects);
        report.setCp3Skills(coreResult.cp3Skills);
        report.setCp3Courses(coreResult.cp3Courses);
        report.setCp3Exams(coreResult.cp3Exams);
        report.setCp3PersonalityHas(coreResult.cp3PersonalityHas);
        report.setCp3PersonalityLacks(coreResult.cp3PersonalityLacks);
        report.setCp3IntelligenceHas(coreResult.cp3IntelligenceHas);
        report.setCp3IntelligenceLacks(coreResult.cp3IntelligenceLacks);
        report.setCp3SoiHas(coreResult.cp3SoiHas);
        report.setCp3SoiLacks(coreResult.cp3SoiLacks);
        report.setCp3AbilityHas(coreResult.cp3AbilityHas);
        report.setCp3AbilityLacks(coreResult.cp3AbilityLacks);
        report.setCp3ValuesHas(coreResult.cp3ValuesHas);
        report.setCp3ValuesLacks(coreResult.cp3ValuesLacks);

        // Set Phase 3 field: career match result
        report.setCareerMatchResult(coreResult.careerMatchResult);

        // Set Phase 5 fields: personality/intelligence text & images, suggestions, recommendations
        report.setPersonality1Text(coreResult.personality1Text);
        report.setPersonality1Image(coreResult.personality1Image);
        report.setPersonality2Text(coreResult.personality2Text);
        report.setPersonality2Image(coreResult.personality2Image);
        report.setPersonality3Text(coreResult.personality3Text);
        report.setPersonality3Image(coreResult.personality3Image);
        report.setIntelligence1Text(coreResult.intelligence1Text);
        report.setIntelligence1Image(coreResult.intelligence1Image);
        report.setIntelligence2Text(coreResult.intelligence2Text);
        report.setIntelligence2Image(coreResult.intelligence2Image);
        report.setIntelligence3Text(coreResult.intelligence3Text);
        report.setIntelligence3Image(coreResult.intelligence3Image);
        report.setCanAtSchool(coreResult.canAtSchool);
        report.setCanAtHome(coreResult.canAtHome);
        report.setRecommendations(coreResult.recommendations);

        // ── Generate personality & intelligence bar chart SVGs ──
        report.setPersonalityGraph(generateBarChartDataUri(
                riasecScores, RIASEC_DISPLAY_NAMES, "#1a7a6d"));
        report.setIntelligenceGraph(generateBarChartDataUri(
                miScores, null, "#2e86ab"));

        // ── Phase 4: AI Summaries (only for eligible students, skippable for one-click) ──
        if (isEligible && !skipAI) {
            try {
                NavigatorAISummaryService.AISummaryResult aiResult = aiSummaryService
                        .generateSummaries(studentName, studentClass, coreResult);
                report.setSummary(aiResult.aiSummary);
                report.setLearningStyleSummary(aiResult.learningStyleSummary);
            } catch (Exception e) {
                logger.error("AI summary generation failed for student {}: {}", userStudentId, e.getMessage());
                // Leave summary fields null — can be retried later
            }
        }

        report.setReportStatus("notGenerated");

        return navigatorReportDataRepository.save(report);
    }

    // ═══════════════════════ MULTI-SELECT EXTRACTION ═══════════════════════

    /**
     * For MULTI_SELECT sections (A, B, C): extract selected option labels.
     * Options are sorted by ID. The label for each selected option comes from
     * the labels array (index = position of option ID in sorted option list).
     * Falls back to optionText if label array doesn't cover the index.
     */
    private List<String> extractMultiSelectLabels(List<AssessmentAnswer> studentAnswers,
            SectionMeta sm, String[] labels) {
        if (!sm.isMultiSelect || sm.singleQQId == null) return Collections.emptyList();

        List<String> selected = new ArrayList<>();
        for (AssessmentAnswer a : studentAnswers) {
            if (a.getQuestionnaireQuestion() == null || a.getOption() == null) continue;
            if (!a.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(sm.singleQQId)) continue;

            Long optionId = a.getOption().getOptionId();
            int idx = sm.sortedOptionIds.indexOf(optionId);
            if (idx >= 0 && idx < labels.length) {
                selected.add(labels[idx]);
            } else {
                // Fallback to option text
                String text = a.getOption().getOptionText();
                if (text != null && !text.isEmpty()) {
                    selected.add(text);
                }
            }
        }
        return selected;
    }

    // ═══════════════════════ RIASEC SCORING (Section D) ═══════════════════════

    /**
     * Section D: 54 questions cycling through RIASEC (q-1)%6 → R,I,A,S,E,C
     * Weights: YES=2, NO=1
     * Each letter gets 9 questions. Score range: 9-18.
     */
    private Map<String, Integer> computeRiasecScores(List<AssessmentAnswer> studentAnswers,
            SectionMeta sm, List<AssessmentAnswer> allAnswers) {
        Map<String, Integer> scores = new LinkedHashMap<>();
        for (String l : RIASEC_LETTERS) scores.put(l, 0);

        if (sm.isSingleAnswer) {
            for (int qIdx = 0; qIdx < sm.sortedQQIds.size(); qIdx++) {
                Long qqId = sm.sortedQQIds.get(qIdx);
                String letter = RIASEC_LETTERS[qIdx % 6];

                String answerLabel = getStudentAnswerLabel(studentAnswers, qqId, allAnswers);
                int weight;
                if ("YES".equalsIgnoreCase(answerLabel) || "Y".equalsIgnoreCase(answerLabel)) {
                    weight = 2;
                } else {
                    weight = 1; // NO or unanswered defaults to 1
                }
                scores.merge(letter, weight, Integer::sum);
            }
        }
        return scores;
    }

    // ═══════════════════════ APTITUDE SCORING (Section E) ═══════════════════════

    /**
     * Section E: 30 questions → 10 abilities.
     * Weights: A=4, B=3, C=3, D=1
     * Each ability uses 3 questions: Q(n), Q(n+10), Q(n+20) where n=1..10
     * i.e., question q (1-based) maps to ability index ((q-1) % 10)
     */
    private Map<String, Integer> computeAptitudeScores(List<AssessmentAnswer> studentAnswers,
            SectionMeta sm, List<AssessmentAnswer> allAnswers) {
        Map<String, Integer> scores = new LinkedHashMap<>();
        for (String a : APTITUDE_NAMES) scores.put(a, 0);

        if (sm.isSingleAnswer) {
            for (int qIdx = 0; qIdx < sm.sortedQQIds.size(); qIdx++) {
                Long qqId = sm.sortedQQIds.get(qIdx);
                int abilityIdx = qIdx % 10;
                if (abilityIdx >= APTITUDE_NAMES.length) continue;

                String answerLabel = getStudentAnswerLabel(studentAnswers, qqId, allAnswers);
                int weight = aptitudeWeight(answerLabel);
                scores.merge(APTITUDE_NAMES[abilityIdx], weight, Integer::sum);
            }
        }
        return scores;
    }

    private int aptitudeWeight(String label) {
        if (label == null) return 0;
        switch (label.toUpperCase()) {
            case "A": return 4;
            case "B": return 3;
            case "C": return 3;
            case "D": return 1;
            default: return 0;
        }
    }

    // ═══════════════════════ MI SCORING (Section F) ═══════════════════════

    /**
     * Section F: 24 questions → 8 MI types.
     * Weights: A=4, B=3, C=2, D=1
     * Group by floor((q-1)/3): Q1-3→Bodily, Q4-6→Interpersonal, etc.
     * Each MI type gets 3 questions. Score range: 3-12.
     */
    private Map<String, Integer> computeMIScores(List<AssessmentAnswer> studentAnswers,
            SectionMeta sm, List<AssessmentAnswer> allAnswers) {
        Map<String, Integer> scores = new LinkedHashMap<>();
        for (String m : MI_NAMES) scores.put(m, 0);

        if (sm.isSingleAnswer) {
            for (int qIdx = 0; qIdx < sm.sortedQQIds.size(); qIdx++) {
                Long qqId = sm.sortedQQIds.get(qIdx);
                int miIdx = qIdx / 3;
                if (miIdx >= MI_NAMES.length) continue;

                String answerLabel = getStudentAnswerLabel(studentAnswers, qqId, allAnswers);
                int weight = miWeight(answerLabel);
                scores.merge(MI_NAMES[miIdx], weight, Integer::sum);
            }
        }
        return scores;
    }

    private int miWeight(String label) {
        if (label == null) return 0;
        switch (label.toUpperCase()) {
            case "A": return 4;
            case "B": return 3;
            case "C": return 2;
            case "D": return 1;
            default: return 0;
        }
    }

    // ═══════════════════════ ANSWER LABEL RESOLUTION ═══════════════════════

    /**
     * Get the answer label (A/B/C/D or YES/NO) for a specific question.
     * Uses the same deriveLabel logic as GeneralAssessmentExportService.
     */
    private String getStudentAnswerLabel(List<AssessmentAnswer> studentAnswers,
            Long qqId, List<AssessmentAnswer> allAnswers) {
        for (AssessmentAnswer a : studentAnswers) {
            if (a.getQuestionnaireQuestion() == null || a.getOption() == null) continue;
            if (!a.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(qqId)) continue;

            AssessmentQuestionOptions option = a.getOption();
            String text = option.getOptionText() != null ? option.getOptionText().trim() : "";

            // If option text is already a standard label, use it directly
            if (text.matches("(?i)^[A-D]$") || text.matches("(?i)^(YES|NO|Y|N)$")) {
                return text.toUpperCase();
            }

            // Derive label from option position: scan all answers to find all
            // unique option IDs for this question, sort by ID, then map position
            Set<Long> allOptIdsForQuestion = new TreeSet<>();
            for (AssessmentAnswer aa : allAnswers) {
                if (aa.getQuestionnaireQuestion() == null || aa.getOption() == null) continue;
                if (aa.getQuestionnaireQuestion().getQuestionnaireQuestionId().equals(qqId)) {
                    allOptIdsForQuestion.add(aa.getOption().getOptionId());
                }
            }
            List<Long> sortedOptions = new ArrayList<>(allOptIdsForQuestion);

            int idx = sortedOptions.indexOf(option.getOptionId());
            if (idx >= 0) {
                if (sortedOptions.size() == 2) {
                    return idx == 0 ? "YES" : "NO";
                }
                return String.valueOf((char) ('A' + idx));
            }

            return text;
        }
        return ""; // No answer found for this question
    }

    // ═══════════════════════ HELPERS ═══════════════════════

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

    private String resolveClass(StudentInfo si) {
        if (si == null) return "";
        Integer studentClass = si.getStudentClass();
        if (studentClass != null) return String.valueOf(studentClass);
        return "";
    }

    // ═══════════════════════ BAR CHART GENERATION ═══════════════════════

    /**
     * Generate an inline SVG vertical bar chart and return it as a data:image/svg+xml URI.
     * Bars grow upward from a baseline with labels below.
     */
    private String generateBarChartDataUri(Map<String, Integer> scores,
            Map<String, String> displayNames, String barColor) {
        int n = scores.size();
        int barWidth = 50;
        int barGap = 20;
        int topPadding = 25;      // space for score text above bars
        int chartAreaHeight = 160; // max bar height
        int labelAreaHeight = 45; // space for labels below baseline
        int sidePadding = 20;

        int svgWidth = sidePadding * 2 + n * barWidth + (n - 1) * barGap;
        int svgHeight = topPadding + chartAreaHeight + labelAreaHeight;
        int baseline = topPadding + chartAreaHeight; // y where bars sit

        int maxScore = scores.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        if (maxScore == 0) maxScore = 1;

        StringBuilder svg = new StringBuilder();
        svg.append("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"").append(svgWidth)
           .append("\" height=\"").append(svgHeight).append("\" viewBox=\"0 0 ")
           .append(svgWidth).append(" ").append(svgHeight).append("\">");
        svg.append("<style>text{font-family:Arial,sans-serif;fill:#333;}</style>");

        int x = sidePadding;
        for (Map.Entry<String, Integer> entry : scores.entrySet()) {
            String label = displayNames != null && displayNames.containsKey(entry.getKey())
                    ? displayNames.get(entry.getKey()) : entry.getKey();
            int score = entry.getValue();
            int barH = (int) ((double) score / maxScore * chartAreaHeight);
            if (barH < 3) barH = 3;
            int barY = baseline - barH;
            int barCenterX = x + barWidth / 2;

            // Bar
            svg.append("<rect x=\"").append(x).append("\" y=\"").append(barY)
               .append("\" width=\"").append(barWidth).append("\" height=\"").append(barH)
               .append("\" rx=\"4\" fill=\"").append(barColor).append("\" opacity=\"0.85\"/>");

            // Score above bar
            svg.append("<text x=\"").append(barCenterX).append("\" y=\"").append(barY - 6)
               .append("\" text-anchor=\"middle\" font-size=\"12\" font-weight=\"bold\">")
               .append(score).append("</text>");

            // Label below baseline (rotated for longer labels)
            if (label.length() > 8) {
                svg.append("<text x=\"").append(barCenterX).append("\" y=\"").append(baseline + 14)
                   .append("\" text-anchor=\"end\" font-size=\"11\" transform=\"rotate(-35,")
                   .append(barCenterX).append(",").append(baseline + 14).append(")\">")
                   .append(escapeXml(label)).append("</text>");
            } else {
                svg.append("<text x=\"").append(barCenterX).append("\" y=\"").append(baseline + 16)
                   .append("\" text-anchor=\"middle\" font-size=\"12\">")
                   .append(escapeXml(label)).append("</text>");
            }

            x += barWidth + barGap;
        }

        svg.append("</svg>");

        String encoded = java.util.Base64.getEncoder().encodeToString(svg.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return "data:image/svg+xml;base64," + encoded;
    }

    private static String escapeXml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    // ── Section metadata holder ──
    private static class SectionMeta {
        final String letter;
        final Long sectionId;
        final boolean isMultiSelect;
        final boolean isSingleAnswer;
        final List<Long> sortedQQIds;       // sorted question IDs (for SINGLE_ANSWER)
        final List<Long> sortedOptionIds;   // sorted option IDs (for MULTI_SELECT)
        final Long singleQQId;              // the single question ID (for MULTI_SELECT)
        final Map<Long, Set<Long>> qqOptions; // qqId → set of option IDs
        final String sectionName;           // lowercase section name for type detection

        SectionMeta(String letter, Long sectionId, boolean isMultiSelect, boolean isSingleAnswer,
                List<Long> sortedQQIds, List<Long> sortedOptionIds, Long singleQQId,
                Map<Long, Set<Long>> qqOptions, String sectionName) {
            this.letter = letter;
            this.sectionId = sectionId;
            this.isMultiSelect = isMultiSelect;
            this.isSingleAnswer = isSingleAnswer;
            this.sortedQQIds = sortedQQIds;
            this.sortedOptionIds = sortedOptionIds;
            this.singleQQId = singleQQId;
            this.qqOptions = qqOptions;
            this.sectionName = sectionName != null ? sectionName : "";
        }
    }
}
