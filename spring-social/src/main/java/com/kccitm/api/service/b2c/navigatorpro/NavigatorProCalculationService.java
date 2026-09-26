package com.kccitm.api.service.b2c.navigatorpro;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.DemographicFieldDefinition;
import com.kccitm.api.model.career9.DemographicFieldOption;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentDemographicResponse;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.StudentDemographicResponseRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProNorms.NormSet;
import com.kccitm.api.service.b2c.report.EngineVersions;
import com.kccitm.api.service.b2c.report.IntermediaryScoresPayload;
import com.kccitm.api.service.b2c.report.PlaceholderCalculator;
import com.kccitm.api.service.b2c.report.ReportRoutingException;
import com.kccitm.api.service.b2c.report.ReportSuppressedException;

/**
 * Navigator Pro engine v3 (engineCode {@code navigator_pro}). Scores the Sept-2026
 * instrument from the stored MQT option scores, applies gates R1–R6, computes cohort
 * norms (internal percentiles pick bands; no percentile is ever printed), runs the
 * locked two-tier blend and emits the placeholder map. Runs on the report-worker
 * thread with no open session: every query here fetches eagerly.
 *
 * <p>Gate order: R1 attention → R2 validity (never suppresses) → R5 incomplete → R3
 * weak peak → R4 no signal → R6 Explorer (generates). R5 is checked before R3/R4 so a
 * half-answered sheet is reported as incomplete rather than as a weak profile.
 */
@Component
public class NavigatorProCalculationService implements PlaceholderCalculator {

    private static final Logger logger = LoggerFactory.getLogger(NavigatorProCalculationService.class);
    static final long NORMS_TTL_MS = 60_000L;
    /** Circumference of the page-2 ring (r = 36) for stroke-dasharray. */
    private static final double RING_C = 2 * Math.PI * 36;

    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Autowired private StudentDemographicResponseRepository demographicResponseRepository;
    @Autowired private NavigatorProConstructMap map;
    @Autowired private NavigatorProBlend blend;

    private final NavigatorProContent content = NavigatorProContent.defaults();

    @Value("${app.navigator-pro.career-library-url:https://library.career-9.com/}") private String careerLibraryUrl;
    @Value("${app.navigator-pro.flat-gap:10}")              private double flatGap;
    @Value("${app.navigator-pro.weak-peak:50}")             private double weakPeak;
    @Value("${app.navigator-pro.no-signal-exposure:0}")     private double noSignalExposure;
    @Value("${app.navigator-pro.banner-flag-count:2}")      private int bannerFlagCount;
    @Value("${app.navigator-pro.norms-min-n:60}")           private int normsMinN;
    @Value("${app.navigator-pro.percentile-min-n:30}")      private int percentileMinN;
    @Value("${app.navigator-pro.tie-gap:3}")                private double tieGap;
    @Value("${app.navigator-pro.explorer-spread:5}")        private double explorerSpread;
    @Value("${app.navigator-pro.explorer-max-exposure:75}") private double explorerMaxExposure;
    @Value("${app.navigator-pro.track-a-cut:50}")           private double trackACut;

    private final Map<Long, NavigatorProQuestionnaireIndex> indexCache = new ConcurrentHashMap<>();
    private final Map<Long, CachedNorms> normsCache = new ConcurrentHashMap<>();

    private static final class CachedNorms {
        final int completedCount; final long at; final NormSet norms;
        CachedNorms(int completedCount, long at, NormSet norms) { this.completedCount = completedCount; this.at = at; this.norms = norms; }
    }

    /** One student's full evaluation, suppressed or not. Shared by the report and the raw export. */
    public static final class Evaluation {
        public final long userStudentId;
        public final NavigatorProScores scores;
        /** First suppressing gate (R1, R5, R3, R4) or null. */
        public final String gateCode;
        public final String gateReason;
        /** Null only when the blend could not run (values incomplete). */
        public final NavigatorProBlend.Result blend;
        public final boolean banner;
        public final boolean trackA;

        Evaluation(long userStudentId, NavigatorProScores scores, String gateCode, String gateReason,
                   NavigatorProBlend.Result blend, boolean banner, boolean trackA) {
            this.userStudentId = userStudentId; this.scores = scores; this.gateCode = gateCode;
            this.gateReason = gateReason; this.blend = blend; this.banner = banner; this.trackA = trackA;
        }

        public boolean suppressed() { return gateCode != null; }
        public boolean explorer()   { return !suppressed() && blend != null && blend.explorer; }

        /** R1–R6 outcome as one word for the manifest / raw export. */
        public String outcome() {
            if (suppressed()) return gateCode + " suppressed";
            return explorer() ? "R6 Explorer" : "Generated";
        }
    }

    @PostConstruct
    void checkMatrices() {
        blend.validateAgainst(map);
    }

    @Override public String typeCode()          { return "navigator_pro"; }
    @Override public String engineVersion()     { return EngineVersions.NAVIGATOR_PRO_V3; }
    @Override public boolean usesIntermediary() { return false; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId, IntermediaryScoresPayload intermediary) {
        NavigatorProQuestionnaireIndex index = indexFor(assessmentId);
        List<AssessmentAnswer> answers = answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);
        Evaluation ev = evaluate(userStudentId, index, answers);
        if (ev.suppressed()) {
            if (!ev.scores.incomplete.isEmpty()) {
                logger.info("Navigator Pro incomplete student={} assessment={}: {}", userStudentId, assessmentId, ev.scores.incomplete);
            }
            throw new ReportSuppressedException(ev.gateCode, ev.gateReason);
        }
        NormSet norms = normsFor(assessmentId, index);
        return placeholders(userStudentId, assessmentId, ev, norms);
    }

    // ── schema check ─────────────────────────────────────────────────────────

    public NavigatorProQuestionnaireIndex indexFor(Long assessmentId) {
        NavigatorProQuestionnaireIndex ix = indexCache.get(assessmentId);
        if (ix != null && ix.valid()) return ix;
        AssessmentTable a = assessmentTableRepository.findById(assessmentId).orElse(null);
        Long questionnaireId = (a != null && a.getQuestionnaire() != null) ? a.getQuestionnaire().getQuestionnaireId() : null;
        if (questionnaireId == null) {
            throw new ReportRoutingException("Assessment " + assessmentId + " has no questionnaire");
        }
        List<QuestionnaireQuestion> questions = questionnaireQuestionRepository.findByQuestionnaireIdWithOptions(questionnaireId);
        List<Long> optionIds = new ArrayList<>();
        for (QuestionnaireQuestion qq : questions) {
            if (qq.getQuestion() == null || qq.getQuestion().getOptions() == null) continue;
            for (AssessmentQuestionOptions o : qq.getQuestion().getOptions()) optionIds.add(o.getOptionId());
        }
        Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId = new HashMap<>();
        if (!optionIds.isEmpty()) {
            for (OptionScoreBasedOnMEasuredQualityTypes sc : optionScoreRepository.findByOptionIdIn(optionIds)) {
                if (sc.getQuestion_option() == null) continue;
                scoresByOptionId.computeIfAbsent(sc.getQuestion_option().getOptionId(), k -> new ArrayList<>()).add(sc);
            }
        }
        ix = NavigatorProQuestionnaireIndex.build(map, questionnaireId, questions, scoresByOptionId);
        List<String> problems = new ArrayList<>(ix.problems);
        for (String tag : ix.valueTagByOptionId.values()) {
            if (!blend.knowsValueTag(tag)) problems.add("value tag '" + tag + "' has no column in the value-supply matrix");
        }
        if (!problems.isEmpty()) {
            throw new ReportRoutingException("Questionnaire " + questionnaireId + " is not on the Navigator Pro v3 instrument: "
                    + String.join("; ", problems));
        }
        indexCache.put(assessmentId, ix);
        return ix;
    }

    // ── answers → scorer input ───────────────────────────────────────────────

    public List<Contribution> contributions(NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
        List<Contribution> out = new ArrayList<>();
        for (AssessmentAnswer a : answers) {
            QuestionnaireQuestion qq = a.getQuestionnaireQuestion();
            if (qq == null || qq.getQuestionnaireQuestionId() == null) continue;
            String construct = index.constructByQuestion.get(qq.getQuestionnaireQuestionId());
            if (construct == null) continue;
            AssessmentQuestionOptions option = a.getOption() != null ? a.getOption() : a.getMappedOption();
            if (option == null || option.getOptionScores() == null) continue;
            for (OptionScoreBasedOnMEasuredQualityTypes sc : option.getOptionScores()) {
                if (sc.getMeasuredQualityType() == null || sc.getScore() == null) continue;
                Optional<String> key = map.constructFor(sc.getMeasuredQualityType().getMeasuredQualityTypeName());
                if (key.isPresent() && key.get().equals(construct)) {
                    out.add(new Contribution(construct, qq.getQuestionnaireQuestionId(), sc.getScore()));
                    break;   // one contribution per answered question
                }
            }
        }
        return out;
    }

    List<ValueRank> valueRanks(NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
        List<ValueRank> out = new ArrayList<>();
        if (index.rankingQuestionId == null) return out;
        for (AssessmentAnswer a : answers) {
            QuestionnaireQuestion qq = a.getQuestionnaireQuestion();
            if (qq == null || !index.rankingQuestionId.equals(qq.getQuestionnaireQuestionId())) continue;
            AssessmentQuestionOptions option = a.getOption() != null ? a.getOption() : a.getMappedOption();
            if (a.getRankOrder() == null || option == null) continue;
            String tag = index.valueTagByOptionId.get(option.getOptionId());
            if (tag == null) continue;
            out.add(new ValueRank(a.getRankOrder(), tag, option.getOptionText()));
        }
        return out;
    }

    List<String> aspirations(NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
        List<String> out = new ArrayList<>();
        if (index.aspirationQuestionId == null) return out;
        for (AssessmentAnswer a : answers) {
            QuestionnaireQuestion qq = a.getQuestionnaireQuestion();
            if (qq == null || !index.aspirationQuestionId.equals(qq.getQuestionnaireQuestionId())) continue;
            AssessmentQuestionOptions option = a.getOption() != null ? a.getOption() : a.getMappedOption();
            if (option == null) continue;
            map.domainForLabel(option.getOptionText()).filter(d -> !out.contains(d)).ifPresent(out::add);
        }
        return out;
    }

    // ── evaluation and gates ─────────────────────────────────────────────────

    public Evaluation evaluate(long userStudentId, NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
        NavigatorProScorer scorer = new NavigatorProScorer(map, flatGap);
        NavigatorProScores s = scorer.score(contributions(index, answers), valueRanks(index, answers),
                aspirations(index, answers), index.questionsByConstruct);
        NavigatorProBlend.Result b = s.valuesMissing ? null
                : blend.compute(s, map, tieGap, explorerSpread, explorerMaxExposure);
        String[] gate = gate(s);
        boolean banner = s.validityFlags >= bannerFlagCount;
        boolean trackA = s.get("fam_r") < trackACut && s.get("fam_i") < trackACut;
        return new Evaluation(userStudentId, s, gate == null ? null : gate[0], gate == null ? null : gate[1], b, banner, trackA);
    }

    /** {code, reason} for the first tripped suppressing gate, else null. R2 and R6 never suppress. */
    String[] gate(NavigatorProScores s) {
        if (!s.attentionPassed) return new String[]{"R1", "attention check not passed"};
        if (!s.incomplete.isEmpty()) return new String[]{"R5", s.incomplete.size() + " item(s) unanswered, duplicated or values not ranked 4"};
        if (s.maxFamily() < weakPeak) return new String[]{"R3", "weak peak: no interest family at or above " + (int) weakPeak};
        if (s.flat && s.maxDomain() <= noSignalExposure) {
            return new String[]{"R4", "no signal: tied interests and no domain exposure above " + (int) noSignalExposure};
        }
        return null;
    }

    // ── cohort norms ─────────────────────────────────────────────────────────

    /** Every answer row of the assessment, grouped by student (one query). */
    public Map<Long, List<AssessmentAnswer>> answersByStudent(Long assessmentId) {
        Map<Long, List<AssessmentAnswer>> byStudent = new HashMap<>();
        for (AssessmentAnswer a : answerRepository.findAllByAssessmentIdWithScores(assessmentId)) {
            if (a.getUserStudent() == null || a.getUserStudent().getUserStudentId() == null) continue;
            byStudent.computeIfAbsent(a.getUserStudent().getUserStudentId(), k -> new ArrayList<>()).add(a);
        }
        return byStudent;
    }

    /** Evaluates each completed student (or just {@code onlyIds}) from one load of the assessment's answers. */
    public Map<Long, Evaluation> evaluateCohort(Long assessmentId, NavigatorProQuestionnaireIndex index, Set<Long> onlyIds) {
        return evaluateCohort(assessmentId, index, onlyIds, answersByStudent(assessmentId));
    }

    public Map<Long, Evaluation> evaluateCohort(Long assessmentId, NavigatorProQuestionnaireIndex index, Set<Long> onlyIds,
                                                Map<Long, List<AssessmentAnswer>> byStudent) {
        Set<Long> completedIds = new HashSet<>();
        for (StudentAssessmentMapping m : mappingRepository.findCompletedForAssessment(assessmentId)) {
            if (m.getUserStudent() != null && m.getUserStudent().getUserStudentId() != null) completedIds.add(m.getUserStudent().getUserStudentId());
        }
        Map<Long, Evaluation> out = new LinkedHashMap<>();
        Set<Long> ids = onlyIds != null ? onlyIds : completedIds;
        for (Long sid : ids) {
            out.put(sid, evaluate(sid, index, byStudent.getOrDefault(sid, List.of())));
        }
        return out;
    }

    public NormSet normsFor(Long assessmentId, NavigatorProQuestionnaireIndex index) {
        List<StudentAssessmentMapping> completed = mappingRepository.findCompletedForAssessment(assessmentId);
        CachedNorms cached = normsCache.get(assessmentId);
        long now = System.currentTimeMillis();
        if (cached != null && cached.completedCount == completed.size() && now - cached.at < NORMS_TTL_MS) {
            return cached.norms;
        }
        List<NavigatorProNorms.Member> members = new ArrayList<>();
        for (Evaluation ev : evaluateCohort(assessmentId, index, null).values()) {
            if (ev.suppressed()) continue;   // cohort = completed and gate-passed
            Map<String, Double> metrics = new HashMap<>();
            for (String metric : NavigatorProNorms.METRICS) {
                metrics.put(metric, metric.equals("reasoning") ? (double) ev.scores.reasoning : ev.scores.get(metric));
            }
            members.add(new NavigatorProNorms.Member(ev.userStudentId, metrics));
        }
        NormSet norms = NavigatorProNorms.build(members, percentileMinN, normsMinN);
        normsCache.put(assessmentId, new CachedNorms(completed.size(), now, norms));
        return norms;
    }

    // ── placeholders ─────────────────────────────────────────────────────────

    Map<String, Object> placeholders(Long userStudentId, Long assessmentId, Evaluation ev, NormSet norms) {
        NavigatorProScores s = ev.scores;
        NavigatorProBlend.Result b = ev.blend;
        Map<String, Object> p = new LinkedHashMap<>();

        // Identity and batch
        UserStudent us = userStudentRepository.findByIdWithStudentInfo(userStudentId).orElse(null);
        StudentInfo si = us != null ? us.getStudentInfo() : null;
        String name = si != null && si.getName() != null ? titleCase(si.getName().trim()) : "";
        String first = name.isEmpty() ? "" : name.split("\\s+")[0];
        String college = us != null && us.getInstitute() != null && us.getInstitute().getInstituteName() != null
                ? us.getInstitute().getInstituteName() : "";
        p.put("student_name", name);
        p.put("first_name", first);
        p.put("student_id", studentId(si, userStudentId));
        p.put("college", college);
        p.put("student_line", college);
        p.put("stream", stream(userStudentId, assessmentId));
        String logoUrl = us != null && us.getInstitute() != null && us.getInstitute().getLogoUrl() != null
                ? us.getInstitute().getLogoUrl().trim() : "";
        p.put("school_logo_url", logoUrl);
        p.put("school_logo", logoUrl.isEmpty() ? "" : "<img src=\"" + escapeAttr(logoUrl) + "\" alt=\"\" style=\"position:absolute; "
                + "top:14px; bottom:14px; right:78px; left:30px; width:calc(100% - 108px); height:48px; background:#ffffff; "
                + "object-fit:contain; object-position:right center\">");
        StudentAssessmentMapping mapping = mappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId).orElse(null);
        Date completedAt = mapping != null ? mapping.getCompletedAt() : null;
        p.put("reading_no", readingNo(userStudentId, assessmentId, completedAt));
        p.put("reading_date", completedAt == null ? "" : new SimpleDateFormat("d MMM yyyy", Locale.ENGLISH).format(completedAt));
        p.put("batch_n", norms.n);
        p.put("career_library_url", careerLibraryUrl == null ? "" : careerLibraryUrl);
        p.put("norms_provisional", norms.provisional);
        p.put("percentiles_suppressed", norms.percentilesSuppressed);
        p.put("cohort_note", norms.percentilesSuppressed ? "cohort forming" : "");

        // Static copy (content sheet 1)
        for (String k : List.of("cover_title", "cover_caption", "cover_footer", "p2_title", "p2_intro", "factors_heading",
                "mentor_capture", "p3_title", "axis_caption", "families_heading", "values_heading", "values_intro",
                "p4_title", "p4_heading", "ranking_caption", "divider_label", "counsellor_callout", "habits_heading",
                "checks_label", "p5_title", "p5_intro", "p5_heading", "p5_intro_2", "qr_block", "method_note", "agenda_line")) {
            p.put(k, content.text(k));
        }
        p.put("how_to_read", NavigatorProContent.fill(content.text("how_to_read"), Map.of("first", first)));
        p.put("cta_text", content.text("counsellor_callout"));
        p.put("ring_drive", content.text("ring_will"));
        p.put("ring_foundation", content.text("ring_foundation"));
        p.put("ring_skill", content.text("ring_skill"));
        p.put("ring_reasoning", content.text("ring_logic"));

        // Will (internal: drive) and factors — percentiles pick bands but are never printed.
        putIndex(p, "drive", s.get("drive"), norms);
        p.put("will", p.get("drive"));
        p.put("will_band", p.get("drive_band"));
        p.put("dash_drive", dash(s.get("drive")));
        p.put("col_drive", bandColour((String) p.get("drive_band")));
        for (String k : NavigatorProConstructMap.FACTOR_KEYS) {
            String suffix = k.substring(2);
            putIndex(p, k, s.get(k), norms);
            p.put("label_" + k, map.label(k));
            p.put("def_" + suffix, content.factorLine(k));
            p.put(k + "_line", content.factorLine(k) + ": raw " + r(s.get(k)) + "/100");
            p.put("p_" + suffix, "");
            p.put("p_" + suffix + "_text", "");
            p.put("w_p_" + suffix, r(s.get(k)));
        }

        // Foundation Skill and sub-skills (raw RAG)
        putIndex(p, "foundation", s.get("foundation"), norms);
        p.put("dash_foundation", dash(s.get("foundation")));
        p.put("col_foundation", bandColour((String) p.get("foundation_band")));
        List<String> subs = new ArrayList<>(NavigatorProConstructMap.SUB_KEYS);
        for (String k : subs) {
            double v = s.get(k);
            p.put(k, r(v));
            p.put(k + "_label", map.label(k));
            p.put(k + "_band", NavigatorProNorms.ragBand(v));
            p.put(k + "_rag", NavigatorProNorms.ragColour(v));
            p.put("w_" + k, r(v));
            p.put("col_" + k, ragHex(NavigatorProNorms.ragColour(v)));
        }
        subs.sort(Comparator.comparingDouble(s::get));   // stable: ND, DI, TP, CI, GD order on ties
        String low1 = subs.get(0), low2 = subs.get(1);
        p.put("lowest_bar", map.label(low1));
        p.put("low1", map.label(low1));
        p.put("low1v", r(s.get(low1)));
        p.put("low2", map.label(low2));
        p.put("low2v", r(s.get(low2)));
        p.put("habit_plan", NavigatorProContent.fill(content.template("habit_plan"), Map.of(
                "low1", map.label(low1), "low1v", String.valueOf(r(s.get(low1))),
                "low2", map.label(low2), "low2v", String.valueOf(r(s.get(low2))))));

        // Everyday logic (internal: reasoning) — shown as n/5 with a band word, never a percentile.
        p.put("reasoning", s.reasoning);
        p.put("reasoning_display", s.reasoning + "/5");
        p.put("reasoning_band", band("reasoning", s.reasoning, norms));
        p.put("dash_reasoning", dash(s.reasoning * 20.0));
        p.put("col_reasoning", bandColour((String) p.get("reasoning_band")));
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            boolean ok = Boolean.TRUE.equals(s.checks.get(k));
            p.put(k, ok);
            p.put(k + "_mark", ok ? "✔" : "✘");
            p.put(k + "_label", map.label(k));
            p.put("col_" + k, ok ? RAG_GREEN : COL_RED);
        }

        // Acquired Skill (Domain Exposure)
        putIndex(p, "skill", s.get("skill"), norms);
        p.put("skill_p", "");
        p.put("dash_skill", dash(s.get("skill")));
        p.put("col_skill", bandColour((String) p.get("skill_band")));
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) {
            p.put(k, r(s.get(k)));
            p.put(k + "_rag", NavigatorProNorms.ragColour(s.get(k)));
            p.put("w_" + k, r(s.get(k)));
        }

        // Ring and headline font sizes shrink for long values (template renderVals).
        for (String k : List.of("drive", "foundation", "skill", "reasoning_display")) {
            int n = String.valueOf(p.get(k)).length();
            p.put("rfs_" + k, n > 6 ? 9 : n > 4 ? 12 : 20);
            p.put("sfs_" + k, n > 6 ? 14 : 30);
        }

        // Personality families and shape
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) {
            String label = map.label(k);
            String fb = NavigatorProNorms.familyBand(s.get(k));
            List<String> bullets = content.familyBullets(label, fb);
            p.put(k, r(s.get(k)));
            p.put(k + "_label", label);
            p.put(k + "_band", fb);
            p.put(k + "_bullet_1", bullets.size() > 0 ? bullets.get(0) : "");
            p.put(k + "_bullet_2", bullets.size() > 1 ? bullets.get(1) : "");
            p.put("w_" + k, r(s.get(k)));
            p.put("col_" + k, r(s.get(k)) >= 67 ? COL_AMBER : "#a9b8d6");
        }
        radar(p, s, "cr", 240, 170, 130, 0.3);   // cover constellation
        radar(p, s, "p3", 150, 120, 90, 0);      // page-3 hexagon
        p.put("top_family", map.label(s.topFamily));
        p.put("second_family", map.label(s.secondFamily));
        p.put("profile_shape", s.flat ? "Tied" : "Clear leader");
        p.put("shape_line", s.flat ? content.template("shape_tied")
                : NavigatorProContent.fill(content.template("shape_clear"), Map.of("family1", map.label(s.topFamily))));
        p.put("cover_mark", hexagon(s));

        // Zone (Will × Acquired Skill)
        String zone = NavigatorProNorms.zone(s.get("drive"), s.get("skill"), norms.driveCut, norms.skillCut);
        NavigatorProContent.Zone z = content.zone(zone).orElseThrow(() -> new IllegalStateException("no zone copy for " + zone));
        p.put("zone", zone);
        p.put("zone_copy", z.paragraph);
        p.put("zone_means", z.means);
        p.put("zone_first", z.first);
        p.put("zone_do", z.todo);
        p.put("zone_note", "What your position means: will " + r(s.get("drive")) + ", skill " + r(s.get("skill")) + " — "
                + z.means + ". Which moves first: " + z.first + ". What to do: " + z.todo + ".");
        p.put("drive_median", r(norms.driveCut));
        p.put("skill_median", r(norms.skillCut));
        // Quadrant plot: x 0–318 (Acquired Skill), y 16–228 (Will, top = 100); cut-lines at the medians.
        p.put("qx", fixed1(quadX(r(norms.skillCut))));
        p.put("qy", fixed1(quadY(r(norms.driveCut))));
        p.put("face_dx", fixed1(Math.max(16, Math.min(302, quadX(r(s.get("skill")))))));
        p.put("face_dy", fixed1(Math.max(44, Math.min(214, quadY(r(s.get("drive")))))));
        p.put("quad_caption", "Acquired skill → (↑ Will). " + (norms.provisional
                ? "Lines at provisional batch cut-lines until cohort medians land." : "Lines at batch medians."));

        // Values (join on value tag)
        for (int i = 1; i <= 4; i++) {
            String tag = s.values.size() >= i ? s.values.get(i - 1) : null;
            Optional<NavigatorProContent.ValueRow> v = content.value(tag);
            p.put("value_" + i, v.map(x -> x.option).orElse(""));
            p.put("value_" + i + "_tag", v.map(x -> x.tag).orElse(""));
            p.put("value_" + i + "_icon", v.map(x -> x.icon).orElse(""));
            p.put("value_" + i + "_why", v.map(x -> x.why).orElse(""));
        }

        // Direction: all twelve ranked, tie, Explorer, pathways
        boolean explorer = ev.explorer();
        p.put("explorer", explorer);
        for (int i = 1; i <= 12; i++) {
            String d = b.ranking.get(i - 1);
            p.put("rank_" + i, map.label(d));
            p.put("rank_" + i + "_score", r(b.careerScore.get(d)));
            if (i >= 4) {   // ranks 4–12 print even for Explorer; top1–3 are set below
                p.put("top" + i, map.label(d));
                p.put("top" + i + "_score", r(b.careerScore.get(d)));
                p.put("w_top" + i, Math.max(0, Math.min(100, r(b.careerScore.get(d)))));
            }
        }
        StringBuilder rows = new StringBuilder();
        for (int i = 4; i <= 12; i++) {
            rows.append("<div class=\"np-rank-row\"><span class=\"np-rank\">").append(i).append("</span> <span class=\"np-rank-domain\">")
                .append(escape(map.label(b.ranking.get(i - 1)))).append("</span> <span class=\"np-rank-score\">")
                .append(r(b.careerScore.get(b.ranking.get(i - 1)))).append("</span></div>");
        }
        p.put("other_nine_rows", rows.toString());
        String lean = explorer ? "" : map.label(b.ranking.get(0));
        p.put("lean", lean);
        for (int i = 1; i <= 3; i++) {
            String d = b.ranking.get(i - 1);
            p.put("top" + i, explorer ? "" : map.label(d));
            p.put("top" + i + "_score", explorer ? "" : r(b.careerScore.get(d)));
            List<NavigatorProContent.Pathway> paths = content.pathways(map.label(d));
            for (int j = 1; j <= 2; j++) {
                NavigatorProContent.Pathway pw = !explorer && paths.size() >= j ? paths.get(j - 1) : null;
                p.put("top" + i + "_path_" + j, pw == null ? "" : pw.pathway);
                p.put("top" + i + "_path_" + j + "_type", pw == null ? "" : pw.type);
            }
            p.put("rank_copy_" + i, "");
        }
        p.put("top_strip", explorer ? "" : NavigatorProContent.fill(content.text("top_strip"),
                Map.of("top1", map.label(b.ranking.get(0)), "top2", map.label(b.ranking.get(1)), "top3", map.label(b.ranking.get(2)))));
        p.put("gap12", r(b.gap12));
        p.put("tie", !explorer && b.tie);
        p.put("tie_line", !explorer && b.tie
                ? NavigatorProContent.fill(content.template("tie"), Map.of("gap", String.valueOf(r(b.gap12)))) : "");

        // Explorer branch: aspiration picks drive the suggestions (Report Logic v3, gates sheet).
        for (int i = 1; i <= 3; i++) {
            String d = s.aspirations.size() >= i ? s.aspirations.get(i - 1) : null;
            p.put("aspiration_" + i, d == null ? "" : map.label(d));
            List<NavigatorProContent.Pathway> paths = d == null || !explorer ? List.of() : content.pathways(map.label(d));
            for (int j = 1; j <= 2; j++) {
                NavigatorProContent.Pathway pw = paths.size() >= j ? paths.get(j - 1) : null;
                p.put("explorer_" + i + "_path_" + j, pw == null ? "" : pw.pathway);
                p.put("explorer_" + i + "_path_" + j + "_type", pw == null ? "" : pw.type);
            }
        }

        // Emerging-sector recipes: engine capability, asterisked (no v3 display copy).
        List<Map.Entry<String, Double>> sectors = new ArrayList<>(b.sectors.entrySet());
        sectors.sort(Map.Entry.<String, Double>comparingByValue().reversed());
        for (int i = 1; i <= 3; i++) {
            p.put("sector_" + i, sectors.size() >= i ? sectors.get(i - 1).getKey() : "");
            p.put("sector_" + i + "_fit", sectors.size() >= i ? r(sectors.get(i - 1).getValue()) : "");
        }

        // What next: Track A / Track B
        p.put("track", ev.trackA ? "A" : "B");
        String topLabel = map.label(b.ranking.get(0));
        if (!ev.trackA && !explorer) {
            p.put("project_heading", content.template("project_heading"));
            p.put("project", content.project(topLabel, NavigatorProContent.flavourFor(s.topFamily)));
            p.put("project_card", NavigatorProContent.fill(content.template("project_card"), Map.of("lean", topLabel)));
            p.put("internships", String.join(" · ", content.internships(topLabel)));
            p.put("internship_card", content.template("internship_card"));
        } else {
            for (String k : List.of("project_heading", "project", "project_card", "internships", "internship_card")) p.put(k, "");
        }
        String doorsFamily = ev.trackA ? widerDoorsFamily(s) : null;
        List<String> doors = doorsFamily == null ? List.of() : content.widerDoors(map.label(doorsFamily));
        p.put("track_a_families", ev.trackA ? map.label(s.topFamily) + " + " + map.label(s.secondFamily) : "");
        for (int i = 1; i <= 3; i++) p.put("wider_door_" + i, doors.size() >= i ? doors.get(i - 1) : "");
        p.put("wider_doors_note", doorsFamily == null ? "" : content.widerDoorsNote(map.label(doorsFamily)));
        p.put("track_a_closing", ev.trackA ? content.template("track_a_closing") : "");

        // One-line close
        if (explorer) {
            p.put("one_line", "");
            p.put("one_line_full", "");
        } else {
            String full = NavigatorProContent.fill(content.template("one_line").replace("{zone, lowercase}", "{zone_lc}"),
                    Map.of("first", first, "zone_lc", zone.toLowerCase(Locale.ENGLISH), "lean", lean));
            p.put("one_line_full", full);
            String prefix = first + " in one line: ";
            p.put("one_line", full.startsWith(prefix) ? full.substring(prefix.length()) : full);
        }

        // Response quality (the flag count itself never enters the map)
        p.put("response_quality_banner", ev.banner ? content.template("banner") : "");
        p.put("counselling_mandatory", ev.banner || explorer);
        if (s.validityFlags > 0) {
            logger.info("Navigator Pro validity flags={} student={} assessment={}", s.validityFlags, userStudentId, assessmentId);
        }

        // Keys the V3 HTML still binds but the v3 content has no copy for: emitted empty, never invented.
        for (String k : List.of("prec", "precision_line", "factor_callout", "lowest_bar_step", "sector_caveat",
                "move_1", "move_2", "move_3", "tier_line", "about_career9", "about_report", "drive_text",
                "f_id_text", "f_st_text", "f_ae_text", "foundation_text", "reasoning_text", "skill_text",
                "counselling_otp")) {
            p.put(k, "");
        }
        return p;
    }

    // Template palette (Navigator_pro_report_page renderVals).
    private static final String COL_GREEN = "#1f7a34", COL_AMBER = "#e8a33d", COL_RED = "#c0392b", COL_NEUTRAL = "#8a97ab";
    private static final String RAG_GREEN = "#2e7d32";
    /** Hexagon axis order in both radars: Hands-on at the top, then clockwise. */
    private static final List<String> RADAR_FAMILIES = List.of("fam_r", "fam_i", "fam_a", "fam_e", "fam_c", "fam_s");
    /** Demographic fields that carry the stream, in preference order ("Stream/ Major", then "current specialization"). */
    private static final List<String> STREAM_FIELDS = List.of("specilization_pro", "stream");

    /** Band word → pill/ring colour; an empty band (cohort forming) is neutral grey. */
    static String bandColour(String band) {
        String b = band == null ? "" : band.toLowerCase(Locale.ENGLISH);
        if (b.contains("strong")) return COL_GREEN;
        if (b.contains("develop")) return COL_AMBER;
        if (b.contains("early")) return COL_RED;
        return COL_NEUTRAL;
    }

    static String ragHex(String rag) {
        switch (rag) {
            case "green": return RAG_GREEN;
            case "amber": return COL_AMBER;
            case "red":   return COL_RED;
            default:      return COL_NEUTRAL;
        }
    }

    /**
     * Six-point family radar: {prefix}_x0..5, {prefix}_y0..5 and {prefix}_poly. Each point sits at
     * {@code rMax × (base + (1 − base) × score/100)} from the centre, so {@code base} keeps a zero off the hub.
     */
    private static void radar(Map<String, Object> p, NavigatorProScores s, String prefix, double cx, double cy,
                              double rMax, double base) {
        StringBuilder poly = new StringBuilder();
        for (int i = 0; i < RADAR_FAMILIES.size(); i++) {
            double v = Math.max(0, Math.min(100, r(s.get(RADAR_FAMILIES.get(i)))));
            double rad = rMax * (base + (1 - base) * v / 100.0);
            double t = Math.toRadians(-90 + 60 * i);
            String x = number1(cx + rad * Math.cos(t)), y = number1(cy + rad * Math.sin(t));
            p.put(prefix + "_x" + i, x);
            p.put(prefix + "_y" + i, y);
            if (poly.length() > 0) poly.append(' ');
            poly.append(x).append(',').append(y);
        }
        p.put(prefix + "_poly", poly.toString());
    }

    private static double quadX(double skill) {
        return 318 * Math.max(0, Math.min(100, skill)) / 100.0;
    }

    private static double quadY(double will) {
        return 16 + 212 * (1 - Math.max(0, Math.min(100, will)) / 100.0);
    }

    /** One decimal, always shown (JS toFixed(1)). */
    static String fixed1(double v) {
        return String.format(Locale.ROOT, "%.1f", v);
    }

    /** One decimal, trailing ".0" dropped (JS +x.toFixed(1)). */
    static String number1(double v) {
        String s = fixed1(v);
        if (s.equals("-0.0")) return "0";
        return s.endsWith(".0") ? s.substring(0, s.length() - 2) : s;
    }

    /** The student's stream/major from demographics: this assessment's answer first, else their latest one. */
    private String stream(Long userStudentId, Long assessmentId) {
        List<StudentDemographicResponse> rows;
        try {
            rows = demographicResponseRepository.findByUserStudentId(userStudentId);
        } catch (Exception e) {
            logger.warn("stream lookup failed for student {}: {}", userStudentId, e.getMessage());
            return "";
        }
        if (rows == null) return "";
        for (String field : STREAM_FIELDS) {
            StudentDemographicResponse best = null;
            String bestValue = null;
            for (StudentDemographicResponse row : rows) {
                DemographicFieldDefinition def = row.getFieldDefinition();
                if (def == null || !field.equals(def.getFieldName())) continue;
                String v = demographicDisplay(def, row.getResponseValue());
                if (v.isEmpty()) continue;
                if (assessmentId.equals(row.getAssessmentId())) return v;
                if (best == null || (row.getSubmittedAt() != null
                        && (best.getSubmittedAt() == null || row.getSubmittedAt().after(best.getSubmittedAt())))) {
                    best = row;
                    bestValue = v;
                }
            }
            if (bestValue != null) return bestValue;
        }
        return "";
    }

    /** SELECT answers are stored as option values; print the option label instead. */
    private static String demographicDisplay(DemographicFieldDefinition def, String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty() || def.getOptions() == null) return v;
        for (DemographicFieldOption o : def.getOptions()) {
            if (v.equals(o.getOptionValue()) && o.getOptionLabel() != null) return o.getOptionLabel().trim();
        }
        return v;
    }

    /** Raw 0–100 value, plus the percentile band (internal percentile, never printed). */
    private void putIndex(Map<String, Object> p, String key, double raw, NormSet norms) {
        p.put(key, r(raw));
        p.put(key + "_band", band(key, raw, norms));
    }

    private static String band(String key, double raw, NormSet norms) {
        Double pk = norms.percentile(key, raw);
        return pk == null ? "" : NavigatorProNorms.band(pk);
    }

    /** Wider Doors row: the student's highest family that has one (Hands-on/Analytical have none). */
    private String widerDoorsFamily(NavigatorProScores s) {
        List<String> ranked = new ArrayList<>(NavigatorProConstructMap.FAMILY_KEYS);
        ranked.sort(Comparator.comparingDouble((String k) -> s.get(k)).reversed());
        for (String k : ranked) if (content.hasWiderDoors(map.label(k))) return k;
        return null;
    }

    /** stroke-dasharray for the page-2 ring (r = 36). */
    static String dash(double value) {
        double v = Math.max(0, Math.min(100, value));
        return String.format(Locale.ROOT, "%.1f %.1f", RING_C * v / 100.0, RING_C);
    }

    /** Cover hexagon constellation drawn from the six family scores (no numbers). */
    String hexagon(NavigatorProScores s) {
        double cx = 319, cy = 165, rad = 150;
        StringBuilder grid = new StringBuilder(), pts = new StringBuilder(), dots = new StringBuilder();
        List<String> fams = NavigatorProConstructMap.FAMILY_KEYS;
        for (int i = 0; i < 6; i++) {
            double a = Math.toRadians(-90 + 60 * i);
            double ex = cx + rad * Math.cos(a), ey = cy + rad * Math.sin(a);
            grid.append(String.format(Locale.ROOT, "%.1f,%.1f ", ex, ey));
            double f = Math.max(0.06, s.get(fams.get(i)) / 100.0);
            double px = cx + rad * f * Math.cos(a), py = cy + rad * f * Math.sin(a);
            pts.append(String.format(Locale.ROOT, "%.1f,%.1f ", px, py));
            dots.append(String.format(Locale.ROOT, "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"5\" fill=\"#eda93e\"/>", px, py));
        }
        return "<svg viewBox=\"0 0 638 330\" style=\"width:100%;height:100%\" xmlns=\"http://www.w3.org/2000/svg\">"
                + "<polygon points=\"" + grid.toString().trim() + "\" fill=\"none\" stroke=\"#6f86ad\" stroke-width=\"1\"/>"
                + "<polygon points=\"" + pts.toString().trim() + "\" fill=\"rgba(237,169,62,0.18)\" stroke=\"#eda93e\" stroke-width=\"2\"/>"
                + dots + "</svg>";
    }

    private static String escape(String t) {
        return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String t) {
        return escape(t).replace("\"", "&quot;");
    }

    /** Tech Spec v3 §3: trim and Title-Case names. */
    static String titleCase(String name) {
        StringBuilder sb = new StringBuilder();
        for (String w : name.split("\\s+")) {
            if (w.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase(Locale.ENGLISH));
        }
        return sb.toString();
    }

    private static String studentId(StudentInfo si, Long userStudentId) {
        if (si != null) {
            if (si.getSchoolRollNumber() != null && !si.getSchoolRollNumber().trim().isEmpty()) return si.getSchoolRollNumber().trim();
            if (si.getCareerNineRollNumber() != null && !si.getCareerNineRollNumber().trim().isEmpty()) return si.getCareerNineRollNumber().trim();
        }
        return String.valueOf(userStudentId);
    }

    /** 1 + the student's earlier completed assessments whose default template runs this engine. */
    private int readingNo(Long userStudentId, Long assessmentId, Date completedAt) {
        int earlier = 0;
        try {
            for (StudentAssessmentMapping m : mappingRepository.findByUserStudentUserStudentId(userStudentId)) {
                if (m.getAssessmentId() == null || m.getAssessmentId().equals(assessmentId)) continue;
                if (!"completed".equalsIgnoreCase(m.getStatus())) continue;
                if (completedAt != null && m.getCompletedAt() != null && !m.getCompletedAt().before(completedAt)) continue;
                boolean navPro = assessmentReportTemplateRepository.findByAssessmentIdAndIsDefaultTrue(m.getAssessmentId())
                        .map(AssessmentReportTemplate::getReportTemplate)
                        .map(t -> typeCode().equalsIgnoreCase(t.getEngineCode()))
                        .orElse(false);
                if (navPro) earlier++;
            }
        } catch (Exception e) {
            logger.warn("reading_no fell back to 1 for student {}: {}", userStudentId, e.getMessage());
        }
        return 1 + earlier;
    }

    static int r(double v) {
        return (int) Math.round(v);
    }

    // accessors for the raw export
    public NavigatorProConstructMap constructMap() { return map; }
    public NavigatorProBlend blendConfig()         { return blend; }

    /** The thresholds in force, for the raw export's settings sheet. */
    public Map<String, Object> thresholds() {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("flat-gap", flatGap);
        t.put("weak-peak (R3)", weakPeak);
        t.put("no-signal-exposure (R4)", noSignalExposure);
        t.put("banner-flag-count (R2)", bannerFlagCount);
        t.put("norms-min-n", normsMinN);
        t.put("percentile-min-n", percentileMinN);
        t.put("tie-gap", tieGap);
        t.put("explorer-spread (R6)", explorerSpread);
        t.put("explorer-max-exposure (R6)", explorerMaxExposure);
        t.put("track-a-cut", trackACut);
        return t;
    }
}
