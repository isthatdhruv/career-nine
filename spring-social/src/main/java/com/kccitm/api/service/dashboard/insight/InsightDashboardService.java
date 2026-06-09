package com.kccitm.api.service.dashboard.insight;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.BetReportData;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.NavigatorReportData;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.repository.Career9.BetReportDataRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.NavigatorReportDataRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService.IntermediaryScores;
import com.kccitm.api.service.b2c.pager.Navigator360EngineService;
import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerDefinition;
import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerMatch;
import com.kccitm.api.service.b2c.pager.Navigator360Models.FlagInfo;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;
import com.kccitm.api.service.b2c.pager.PagerScoreSource;

/**
 * Builds the per-student {@link InsightDashboard} for the admin/student "view
 * dashboard" flow. Reuses the production scoring engines so the dashboard always
 * reflects the same analysis as the generated report — it never re-derives
 * numbers on its own.
 *
 * <p>The expensive step (scoring raw answers) is already cached in
 * {@code intermediary_scores}; this service only runs the cheap in-memory
 * derivation ({@link Navigator360EngineService#computeNavigator360}) on top of
 * it, so on-demand build is fast and always consistent with the latest engine.
 */
@Service
public class InsightDashboardService {

    /** How many ranked careers to surface on the dashboard. */
    private static final int TOP_CAREERS = 6;

    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private PagerScoreSource pagerScoreSource;
    @Autowired private Navigator360EngineService engine;
    @Autowired private BetReportDataRepository betReportDataRepository;
    @Autowired private NavigatorReportDataRepository navigatorReportDataRepository;
    @Autowired private InsightAccessService insightAccessService;

    /** Section types kept visible in a locked teaser (a real but partial preview). */
    private static final java.util.Set<String> TEASER_TYPES = java.util.Set.of("stat", "radar");

    /** Thrown when the student has no usable scores yet (async persist in flight). */
    public static class ScoresNotReadyException extends RuntimeException {
        public ScoresNotReadyException(String m) { super(m); }
    }

    /** Thrown when the student has no generated report to build a dashboard from. */
    public static class NoReportException extends RuntimeException {
        public NoReportException(String m) { super(m); }
    }

    /**
     * Build the insight dashboard for a student. When {@code assessmentId} is
     * null, the most recently generated report is used.
     *
     * @param audience "admin" (always full content) or "student" (apply the
     *                 entitlement gate; locked views are trimmed to a teaser).
     */
    public InsightDashboard buildForStudent(Long userStudentId, Long assessmentId, String audience) {
        GeneratedReport report = resolveReport(userStudentId, assessmentId);
        String engineCode = report.getTypeOfReport();
        Long resolvedAssessmentId = report.getAssessmentId();

        if (engineCode == null) {
            engineCode = "pager"; // historical default before report_type was populated
        }

        InsightDashboard dashboard;
        switch (engineCode) {
            case "pager":
                dashboard = buildPager(userStudentId, resolvedAssessmentId);
                break;
            case "bet":
                dashboard = buildBet(userStudentId, resolvedAssessmentId);
                break;
            case "navigator":
            case "legacy":
                dashboard = buildLegacy(userStudentId, resolvedAssessmentId);
                break;
            default:
                throw new UnsupportedOperationException(
                        "Insight dashboard for engine '" + engineCode + "' is not available yet.");
        }

        applyAccess(dashboard, userStudentId, resolvedAssessmentId, audience);
        return dashboard;
    }

    /**
     * Stamp the access decision on the dashboard. For a locked student audience,
     * trim the sections to a teaser and attach the paywall CTA; the admin audience
     * always keeps full content but still sees the lock status.
     */
    private void applyAccess(InsightDashboard d, Long userStudentId, Long assessmentId, String audience) {
        InsightAccessService.Decision decision = insightAccessService.evaluate(userStudentId, assessmentId);
        d.access.unlocked = decision.unlocked;
        d.access.reason = decision.reason;

        boolean isStudent = "student".equalsIgnoreCase(audience);
        if (isStudent && !decision.unlocked) {
            List<InsightDashboard.Section> teaser = new ArrayList<>();
            for (InsightDashboard.Section s : d.sections) {
                if (s != null && TEASER_TYPES.contains(s.type)) {
                    teaser.add(s);
                }
            }
            d.sections = teaser;
            d.access.preview = true;
            d.access.cta = new InsightDashboard.Cta(
                    "Unlock your full results",
                    "You've completed the assessment. Unlock your dashboard to see your full career insights, "
                            + "matches and recommendations.");
        }
    }

    // ───────────────────── report resolution ─────────────────────

    private GeneratedReport resolveReport(Long userStudentId, Long assessmentId) {
        List<GeneratedReport> reports = generatedReportRepository.findByUserStudentUserStudentId(userStudentId);
        List<GeneratedReport> generated = new ArrayList<>();
        for (GeneratedReport r : reports) {
            if ("generated".equals(r.getReportStatus())) {
                generated.add(r);
            }
        }
        if (generated.isEmpty()) {
            throw new NoReportException("No generated report for student " + userStudentId);
        }
        if (assessmentId != null) {
            return generated.stream()
                    .filter(r -> assessmentId.equals(r.getAssessmentId()))
                    .findFirst()
                    .orElseThrow(() -> new NoReportException(
                            "No generated report for student " + userStudentId + " / assessment " + assessmentId));
        }
        // Most recently updated generated report.
        return generated.stream()
                .max(Comparator.comparing(
                        r -> r.getUpdatedAt() != null ? r.getUpdatedAt()
                                : (r.getCreatedAt() != null ? r.getCreatedAt() : new java.util.Date(0))))
                .orElse(generated.get(0));
    }

    // ───────────────────── pager (Navigator 360) ─────────────────────

    private InsightDashboard buildPager(Long userStudentId, Long assessmentId) {
        IntermediaryScores intermediary = pagerScoreSource.getIntermediaryScores(userStudentId, assessmentId);
        if (intermediary == null) {
            throw new ScoresNotReadyException(
                    "Scores not ready for student " + userStudentId + " / assessment " + assessmentId);
        }
        Navigator360Result r = engine.computeNavigator360(intermediary, null, null, 1.0);

        InsightDashboard d = new InsightDashboard("pager");
        d.generatedAt = Instant.now().toString();

        // Header
        d.student.name = r.studentName;
        d.student.studentClass = r.studentClass;
        d.student.gradeGroup = r.gradeGroup;
        applySchool(userStudentId, d);

        // 1. Headline stats
        List<InsightDashboard.Stat> stats = new ArrayList<>();
        if (r.hollandCode != null && !r.hollandCode.isEmpty()) {
            stats.add(new InsightDashboard.Stat("Holland Code", r.hollandCode, "Your interest signature", "primary"));
        }
        if (r.cci != null) {
            stats.add(new InsightDashboard.Stat("Career Choice Index", r.cci.name(),
                    "Readiness to commit to a career direction", accentForLevel(r.cci.name())));
        }
        stats.add(new InsightDashboard.Stat("Alignment", r.alignmentScore + "%",
                "How well your interests, abilities & values line up", accentForPct(r.alignmentScore)));
        if (r.topCareers != null && !r.topCareers.isEmpty() && r.topCareers.get(0).career != null) {
            stats.add(new InsightDashboard.Stat("Top Match", r.topCareers.get(0).career.name,
                    "Your strongest-fit career", "good"));
        }
        if (!stats.isEmpty()) {
            d.addSection(new InsightDashboard.Section("stat", "At a glance", stats));
        }

        // 2. RIASEC interest profile (radar)
        List<InsightDashboard.Axis> riasec = toAxes(r.riasec, Naming.RIASEC);
        if (!riasec.isEmpty()) {
            d.addSection(new InsightDashboard.Section("radar", "Interest Profile (RIASEC)", riasec)
                    .subtitle("Your Holland interest dimensions"));
        }

        // 3. Multiple Intelligences (bars)
        List<InsightDashboard.Axis> mi = toAxes(r.mi, Naming.MI);
        if (!mi.isEmpty()) {
            d.addSection(new InsightDashboard.Section("bars", "Multiple Intelligences", mi)
                    .subtitle("Where your natural intelligences are strongest"));
        }

        // 4. Aptitudes / Abilities (bars)
        List<InsightDashboard.Axis> abilities = toAxes(r.abilities, Naming.ABILITY);
        if (!abilities.isEmpty()) {
            d.addSection(new InsightDashboard.Section("bars", "Aptitudes & Abilities", abilities)
                    .subtitle("Your measured ability strengths"));
        }

        // 5. Career matches
        List<InsightDashboard.Career> careers = toCareers(r);
        if (!careers.isEmpty()) {
            d.addSection(new InsightDashboard.Section("careers", "Top Career Matches", careers)
                    .subtitle("Ranked by overall suitability"));
        }

        // 6. Values / Subjects / Aspirations (chips)
        if (notEmpty(r.values)) {
            d.addSection(new InsightDashboard.Section("chips", "What You Value", r.values));
        }
        if (notEmpty(r.subjectsOfInterest)) {
            d.addSection(new InsightDashboard.Section("chips", "Subjects of Interest", r.subjectsOfInterest));
        }
        if (notEmpty(r.careerAspirations)) {
            d.addSection(new InsightDashboard.Section("chips", "Career Aspirations", r.careerAspirations));
        }

        // 7. Flags / notes
        List<InsightDashboard.Flag> flags = toFlags(r.flags);
        if (!flags.isEmpty()) {
            d.addSection(new InsightDashboard.Section("flags", "Things to Keep in Mind", flags));
        }

        return d;
    }

    // ───────────────────── BET (narrative engine) ─────────────────────

    private InsightDashboard buildBet(Long userStudentId, Long assessmentId) {
        BetReportData r = betReportDataRepository
                .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new NoReportException(
                        "No BET report data for student " + userStudentId + " / assessment " + assessmentId));

        InsightDashboard d = new InsightDashboard("bet");
        d.generatedAt = Instant.now().toString();
        d.student.name = r.getStudentName();
        d.student.studentClass = r.getStudentGrade();
        applySchool(userStudentId, d);

        // Cognitive profile
        List<InsightDashboard.Note> cognitive = new ArrayList<>();
        addNote(cognitive, "Cognitive Flexibility", r.getCog1());
        addNote(cognitive, "Attention", r.getCog2());
        addNote(cognitive, "Working Memory", firstNonBlank(r.getCog3Description(), r.getCog3()));
        if (!cognitive.isEmpty()) {
            d.addSection(new InsightDashboard.Section("notes", "Cognitive Profile", cognitive));
        }

        // Self-management
        List<InsightDashboard.Note> selfMgmt = new ArrayList<>();
        addNote(selfMgmt, "Self-Efficacy", r.getSelfManagement1());
        addNote(selfMgmt, "Self-Regulation", r.getSelfManagement2());
        addNote(selfMgmt, "Emotion Regulation", r.getSelfManagement3());
        if (!selfMgmt.isEmpty()) {
            d.addSection(new InsightDashboard.Section("notes", "Self-Management", selfMgmt));
        }

        // Social & environment
        List<InsightDashboard.Note> social = new ArrayList<>();
        addNote(social, "Social Insight", r.getSocialInsight());
        addNote(social, "Environmental Awareness", r.getEnvironment());
        if (!social.isEmpty()) {
            d.addSection(new InsightDashboard.Section("notes", "Social & Environment", social));
        }

        // Values
        List<String> values = collectNonBlank(r.getValue1(), r.getValue2(), r.getValue3());
        if (!values.isEmpty()) {
            d.addSection(new InsightDashboard.Section("chips", "What You Value", values));
        }
        if (isNotBlank(r.getValueOverview())) {
            d.addSection(new InsightDashboard.Section("notes", "Values Overview",
                    List.of(new InsightDashboard.Note(null, r.getValueOverview()))));
        }

        return d;
    }

    // ───────────────────── Legacy Navigator (narrative engine) ─────────────────────

    private InsightDashboard buildLegacy(Long userStudentId, Long assessmentId) {
        NavigatorReportData r = navigatorReportDataRepository
                .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new NoReportException(
                        "No Navigator report data for student " + userStudentId + " / assessment " + assessmentId));

        InsightDashboard d = new InsightDashboard("navigator");
        d.generatedAt = Instant.now().toString();
        d.student.name = r.getStudentName();
        d.student.studentClass = r.getStudentClass();
        d.student.schoolName = r.getStudentSchool();
        applySchool(userStudentId, d);

        if (!r.isEligible()) {
            d.addSection(new InsightDashboard.Section("flags", "Report Eligibility",
                    List.of(new InsightDashboard.Flag("Not eligible",
                            firstNonBlank(r.getEligibilityIssues(), "This assessment did not meet eligibility for a full report."),
                            "warning"))));
        }

        if (isNotBlank(r.getSummary())) {
            d.addSection(new InsightDashboard.Section("notes", "Summary",
                    List.of(new InsightDashboard.Note(null, r.getSummary()))));
        }

        // Personality / Intelligence highlights
        List<InsightDashboard.Note> profile = new ArrayList<>();
        addNote(profile, "Personality", r.getPersonality1Text());
        addNote(profile, "Personality", r.getPersonality2Text());
        addNote(profile, "Personality", r.getPersonality3Text());
        addNote(profile, "Intelligence", r.getIntelligence1Text());
        addNote(profile, "Intelligence", r.getIntelligence2Text());
        addNote(profile, "Intelligence", r.getIntelligence3Text());
        if (!profile.isEmpty()) {
            d.addSection(new InsightDashboard.Section("notes", "Personality & Intelligence", profile));
        }

        // Learning style
        List<String> learningStyles = collectNonBlank(
                r.getLearningStyle1(), r.getLearningStyle2(), r.getLearningStyle3());
        if (!learningStyles.isEmpty()) {
            d.addSection(new InsightDashboard.Section("chips", "Learning Styles", learningStyles));
        }
        if (isNotBlank(r.getLearningStyle())) {
            d.addSection(new InsightDashboard.Section("notes", "About Your Learning Style",
                    List.of(new InsightDashboard.Note(null, r.getLearningStyle()))));
        }

        // Abilities / Subjects / Values / Aspirations
        List<String> abilities = collectNonBlank(
                r.getAbility1(), r.getAbility2(), r.getAbility3(), r.getAbility4());
        if (!abilities.isEmpty()) {
            d.addSection(new InsightDashboard.Section("chips", "Your Abilities", abilities));
        }
        List<String> soi = collectNonBlank(
                r.getSoi1(), r.getSoi2(), r.getSoi3(), r.getSoi4(), r.getSoi5());
        if (!soi.isEmpty()) {
            d.addSection(new InsightDashboard.Section("chips", "Subjects of Interest", soi));
        }
        List<String> values = collectNonBlank(
                r.getValues1(), r.getValues2(), r.getValues3(), r.getValues4());
        if (!values.isEmpty()) {
            d.addSection(new InsightDashboard.Section("chips", "What You Value", values));
        }
        List<String> asps = collectNonBlank(
                r.getCareerAsp1(), r.getCareerAsp2(), r.getCareerAsp3(), r.getCareerAsp4());
        if (!asps.isEmpty()) {
            d.addSection(new InsightDashboard.Section("chips", "Career Aspirations", asps));
        }

        // Recommended career pathways (ranked, label only — legacy has no scores)
        String[] pathways = {
                r.getPathway1(), r.getPathway2(), r.getPathway3(), r.getPathway4(), r.getPathway5(),
                r.getPathway6(), r.getPathway7(), r.getPathway8(), r.getPathway9()
        };
        List<InsightDashboard.ListItem> pathwayItems = new ArrayList<>();
        for (String p : pathways) {
            if (isNotBlank(p)) pathwayItems.add(new InsightDashboard.ListItem(p.trim(), null));
        }
        if (!pathwayItems.isEmpty()) {
            d.addSection(new InsightDashboard.Section("list", "Recommended Career Pathways", pathwayItems)
                    .subtitle("Ranked best-fit careers"));
        }

        // Recommendations / growth
        if (isNotBlank(r.getRecommendations())) {
            d.addSection(new InsightDashboard.Section("notes", "Recommendations",
                    List.of(new InsightDashboard.Note(null, r.getRecommendations()))));
        }
        List<InsightDashboard.Note> growth = new ArrayList<>();
        addNote(growth, "Area to Strengthen", r.getWeakAbility());
        addNote(growth, "Career Fit", r.getCareerMatchResult());
        if (!growth.isEmpty()) {
            d.addSection(new InsightDashboard.Section("notes", "Growth & Fit", growth));
        }

        return d;
    }

    // ───────────────────── mapping helpers ─────────────────────

    private static void addNote(List<InsightDashboard.Note> notes, String title, String body) {
        if (isNotBlank(body)) {
            notes.add(new InsightDashboard.Note(title, body.trim()));
        }
    }

    private static List<String> collectNonBlank(String... vals) {
        List<String> out = new ArrayList<>();
        if (vals == null) return out;
        for (String v : vals) {
            if (isNotBlank(v)) out.add(v.trim());
        }
        return out;
    }

    private static boolean isNotBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static String firstNonBlank(String... vals) {
        if (vals == null) return null;
        for (String v : vals) {
            if (isNotBlank(v)) return v;
        }
        return null;
    }

    private enum Naming { RIASEC, MI, ABILITY }

    private List<InsightDashboard.Axis> toAxes(List<ScoredDimension> dims, Naming naming) {
        List<InsightDashboard.Axis> out = new ArrayList<>();
        if (dims == null) return out;
        for (ScoredDimension dim : dims) {
            if (dim == null) continue;
            String label;
            switch (naming) {
                case RIASEC:  label = Navigator360EngineService.riasecDisplayName(dim.name); break;
                case MI:      label = Navigator360EngineService.miDisplayName(dim.name); break;
                case ABILITY: label = Navigator360EngineService.abilityDisplayName(dim.name); break;
                default:      label = dim.name;
            }
            out.add(new InsightDashboard.Axis(
                    label,
                    round1(dim.normPct),
                    dim.rawScore,
                    dim.stanine,
                    dim.level != null ? dim.level.name() : null));
        }
        return out;
    }

    private List<InsightDashboard.Career> toCareers(Navigator360Result r) {
        List<CareerMatch> source = (r.topCareers != null && !r.topCareers.isEmpty())
                ? r.topCareers : r.careerMatches;
        List<InsightDashboard.Career> out = new ArrayList<>();
        if (source == null) return out;
        List<CareerMatch> sorted = new ArrayList<>(source);
        sorted.sort(Comparator.comparingInt((CareerMatch m) -> m.suitability).reversed());
        for (CareerMatch m : sorted) {
            if (m == null || m.career == null) continue;
            InsightDashboard.Career c = new InsightDashboard.Career();
            CareerDefinition def = m.career;
            c.name = def.name;
            c.suitability = m.suitability;
            c.potentialMatch = m.potentialMatch;
            c.valuesMatch = m.valuesMatch;
            c.aspiration = m.isAspiration;
            if (m.matchedValues != null) c.matchedValues = new ArrayList<>(m.matchedValues);
            out.add(c);
            if (out.size() >= TOP_CAREERS) break;
        }
        return out;
    }

    private List<InsightDashboard.Flag> toFlags(List<FlagInfo> flags) {
        List<InsightDashboard.Flag> out = new ArrayList<>();
        if (flags == null) return out;
        for (FlagInfo f : flags) {
            if (f == null) continue;
            out.add(new InsightDashboard.Flag(f.name, f.message, f.severity));
        }
        return out;
    }

    private void applySchool(Long userStudentId, InsightDashboard d) {
        userStudentRepository.findById(userStudentId).ifPresent(us -> {
            StudentInfo si = us.getStudentInfo();
            if (si != null && si.getStudentClass() != null
                    && (d.student.studentClass == null || d.student.studentClass.isEmpty())) {
                d.student.studentClass = String.valueOf(si.getStudentClass());
            }
            if (us.getInstitute() != null) {
                d.student.schoolName = us.getInstitute().getInstituteName();
                d.student.schoolCity = us.getInstitute().getCity();
            }
        });
    }

    private static boolean notEmpty(List<?> l) {
        return l != null && !l.isEmpty();
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static String accentForPct(int pct) {
        if (pct >= 67) return "good";
        if (pct >= 34) return "primary";
        return "warn";
    }

    private static String accentForLevel(String level) {
        if (level == null) return "primary";
        switch (level.toUpperCase()) {
            case "HIGH": return "good";
            case "LOW":  return "warn";
            default:     return "primary";
        }
    }
}
