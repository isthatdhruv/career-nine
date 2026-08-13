package com.kccitm.api.service.schoolreport;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.Navigator.NavigatorCoreAnalysis;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.schoolreport.SchoolReportService.PasteDataRow;

/**
 * Builds sheet 1 of the Navigator360 school dashboard straight from the
 * database, replacing the manual "download Raw + Master Sheet, paste into the
 * template" step.
 *
 * <p>The Master Sheet export cannot fill three of sheet 1's columns — it has no
 * Gender, its "SOI 1-5" are subject interests rather than the top-3 RIASEC
 * codes sheet 1 wants for Personality_Top1..3, and it carries no suitability
 * index at all. All three are available here: gender from {@code StudentInfo},
 * and the other two from {@link NavigatorCoreAnalysis}, which derives them from
 * the same scores the Master Sheet prints.
 *
 * @see SchoolReportService
 */
@Service
public class SchoolDashboardDataService {

    private static final Logger logger = LoggerFactory.getLogger(SchoolDashboardDataService.class);

    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private SchoolSectionsRepository schoolSectionsRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private NavigatorReportGenerationService navigatorReportGenerationService;
    @Autowired private NavigatorCoreAnalysis navigatorCoreAnalysis;
    @Autowired private SchoolReportService schoolReportService;

    /** Keys into {@code IntermediaryScores.aptitudeScores}, aligned with {@link SchoolReportService#ABILITY_HEADERS}. */
    private static final String[] APTITUDE_KEYS = {
            "Speed and accuracy", "Computational", "Creativity/Artistic",
            "Language/Communication", "Technical", "Decision making & problem solving",
            "Finger dexterity", "Form perception", "Logical reasoning", "Motor movement"};

    /** Keys into {@code IntermediaryScores.miScores}, aligned with {@link SchoolReportService#INTELLIGENCE_HEADERS}. */
    private static final String[] MI_KEYS = {
            "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
            "Logical-Mathematical", "Musical", "Visual-Spatial", "Naturalistic"};

    /** Keys into {@code IntermediaryScores.riasecScores}, aligned with {@link SchoolReportService#RIASEC_HEADERS}. */
    private static final String[] RIASEC_KEYS = {"R", "I", "A", "S", "E", "C"};

    /**
     * Loads one paste-data row per student with a scoreable assessment.
     *
     * @param assessmentId   the assessment to report on
     * @param userStudentIds restrict to these students (the Reports Hub passes
     *                       whatever its filters and tick-boxes left visible);
     *                       null or empty means every student on the assessment
     * @return rows in mapping order, students whose scores cannot be computed
     *         omitted
     */
    @Transactional(readOnly = true)
    public List<PasteDataRow> loadRows(Long assessmentId, List<Long> userStudentIds) {
        Set<Long> wanted = userStudentIds != null && !userStudentIds.isEmpty()
                ? new HashSet<>(userStudentIds) : null;
        Set<Long> seen = new HashSet<>();

        List<StudentAssessmentMapping> mappings = mappingRepository.findAllByAssessmentId(assessmentId).stream()
                .filter(m -> m.getUserStudent() != null
                          && (wanted == null || wanted.contains(m.getUserStudent().getUserStudentId()))
                          && seen.add(m.getUserStudent().getUserStudentId()))
                .collect(Collectors.toList());

        // Built once for the whole cohort — the 2-arg computeIntermediaryScores
        // rebuilds it per call, which re-reads every answer in the assessment.
        NavigatorReportGenerationService.AssessmentScoringContext scoringContext =
                navigatorReportGenerationService.buildScoringContext(assessmentId);

        Map<Integer, String> sectionNameCache = new HashMap<>();
        List<PasteDataRow> rows = new ArrayList<>(mappings.size());
        int skipped = 0;

        for (StudentAssessmentMapping mapping : mappings) {
            UserStudent student = mapping.getUserStudent();
            NavigatorReportGenerationService.IntermediaryScores scores;
            try {
                scores = navigatorReportGenerationService
                        .computeIntermediaryScores(student.getUserStudentId(), assessmentId, scoringContext);
            } catch (Exception e) {
                logger.warn("School dashboard: scoring failed for student {}: {}",
                        student.getUserStudentId(), e.getMessage());
                scores = null;
            }
            if (scores == null) {
                skipped++;
                continue;
            }
            rows.add(toPasteDataRow(student, scores, sectionNameCache));
        }

        logger.info("School dashboard: {} rows built, {} skipped (no completed assessment) for assessment {}",
                rows.size(), skipped, assessmentId);
        return rows;
    }

    /**
     * Builds the whole School Dashboard page payload for one institute:
     * participation across every assessment, plus the Navigator360 dashboard
     * scored from everyone who has completed one.
     *
     * <p>Scoring context is rebuilt once per assessment rather than once per
     * student — it reads the entire cohort's answers, so per-student would be
     * quadratic.
     *
     * <p>The participation cards always count the whole institute; only the
     * dashboard honours {@code classFilter}, so narrowing to one class never
     * makes the headline "students not started" shrink.
     *
     * @param instituteCode the institute to report on
     * @param classFilter   sheet 2's class filter; null means all classes
     * @return the view; {@code dashboard} is null when nobody has completed yet
     */
    @Transactional(readOnly = true)
    public SchoolDashboardView buildInstituteView(Integer instituteCode,
            SchoolDashboard.ClassFilter classFilter) {
        SchoolDashboard.ClassFilter effectiveFilter =
                classFilter != null ? classFilter : SchoolDashboard.ClassFilter.all();
        SchoolDashboardView view = new SchoolDashboardView();
        view.instituteCode = instituteCode;
        view.classFilter = effectiveFilter.label;

        List<StudentAssessmentMapping> mappings = mappingRepository.findAllByInstituteCode(instituteCode);
        if (mappings.isEmpty()) {
            logger.info("School dashboard: institute {} has no assessment mappings", instituteCode);
            return view;
        }

        Set<Long> distinct = new HashSet<>();
        Map<Long, SchoolDashboardView.AssessmentParticipation> perAssessment = new LinkedHashMap<>();
        Map<Long, List<UserStudent>> completedByAssessment = new LinkedHashMap<>();

        for (StudentAssessmentMapping mapping : mappings) {
            UserStudent student = mapping.getUserStudent();
            if (student == null) {
                continue;
            }
            if (view.instituteName == null && student.getInstitute() != null) {
                view.instituteName = student.getInstitute().getInstituteName();
            }
            distinct.add(student.getUserStudentId());

            SchoolDashboardView.AssessmentParticipation slice = perAssessment.computeIfAbsent(
                    mapping.getAssessmentId(), id -> {
                        SchoolDashboardView.AssessmentParticipation a =
                                new SchoolDashboardView.AssessmentParticipation();
                        a.assessmentId = id;
                        return a;
                    });

            view.participation.total++;
            slice.total++;
            String status = mapping.getStatus() != null ? mapping.getStatus().trim().toLowerCase() : "";
            switch (status) {
                case "completed":
                    view.participation.completed++;
                    slice.completed++;
                    completedByAssessment
                            .computeIfAbsent(mapping.getAssessmentId(), id -> new ArrayList<>())
                            .add(student);
                    break;
                // "inprogress" is the older spelling of the same state; both are
                // written by different code paths, so fold them together.
                case "ongoing":
                case "inprogress":
                    view.participation.ongoing++;
                    slice.ongoing++;
                    break;
                default:
                    view.participation.notStarted++;
                    slice.notStarted++;
                    break;
            }
        }

        view.distinctStudents = distinct.size();
        view.participation.completedPct = percent(view.participation.completed, view.participation.total);

        Map<Long, String> assessmentNames = assessmentNames(perAssessment.keySet());
        for (SchoolDashboardView.AssessmentParticipation slice : perAssessment.values()) {
            slice.completedPct = percent(slice.completed, slice.total);
            slice.assessmentName = assessmentNames.getOrDefault(slice.assessmentId,
                    "Assessment " + slice.assessmentId);
        }

        List<PasteDataRow> rows = new ArrayList<>();
        Map<Integer, String> sectionNameCache = new HashMap<>();
        for (Map.Entry<Long, List<UserStudent>> entry : completedByAssessment.entrySet()) {
            int before = rows.size();
            rows.addAll(scoreCohort(entry.getKey(), entry.getValue(), sectionNameCache));
            SchoolDashboardView.AssessmentParticipation slice = perAssessment.get(entry.getKey());
            if (slice != null) {
                slice.scored = rows.size() - before;
            }
        }

        view.scoredStudents = rows.size();
        view.unscoredStudents = view.participation.completed - rows.size();
        for (PasteDataRow row : rows) {
            if (row.studentClass != null) {
                view.classesPresent.add(row.studentClass);
            }
        }
        if (!rows.isEmpty()) {
            view.dashboard = schoolReportService.calculateDashboard(rows, effectiveFilter);
        }

        view.assessments.addAll(perAssessment.values());
        view.assessments.sort((a, b) -> Integer.compare(b.total, a.total));

        logger.info("School dashboard: institute {} — {} mappings, {} completed, {} scored, {} assessments",
                instituteCode, view.participation.total, view.participation.completed,
                view.scoredStudents, view.assessments.size());
        return view;
    }

    /** Scores one assessment's completed students against a single shared context. */
    private List<PasteDataRow> scoreCohort(Long assessmentId, List<UserStudent> students,
            Map<Integer, String> sectionNameCache) {
        NavigatorReportGenerationService.AssessmentScoringContext scoringContext;
        try {
            scoringContext = navigatorReportGenerationService.buildScoringContext(assessmentId);
        } catch (Exception e) {
            logger.warn("School dashboard: cannot build scoring context for assessment {}: {}",
                    assessmentId, e.getMessage());
            return Collections.emptyList();
        }

        List<PasteDataRow> rows = new ArrayList<>(students.size());
        for (UserStudent student : students) {
            NavigatorReportGenerationService.IntermediaryScores scores;
            try {
                scores = navigatorReportGenerationService
                        .computeIntermediaryScores(student.getUserStudentId(), assessmentId, scoringContext);
            } catch (Exception e) {
                logger.warn("School dashboard: scoring failed for student {} on assessment {}: {}",
                        student.getUserStudentId(), assessmentId, e.getMessage());
                continue;
            }
            if (scores != null) {
                rows.add(toPasteDataRow(student, scores, sectionNameCache));
            }
        }
        return rows;
    }

    // ═════════════════════ SCORED ROSTER (release path) ═════════════════════

    /** One student: where they sit, how far they got, and their scored row. */
    public static final class ScoredStudent {
        public Long userStudentId;
        public Long sessionId;
        /** The class number, not a foreign key — {@code StudentInfo.studentClass}. */
        public Long classId;
        public Long sectionId;
        public String sectionName;
        /** {@code completed} | {@code ongoing} | {@code notStarted}. */
        public String status;
        /** Null unless the student completed <em>and</em> scoring succeeded. */
        public PasteDataRow row;

        public boolean isScored() {
            return row != null;
        }
    }

    /**
     * Every student of one institute+assessment, scored once.
     *
     * <p>This exists so a release can score the institute a single time and then
     * derive each scope by filtering, instead of re-scoring the same students once
     * per scope. {@code buildScoringContext} reads the whole cohort's answers, so
     * building it per scope is the expensive mistake — here it is built once.
     *
     * <p>Non-completed students are kept. They contribute no scores, but they are the
     * only source of a <em>scoped</em> participation count: "18 of 42 in 10-B have not
     * started" is unrecoverable once they have been filtered out at query time.
     */
    public static final class ScoredRoster {
        public Integer instituteCode;
        public String instituteName;
        public Long assessmentId;
        public String assessmentName;
        public final List<ScoredStudent> students = new ArrayList<>();
        /** Completed sittings whose scoring threw — feeds the release's data audit. */
        public int scoringFailures;
    }

    /**
     * Build the scored roster for one institute+assessment.
     *
     * <p>Navigator assessments only: the scoring context is Navigator's, and a BET
     * sitting produces no RIASEC/aptitude/MI scores to aggregate.
     */
    @Transactional(readOnly = true)
    public ScoredRoster buildScoredRoster(Integer instituteCode, Long assessmentId) {
        ScoredRoster roster = new ScoredRoster();
        roster.instituteCode = instituteCode;
        roster.assessmentId = assessmentId;

        List<StudentAssessmentMapping> mappings = mappingRepository.findAllByInstituteCode(instituteCode);
        List<UserStudent> completed = new ArrayList<>();
        List<ScoredStudent> completedEntries = new ArrayList<>();
        Map<Integer, String> sectionNameCache = new HashMap<>();

        for (StudentAssessmentMapping mapping : mappings) {
            if (!assessmentId.equals(mapping.getAssessmentId())) {
                continue;
            }
            UserStudent student = mapping.getUserStudent();
            if (student == null) {
                continue;
            }
            if (roster.instituteName == null && student.getInstitute() != null) {
                roster.instituteName = student.getInstitute().getInstituteName();
            }

            StudentInfo info = student.getStudentInfo();
            ScoredStudent entry = new ScoredStudent();
            entry.userStudentId = student.getUserStudentId();
            entry.sessionId = info == null ? null : longOf(info.getSessionId());
            entry.classId = info == null ? null : longOf(info.getStudentClass());
            entry.sectionId = info == null ? null : longOf(info.getSchoolSectionId());
            entry.sectionName = sectionName(info, sectionNameCache);
            entry.status = normalizeStatus(mapping.getStatus());
            roster.students.add(entry);

            if ("completed".equals(entry.status)) {
                completed.add(student);
                completedEntries.add(entry);
            }
        }

        if (completed.isEmpty()) {
            return roster;
        }

        // One context for the whole institute — the reason this method exists.
        NavigatorReportGenerationService.AssessmentScoringContext scoringContext;
        try {
            scoringContext = navigatorReportGenerationService.buildScoringContext(assessmentId);
        } catch (Exception e) {
            logger.warn("Scored roster: cannot build scoring context for assessment {}: {}",
                    assessmentId, e.getMessage());
            roster.scoringFailures = completed.size();
            return roster;
        }

        for (int i = 0; i < completed.size(); i++) {
            UserStudent student = completed.get(i);
            try {
                NavigatorReportGenerationService.IntermediaryScores scores =
                        navigatorReportGenerationService.computeIntermediaryScores(
                                student.getUserStudentId(), assessmentId, scoringContext);
                if (scores == null) {
                    roster.scoringFailures++;
                    continue;
                }
                completedEntries.get(i).row = toPasteDataRow(student, scores, sectionNameCache);
            } catch (Exception e) {
                roster.scoringFailures++;
                logger.warn("Scored roster: scoring failed for student {} on assessment {}: {}",
                        student.getUserStudentId(), assessmentId, e.getMessage());
            }
        }

        Map<Long, String> names = assessmentNames(Collections.singleton(assessmentId));
        roster.assessmentName = names.getOrDefault(assessmentId, "Assessment " + assessmentId);

        logger.info("Scored roster: institute {} assessment {} — {} students, {} completed, {} scored",
                instituteCode, assessmentId, roster.students.size(), completed.size(),
                completed.size() - roster.scoringFailures);
        return roster;
    }

    /** "inprogress" is the older spelling of "ongoing"; both mean the same state. */
    private static String normalizeStatus(String raw) {
        String status = raw == null ? "" : raw.trim().toLowerCase();
        switch (status) {
            case "completed":
                return "completed";
            case "ongoing":
            case "inprogress":
                return "ongoing";
            default:
                return "notStarted";
        }
    }

    private static Long longOf(Number n) {
        return n == null ? null : n.longValue();
    }

    private Map<Long, String> assessmentNames(Set<Long> assessmentIds) {
        Map<Long, String> names = new HashMap<>();
        if (assessmentIds.isEmpty()) {
            return names;
        }
        for (AssessmentTable assessment : assessmentTableRepository.findAllById(assessmentIds)) {
            names.put(assessment.getId(), assessment.getAssessmentName());
        }
        return names;
    }

    private static int percent(int numerator, int denominator) {
        return denominator == 0 ? 0 : (int) Math.round(numerator * 100.0 / denominator);
    }

    private PasteDataRow toPasteDataRow(UserStudent student,
            NavigatorReportGenerationService.IntermediaryScores scores,
            Map<Integer, String> sectionNameCache) {

        StudentInfo info = student.getStudentInfo();
        PasteDataRow row = new PasteDataRow();

        row.school = student.getInstitute() != null ? safe(student.getInstitute().getInstituteName()) : "";
        row.studentName = info != null ? safe(info.getName()) : safe(scores.studentName);
        row.studentClass = info != null && info.getStudentClass() != null
                ? info.getStudentClass() : parseClass(scores.studentClass);
        row.section = sectionName(info, sectionNameCache);
        row.gender = normalizeGender(info != null ? info.getGender() : null);

        for (int i = 0; i < APTITUDE_KEYS.length; i++) {
            row.abilities[i] = score(scores.aptitudeScores, APTITUDE_KEYS[i]);
        }
        for (int i = 0; i < MI_KEYS.length; i++) {
            row.intelligences[i] = score(scores.miScores, MI_KEYS[i]);
        }
        for (int i = 0; i < RIASEC_KEYS.length; i++) {
            row.riasec[i] = score(scores.riasecScores, RIASEC_KEYS[i]);
        }

        // Personality_Top1..3 and suitability_index_1..9 exist nowhere in the
        // Master Sheet export; they come out of the same core analysis the
        // student's own Navigator report is built from.
        NavigatorCoreAnalysis.CoreAnalysisResult core = analyze(student, scores);
        if (core != null) {
            row.personalityTop[0] = core.personalityTop1;
            row.personalityTop[1] = core.personalityTop2;
            row.personalityTop[2] = core.personalityTop3;
            if (core.suitabilityIndex != null) {
                for (int i = 0; i < row.suitabilityIndex.length && i < core.suitabilityIndex.length; i++) {
                    row.suitabilityIndex[i] = core.suitabilityIndex[i];
                }
            }
        }

        copyInto(row.values, scores.selectedValues);
        copyInto(row.careerAspirations, scores.selectedCareerAsps);
        return row;
    }

    private NavigatorCoreAnalysis.CoreAnalysisResult analyze(UserStudent student,
            NavigatorReportGenerationService.IntermediaryScores scores) {
        try {
            return navigatorCoreAnalysis.analyze(
                    scores.riasecScores, scores.miScores, scores.aptitudeScores,
                    scores.studentClass, scores.selectedSOIs, scores.selectedValues,
                    scores.selectedCareerAsps);
        } catch (Exception e) {
            // A student without a personality profile still belongs on sheet 1 —
            // their abilities and aspirations count. Only AD:AF and AP:AX go blank.
            logger.warn("School dashboard: core analysis failed for student {}: {}",
                    student.getUserStudentId(), e.getMessage());
            return null;
        }
    }

    private String sectionName(StudentInfo info, Map<Integer, String> cache) {
        if (info == null || info.getSchoolSectionId() == null) {
            return "";
        }
        return cache.computeIfAbsent(info.getSchoolSectionId(), id ->
                schoolSectionsRepository.findById(id).map(SchoolSections::getSectionName).orElse(""));
    }

    /**
     * Sheet 2 counts gender as a bare "M" or "F"; StudentInfo may hold either
     * that or the full word, so collapse to the initial.
     */
    private static String normalizeGender(String gender) {
        if (gender == null || gender.trim().isEmpty()) {
            return "";
        }
        return String.valueOf(Character.toUpperCase(gender.trim().charAt(0)));
    }

    private static Integer parseClass(String studentClass) {
        if (studentClass == null) {
            return null;
        }
        try {
            return Integer.valueOf(studentClass.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer score(Map<String, Integer> scores, String key) {
        return scores != null ? scores.get(key) : null;
    }

    private static void copyInto(String[] target, List<String> source) {
        if (source == null) {
            return;
        }
        for (int i = 0; i < target.length && i < source.size(); i++) {
            target[i] = source.get(i);
        }
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }
}
