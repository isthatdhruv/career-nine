package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kccitm.api.service.schoolreport.SchoolDashboard;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredStudent;
import com.kccitm.api.service.schoolreport.SchoolReportService;
import com.kccitm.api.service.schoolreport.SchoolReportService.PasteDataRow;

/**
 * The deterministic half of a generated dashboard: one scope's {@code internal_calculation}.
 *
 * <p>Every number here is derived by <em>filtering the snapshot</em>, never by querying
 * again. That is what makes a section scope genuinely a section: the aggregates are
 * computed over exactly the students in it, so 10-A and 10-B no longer store the same
 * payload.
 *
 * <p>The class filter is deliberately {@link SchoolDashboard.ClassFilter#all()} — the
 * rows handed in are already narrowed, and filtering twice would drop everything at
 * section level.
 *
 * <p>This half is cheap and reproducible, which is why its rules differ from the AI
 * half: it can be recomputed on every release, and it is still computed for cohorts
 * below the narrative floor. What a four-student section must not get is a
 * <em>narrative</em>; the counts are what the page needs to explain why there isn't one.
 */
@Service
public class PrincipalDashboardScopeCalculator {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardScopeCalculator.class);

    /** Bumped when the aggregation changes shape, stamped onto every row. */
    public static final String LOGIC_VERSION = "principal-dashboard-2";

    /** Payload format version, so a reader can tell old rows from new ones. */
    private static final int PAYLOAD_VERSION = 1;

    private final SchoolReportService schoolReportService;

    public PrincipalDashboardScopeCalculator(SchoolReportService schoolReportService) {
        this.schoolReportService = schoolReportService;
    }

    /** What one scope's computation yields. */
    public static final class ScopeResult {
        /** Serialised into {@code internal_calculation}. */
        public Map<String, Object> payload;
        /** Students in this scope who completed <em>and</em> scored — the base for every sheet. */
        public int scoredCount;
        /** Everyone in the scope, whatever their status — the base for participation. */
        public int totalCount;
        /** The compact sheets alone, reused when assembling the model's request. */
        public Map<String, Object> sheets;
    }

    /**
     * Compute one scope from the snapshot.
     *
     * @param snapshot the institute scored once
     * @param scope    the scope to narrow to
     */
    public ScopeResult compute(ReleaseSnapshot snapshot, ScopeKey scope) {
        List<ScoredStudent> students = snapshot.inScope(scope);
        ReleaseSnapshot.Cohort cohort = ReleaseSnapshot.cohortOf(students);

        List<PasteDataRow> rows = new ArrayList<>(cohort.scored);
        for (ScoredStudent s : students) {
            if (s.isScored()) rows.add(s.row);
        }

        ScopeResult result = new ScopeResult();
        result.scoredCount = cohort.scored;
        result.totalCount = cohort.total;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("v", PAYLOAD_VERSION);
        payload.put("scope", scopeBlock(snapshot, scope));
        payload.put("assessment", assessmentBlock(snapshot));
        payload.put("institute", instituteBlock(snapshot));
        payload.put("participation", participationBlock(cohort));
        payload.put("cohort", cohortBlock(snapshot, scope, cohort, rows));

        Map<String, Object> sheets = new LinkedHashMap<>();
        if (rows.isEmpty()) {
            // No scored students: the counts above are the whole truth for this scope.
            // calculateDashboard over an empty list would emit a sheet of zeroes that
            // reads as real data.
            log.info("Principal dashboard: {} has no scored students; counts only", scope.key());
        } else {
            try {
                SchoolDashboard dashboard = schoolReportService.calculateDashboard(
                        rows, SchoolDashboard.ClassFilter.all());
                sheets = CompactDashboardJson.of(dashboard);
            } catch (Exception e) {
                // A failed sheet must not cost the scope its counts; the gap is recorded
                // in the payload rather than swallowed.
                log.warn("Principal dashboard: sheets failed for {}: {}", scope.key(), e.toString());
                payload.put("sheetsError", String.valueOf(e.getMessage()));
            }
        }

        payload.put("sheets", sheets);
        // Counted after calculateDashboard, which is what populates row.calculations.
        payload.put("flags", flags(students));
        payload.put("provenance", provenance(snapshot));

        result.sheets = sheets;
        result.payload = payload;
        return result;
    }

    // ───────────────────────────── blocks ─────────────────────────────

    private Map<String, Object> scopeBlock(ReleaseSnapshot snapshot, ScopeKey scope) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", scope.key());
        m.put("level", scope.level());
        m.put("label", snapshot.labelFor(scope));
        m.put("sessionId", scope.getSessionId());
        m.put("sessionLabel", snapshot.sessionName(scope.getSessionId()));
        m.put("classId", scope.getClassId());
        m.put("sectionId", scope.getSectionId());
        m.put("sectionLabel", scope.getSectionId() == null ? null
                : snapshot.sectionNames().get(scope.getSectionId()));
        m.put("groupId", scope.getGroupId());
        m.put("groupLabel", snapshot.groupName(scope.getGroupId()));
        return m;
    }

    private Map<String, Object> assessmentBlock(ReleaseSnapshot snapshot) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", snapshot.assessmentId());
        m.put("name", snapshot.assessmentName());
        return m;
    }

    private Map<String, Object> instituteBlock(ReleaseSnapshot snapshot) {
        ReleaseSnapshot.InstituteProfile institute = snapshot.institute();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", snapshot.instituteCode());
        // The roster's name comes from a student's own institute and is the more
        // reliable of the two; the profile fills in when no student carried one.
        m.put("name", snapshot.instituteName() != null ? snapshot.instituteName() : institute.name);
        m.put("city", institute.city);
        m.put("state", institute.state);
        m.put("boards", institute.boards);
        return m;
    }

    private Map<String, Object> participationBlock(ReleaseSnapshot.Cohort c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", c.total);
        m.put("completed", c.completed);
        m.put("ongoing", c.ongoing);
        m.put("notStarted", c.notStarted);
        m.put("completedPct", c.completedPct);
        m.put("scored", c.scored);
        m.put("unscored", c.unscored);
        return m;
    }

    private Map<String, Object> cohortBlock(ReleaseSnapshot snapshot, ScopeKey scope,
                                            ReleaseSnapshot.Cohort cohort, List<PasteDataRow> rows) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", snapshot.labelFor(scope));
        m.put("n", cohort.scored);
        int girls = 0, boys = 0;
        List<Integer> grades = new ArrayList<>();
        for (PasteDataRow r : rows) {
            if ("F".equalsIgnoreCase(r.gender)) girls++;
            else if ("M".equalsIgnoreCase(r.gender)) boys++;
            if (r.studentClass != null && !grades.contains(r.studentClass)) grades.add(r.studentClass);
        }
        grades.sort(null);
        m.put("girls", girls);
        m.put("boys", boys);
        m.put("gradesPresent", grades);
        return m;
    }

    /**
     * The three screening tiers, counted in code.
     *
     * <p>These replace sending student-level rows to the model. The narrative only ever
     * reports anonymised counts, so the rows were never the requirement — the counts
     * were. Two of the three already exist as sheet figures; computing all three in one
     * place keeps them reconciled against a single definition rather than against the
     * model's reading of a spreadsheet.
     *
     * <p>These are screening thresholds, not diagnoses.
     */
    private Map<String, Object> flags(List<ScoredStudent> students) {
        List<Long> acute = new ArrayList<>();
        List<Long> abilitySupport = new ArrayList<>();
        List<Long> guidanceMismatch = new ArrayList<>();
        int base = 0;

        for (ScoredStudent s : students) {
            if (!s.isScored()) continue;
            base++;
            SchoolReportService.PasteDataCalculations c = s.row.calculations;
            if (c == null) continue;
            int strong = c.abilities10Plus == null ? 0 : c.abilities10Plus;
            int weak = c.abilities8OrLess == null ? 0 : c.abilities8OrLess;

            if (strong == 0 && weak >= 8) acute.add(s.userStudentId);
            if (weak >= 5) abilitySupport.add(s.userStudentId);
            if (c.hasMatch != null && c.hasMatch == 0) guidanceMismatch.add(s.userStudentId);
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("acute", acute.size());
        m.put("abilitySupport", abilitySupport.size());
        m.put("guidanceMismatch", guidanceMismatch.size());
        m.put("base", base);

        // Ids, not names. The dashboard needs to be able to answer "which students",
        // and recomputing a tier on demand would mean re-scoring the cohort — but a
        // payload that travels on every page load should not carry identifiable data.
        // Names are resolved by a separate request, only when someone asks for them.
        Map<String, Object> ids = new LinkedHashMap<>();
        ids.put(TIER_ACUTE, acute);
        ids.put(TIER_ABILITY_SUPPORT, abilitySupport);
        ids.put(TIER_GUIDANCE_MISMATCH, guidanceMismatch);
        m.put("students", ids);
        return m;
    }

    /** Tier keys, shared with the endpoint that resolves them to names. */
    public static final String TIER_ACUTE = "acute";
    public static final String TIER_ABILITY_SUPPORT = "abilitySupport";
    public static final String TIER_GUIDANCE_MISMATCH = "guidanceMismatch";

    private Map<String, Object> provenance(ReleaseSnapshot snapshot) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("generatedAt", new Date());
        m.put("logicVersion", LOGIC_VERSION);
        m.put("snapshotStudents", snapshot.allStudents().size());
        m.put("scoringFailures", snapshot.scoringFailures());
        return m;
    }
}
