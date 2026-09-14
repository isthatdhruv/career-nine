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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
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
 * Navigator Pro engine (engineCode {@code navigator_pro}). Scores from the stored
 * MQT option scores (reversal already applied there), applies gates R1–R5,
 * computes cohort norms per assessment and emits the placeholder map. Runs on the
 * report-worker thread with no open session: every query here fetches eagerly.
 */
@Component
public class NavigatorProCalculationService implements PlaceholderCalculator {

    private static final Logger logger = LoggerFactory.getLogger(NavigatorProCalculationService.class);
    static final long NORMS_TTL_MS = 60_000L;

    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Autowired private NavigatorProConstructMap map;

    @Value("${app.navigator-pro.career-library-url:}") private String careerLibraryUrl;
    @Value("${app.navigator-pro.flat-gap:10}")          private double flatGap;
    @Value("${app.navigator-pro.weak-peak:50}")         private double weakPeak;
    @Value("${app.navigator-pro.no-signal-domain:50}")  private double noSignalDomain;
    @Value("${app.navigator-pro.banner-flag-count:2}")  private int bannerFlagCount;
    @Value("${app.navigator-pro.norms-min-n:60}")       private int normsMinN;
    @Value("${app.navigator-pro.percentile-min-n:30}")  private int percentileMinN;

    private final Map<Long, NavigatorProQuestionnaireIndex> indexCache = new ConcurrentHashMap<>();
    private final Map<Long, CachedNorms> normsCache = new ConcurrentHashMap<>();

    private static final class CachedNorms {
        final int completedCount; final long at; final NormSet norms;
        CachedNorms(int completedCount, long at, NormSet norms) { this.completedCount = completedCount; this.at = at; this.norms = norms; }
    }

    private static final List<String> RESERVED_TEXT_KEYS = List.of(
            "top1", "top2", "top3", "top1_score", "top2_score", "top3_score", "gap12",
            "sector_1", "sector_2", "sector_3", "sector_1_fit", "sector_2_fit", "sector_3_fit",
            "tier_line", "rank_copy_1", "rank_copy_2", "rank_copy_3", "cta_variant", "cta_text",
            "one_line", "move_1", "move_2", "move_3");

    @Override public String typeCode()        { return "navigator_pro"; }
    @Override public String engineVersion()   { return EngineVersions.NAVIGATOR_PRO_V1; }
    @Override public boolean usesIntermediary() { return false; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId, IntermediaryScoresPayload intermediary) {
        NavigatorProQuestionnaireIndex index = indexFor(assessmentId);
        NavigatorProScorer scorer = new NavigatorProScorer(map, flatGap);

        List<AssessmentAnswer> answers = answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);
        NavigatorProScores s = scorer.score(contributions(index, answers), valueRanks(index, answers), index.questionsByConstruct);

        String[] gate = gate(s);
        if (gate != null) {
            if (!s.incomplete.isEmpty()) {
                logger.info("Navigator Pro incomplete student={} assessment={}: {}", userStudentId, assessmentId, s.incomplete);
            }
            throw new ReportSuppressedException(gate[0], gate[1]);
        }

        NormSet norms = normsFor(assessmentId, index, scorer);
        return placeholders(userStudentId, assessmentId, s, norms);
    }

    // ── schema check ─────────────────────────────────────────────────────────

    NavigatorProQuestionnaireIndex indexFor(Long assessmentId) {
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
        if (!ix.valid()) {
            throw new ReportRoutingException("Questionnaire " + questionnaireId + " is not on the Navigator Pro bank: "
                    + String.join("; ", ix.problems));
        }
        indexCache.put(assessmentId, ix);
        return ix;
    }

    // ── answers → scorer input ───────────────────────────────────────────────

    List<Contribution> contributions(NavigatorProQuestionnaireIndex index, List<AssessmentAnswer> answers) {
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
            out.add(new ValueRank(a.getRankOrder(), option.getOptionText()));
        }
        return out;
    }

    // ── gates ────────────────────────────────────────────────────────────────

    /** {code, reason} for the first tripped suppressing gate, else null. R2 never suppresses. */
    String[] gate(NavigatorProScores s) {
        if (!s.attentionPassed) return new String[]{"R1", "attention check not passed"};
        if (!s.incomplete.isEmpty()) return new String[]{"R5", s.incomplete.size() + " scored question(s) unanswered or duplicated"};
        if (!s.flat && s.maxFamily() < weakPeak) return new String[]{"R3", "peak interest family below " + (int) weakPeak};
        if (s.flat && s.maxDomain() < noSignalDomain && s.valuesMissing) return new String[]{"R4", "flat interests, no domain rating at or above " + (int) noSignalDomain + ", values missing"};
        return null;
    }

    // ── cohort norms ─────────────────────────────────────────────────────────

    NormSet normsFor(Long assessmentId, NavigatorProQuestionnaireIndex index, NavigatorProScorer scorer) {
        List<StudentAssessmentMapping> completed = mappingRepository.findCompletedForAssessment(assessmentId);
        CachedNorms cached = normsCache.get(assessmentId);
        long now = System.currentTimeMillis();
        if (cached != null && cached.completedCount == completed.size() && now - cached.at < NORMS_TTL_MS) {
            return cached.norms;
        }
        Set<Long> completedIds = new HashSet<>();
        for (StudentAssessmentMapping m : completed) {
            if (m.getUserStudent() != null && m.getUserStudent().getUserStudentId() != null) completedIds.add(m.getUserStudent().getUserStudentId());
        }
        Map<Long, List<AssessmentAnswer>> byStudent = new HashMap<>();
        for (AssessmentAnswer a : answerRepository.findAllByAssessmentIdWithScores(assessmentId)) {
            if (a.getUserStudent() == null || a.getUserStudent().getUserStudentId() == null) continue;
            byStudent.computeIfAbsent(a.getUserStudent().getUserStudentId(), k -> new ArrayList<>()).add(a);
        }
        List<NavigatorProNorms.Member> members = new ArrayList<>();
        for (Long sid : completedIds) {
            List<AssessmentAnswer> rows = byStudent.getOrDefault(sid, List.of());
            NavigatorProScores s = scorer.score(contributions(index, rows), valueRanks(index, rows), index.questionsByConstruct);
            if (gate(s) != null) continue;
            Map<String, Double> metrics = new HashMap<>();
            for (String metric : NavigatorProNorms.METRICS) {
                metrics.put(metric, metric.equals("reasoning") ? (double) s.reasoning : s.get(metric));
            }
            members.add(new NavigatorProNorms.Member(sid, metrics));
        }
        NormSet norms = NavigatorProNorms.build(members, percentileMinN, normsMinN);
        normsCache.put(assessmentId, new CachedNorms(completed.size(), now, norms));
        return norms;
    }

    // ── placeholders ─────────────────────────────────────────────────────────

    Map<String, Object> placeholders(Long userStudentId, Long assessmentId, NavigatorProScores s, NormSet norms) {
        Map<String, Object> p = new LinkedHashMap<>();

        // Identity and batch
        UserStudent us = userStudentRepository.findByIdWithStudentInfo(userStudentId).orElse(null);
        StudentInfo si = us != null ? us.getStudentInfo() : null;
        String name = si != null && si.getName() != null ? si.getName().trim() : "";
        p.put("student_name", name);
        p.put("first_name", name.isEmpty() ? "" : name.split("\\s+")[0]);
        p.put("student_id", studentId(si, userStudentId));
        p.put("college", us != null && us.getInstitute() != null && us.getInstitute().getInstituteName() != null
                ? us.getInstitute().getInstituteName() : "");
        StudentAssessmentMapping mapping = mappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId).orElse(null);
        Date completedAt = mapping != null ? mapping.getCompletedAt() : null;
        p.put("reading_no", readingNo(userStudentId, assessmentId, completedAt));
        p.put("reading_date", completedAt == null ? "" : new SimpleDateFormat("d MMM yyyy", Locale.ENGLISH).format(completedAt));
        p.put("batch_n", norms.n);
        p.put("prec", norms.prec);
        p.put("career_library_url", careerLibraryUrl == null ? "" : careerLibraryUrl);

        // Drive and factors
        boolean pct = !norms.percentilesSuppressed;
        p.put("drive", r(s.get("drive")));
        putIndexBand(p, "drive", s.get("drive"), norms);
        Map<String, Double> factorP = new LinkedHashMap<>();
        for (String k : NavigatorProConstructMap.FACTOR_KEYS) {
            p.put(k, r(s.get(k)));
            Double pk = norms.percentile(k, s.get(k));
            factorP.put(k, pk);
            p.put("p_" + k.substring(2), pk == null ? "" : r(pk));
            p.put("p_" + k.substring(2) + "_text", pk == null ? "" : "P" + r(pk));
            putIndexBand(p, k, s.get(k), norms);
            p.put("def_" + k.substring(2), NavigatorProContent.factorDefinition(k));
        }
        List<String> order = new ArrayList<>(NavigatorProConstructMap.FACTOR_KEYS);
        Comparator<String> byValue = pct
                ? Comparator.comparingDouble((String k) -> factorP.get(k)).thenComparingDouble(s::get)
                : Comparator.comparingDouble(s::get);
        order.sort(byValue.reversed());
        String top = order.get(0), bottom = order.get(order.size() - 1);
        p.put("top_factor", map.label(top));
        p.put("bottom_factor", map.label(bottom));
        p.put("top_factor_p", pct ? r(factorP.get(top)) : "");
        p.put("bottom_factor_p", pct ? r(factorP.get(bottom)) : "");
        p.put("factor_callout", pct
                ? NavigatorProContent.factorCallout(map.label(top), r(factorP.get(top)), map.label(bottom), r(factorP.get(bottom)), norms.prec)
                : "");

        // Foundation
        p.put("foundation", r(s.get("foundation")));
        putIndexBand(p, "foundation", s.get("foundation"), norms);
        String lowest = null;
        for (String k : NavigatorProConstructMap.SUB_KEYS) {
            double v = s.get(k);
            p.put(k, r(v));
            p.put(k + "_band", NavigatorProNorms.ragBand(v));
            p.put(k + "_rag", NavigatorProNorms.ragColour(v));
            if (lowest == null || v < s.get(lowest)) lowest = k;
        }
        p.put("lowest_bar", map.label(lowest));
        p.put("lowest_bar_step", NavigatorProContent.firstStep(lowest));

        // Reasoning
        p.put("reasoning", s.reasoning);
        p.put("reasoning_display", s.reasoning + "/5");
        putIndexBand(p, "reasoning", s.reasoning, norms);
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            boolean ok = Boolean.TRUE.equals(s.checks.get(k));
            p.put(k, ok);
            p.put(k + "_mark", ok ? "✔" : "✘");
        }

        // Skill and domains
        p.put("skill", r(s.get("skill")));
        Double skillP = norms.percentile("skill", s.get("skill"));
        p.put("skill_p", skillP == null ? "" : r(skillP));
        putIndexBand(p, "skill", s.get("skill"), norms);
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) p.put(k, r(s.get(k)));

        // Interests
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) p.put(k, r(s.get(k)));
        p.put("top_family", map.label(s.topFamily));
        p.put("second_family", map.label(s.secondFamily));
        p.put("profile_shape", s.flat ? "Flat" : "Differentiated");

        // Zone
        String zone = NavigatorProNorms.zone(s.get("drive"), s.get("skill"), norms.driveCut, norms.skillCut);
        p.put("zone", zone);
        p.put("zone_copy", NavigatorProContent.zoneCopy(zone));
        String cut = norms.provisional ? "provisional cut" : "batch median";
        p.put("zone_note", "Drive " + r(s.get("drive")) + " (" + (s.get("drive") >= norms.driveCut ? "above" : "below") + " the " + cut + ") — skill "
                + r(s.get("skill")) + " (" + (s.get("skill") >= norms.skillCut ? "above" : "below") + " " + cut + ").");
        p.put("drive_median", r(norms.driveCut));
        p.put("skill_median", r(norms.skillCut));
        p.put("norms_provisional", norms.provisional);
        p.put("percentiles_suppressed", norms.percentilesSuppressed);

        // Values
        for (int i = 1; i <= 4; i++) {
            Optional<NavigatorProContent.ValueRow> v = (!s.valuesMissing && s.values.size() >= i)
                    ? NavigatorProContent.value(s.values.get(i - 1)) : Optional.empty();
            p.put("value_" + i, v.map(x -> x.title).orElse(""));
            p.put("value_" + i + "_icon", v.map(x -> x.icon).orElse(""));
            p.put("value_" + i + "_why", v.map(x -> x.why).orElse(""));
        }

        // Response quality (the flag count itself never enters the map)
        boolean banner = s.validityFlags >= bannerFlagCount;
        p.put("response_quality_banner", banner ? NavigatorProContent.banner() : "");
        p.put("counselling_mandatory", banner);
        if (s.validityFlags > 0) {
            logger.info("Navigator Pro validity flags={} student={} assessment={}", s.validityFlags, userStudentId, assessmentId);
        }

        // Static copy
        p.put("cover_caption", NavigatorProContent.COVER_CAPTION);
        p.put("cover_footer", String.format(NavigatorProContent.COVER_FOOTER_TEMPLATE, p.get("first_name")));
        p.put("about_career9", NavigatorProContent.ABOUT_CAREER9);
        p.put("about_report", NavigatorProContent.ABOUT_REPORT);
        p.put("how_to_read", NavigatorProContent.howToRead((String) p.get("first_name")));
        p.put("precision_line", NavigatorProContent.precisionLine(norms.prec, norms.n));
        p.put("sector_caveat", NavigatorProContent.SECTOR_CAVEAT);
        p.put("ring_drive", NavigatorProContent.RING_DRIVE);
        p.put("ring_foundation", NavigatorProContent.RING_FOUNDATION);
        p.put("ring_skill", NavigatorProContent.RING_SKILL);
        p.put("ring_reasoning", NavigatorProContent.RING_REASONING);

        // Reserved for phase 2 (blend, sectors, R6)
        p.put("explorer", false);
        p.put("tie", false);
        for (String k : RESERVED_TEXT_KEYS) p.put(k, "");
        return p;
    }

    /** Percentile band + paragraph for an index key; both empty while percentiles are suppressed. */
    private void putIndexBand(Map<String, Object> p, String key, double raw, NormSet norms) {
        Double pk = norms.percentile(key, raw);
        String band = pk == null ? "" : NavigatorProNorms.band(pk);
        p.put(key + "_band", band);
        p.put(key + "_text", band.isEmpty() ? "" : NavigatorProContent.bandParagraph(key, band));
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

    private static int r(double v) {
        return (int) Math.round(v);
    }
}
