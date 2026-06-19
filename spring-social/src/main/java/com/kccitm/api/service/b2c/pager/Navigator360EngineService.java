package com.kccitm.api.service.b2c.pager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.kccitm.api.service.Navigator.NavigatorReportGenerationService.IntermediaryScores;
import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerDefinition;
import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerMatch;
import com.kccitm.api.service.b2c.pager.Navigator360Models.CciResult;
import com.kccitm.api.service.b2c.pager.Navigator360Models.FlagInfo;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ValidityResult;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.PotentialScoreResult;
import com.kccitm.api.service.b2c.pager.Navigator360Models.PreferenceScoreResult;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;

/**
 * Navigator 360 computation engine — ports the TS reference implementation in
 * {@code react-social/.../Navigator360Engine.ts} (Sections 2–9 of the
 * Navigator 360 Technical Spec v1.0).
 *
 * <p>Inputs are the {@link IntermediaryScores} already produced by
 * {@code NavigatorReportGenerationService.computeIntermediaryScores} (raw
 * RIASEC / Aptitude / MI sums + the Section A/B/C string selections). Output
 * is a fully-derived {@link Navigator360Result} consumed by
 * {@link FourPagerEngineService}.
 *
 * <p>Lookup tables / display labels intentionally mirror the TS module so the
 * admin client-side report and the backend pager report stay aligned.
 */
@Service
public class Navigator360EngineService {

    private static final List<RiasecType> RIASEC_KEYS = Arrays.asList(
        RiasecType.R, RiasecType.I, RiasecType.A, RiasecType.S, RiasecType.E, RiasecType.C);

    /** Backend ability name → short label used by the FourPager template. */
    public static final Map<String, String> ABILITY_SHORT;
    /** Backend MI name → spec display name. */
    public static final Map<String, String> MI_DISPLAY;

    static {
        Map<String, String> ab = new LinkedHashMap<>();
        ab.put("Speed and accuracy", "Speed & Accuracy");
        ab.put("Computational", "Computational");
        ab.put("Creativity/Artistic", "Creativity");
        ab.put("Language/Communication", "Language");
        ab.put("Technical", "Technical");
        ab.put("Decision making & problem solving", "Decision Making");
        ab.put("Finger dexterity", "Finger Dexterity");
        ab.put("Form perception", "Form Perception");
        ab.put("Logical reasoning", "Logical Reasoning");
        ab.put("Motor movement", "Motor Movement");
        ABILITY_SHORT = ab;

        Map<String, String> mi = new LinkedHashMap<>();
        mi.put("Bodily-Kinesthetic", "Bodily-Kinesthetic");
        mi.put("Interpersonal", "Interpersonal");
        mi.put("Intrapersonal", "Intrapersonal");
        mi.put("Linguistic", "Linguistic");
        mi.put("Logical-Mathematical", "Logical-Mathematical");
        mi.put("Musical", "Musical");
        mi.put("Visual-Spatial", "Spatial-Visual");
        mi.put("Naturalistic", "Naturalistic");
        MI_DISPLAY = mi;
    }

    // ═══════════════════════ STANINE LOOKUP (Section 4.1) ═══════════════════════

    // Spec §2.3 STANINE bands (Tech Spec v5 / EC-13): RIASEC 9–11 Low, 12–14 Moderate,
    // 15–18 High. fromStanine() maps stanine ≥7→High, ≥3→Moderate, else Low, so these
    // tables place raw 15 at stanine 7 (High) and raw 14 at stanine 6 (Moderate).
    private static int riasecStanine(int raw) {
        if (raw <= 10) return 1;
        if (raw == 11) return 2;
        if (raw == 12) return 3;
        if (raw == 13) return 4;
        if (raw == 14) return 6;   // top of Moderate band (12–14)
        if (raw == 15) return 7;   // bottom of High band (15–18)
        if (raw == 16) return 8;
        return 9; // 17–18
    }

    // Spec §2.3 STANINE bands: Ability/MI 3–6 Low, 7–9 Moderate, 10–12 High.
    private static int abilityMIStanine(int raw) {
        if (raw <= 4) return 1;
        if (raw == 5) return 1;
        if (raw == 6) return 2;    // top of Low band (3–6)
        if (raw == 7) return 3;    // bottom of Moderate band (7–9)
        if (raw == 8) return 4;
        if (raw == 9) return 6;    // top of Moderate band
        if (raw == 10) return 7;   // bottom of High band (10–12)
        if (raw == 11) return 8;
        return 9; // 12
    }

    // ═══════════════════════ NORMALIZATION (Section 3) ═══════════════════════

    private static double normalizeRIASEC(int raw) {
        return Math.round(((raw - 9.0) / 9.0) * 1000.0) / 10.0;
    }

    private static double normalizeAbilityMI(int raw) {
        return Math.round(((raw - 3.0) / 9.0) * 1000.0) / 10.0;
    }

    // ═══════════════════════ SCORE DIMENSIONS ═══════════════════════

    private List<ScoredDimension> scoreRIASEC(Map<String, ? extends Number> scores) {
        List<ScoredDimension> out = new ArrayList<>();
        for (RiasecType key : RIASEC_KEYS) {
            Number n = scores != null ? scores.get(key.name()) : null;
            int raw = n != null ? n.intValue() : 9;
            double normPct = normalizeRIASEC(raw);
            int stanine = riasecStanine(raw);
            out.add(new ScoredDimension(key.name(), raw, normPct, stanine, AbsoluteLevel.fromStanine(stanine)));
        }
        return out;
    }

    private List<ScoredDimension> scoreAbilitiesOrMI(Map<String, ? extends Number> scores) {
        List<ScoredDimension> out = new ArrayList<>();
        if (scores == null) return out;
        for (Map.Entry<String, ? extends Number> e : scores.entrySet()) {
            int raw = e.getValue() != null ? e.getValue().intValue() : 3;
            double normPct = normalizeAbilityMI(raw);
            int stanine = abilityMIStanine(raw);
            out.add(new ScoredDimension(e.getKey(), raw, normPct, stanine, AbsoluteLevel.fromStanine(stanine)));
        }
        return out;
    }

    // Bias detection moved to computeValidity() with spec §2.2.4 item-count thresholds
    // (BIAS-01/02 from RIASEC sums); the old raw-ratio ≥0.83 heuristic was removed.

    // ═══════════════════════ POTENTIAL SCORE (Section 5) ═══════════════════════

    /**
     * Rank-weighted average normPct over the top-N qualified (HIGH+MODERATE) dimensions.
     * Moderate contributions ×0.75 (spec §2.3 step 6 / WT-2); rank weights renormalised
     * to sum 1.0 when fewer than N traits qualify (WT-3). Returns 0–100.
     */
    private static double rankWeightedNorm(List<ScoredDimension> dims, double[] w) {
        List<ScoredDimension> q = dims.stream()
                .filter(d -> d.level != AbsoluteLevel.LOW)
                .sorted(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed())
                .limit(w.length)
                .collect(Collectors.toList());
        if (q.isEmpty()) return 0;
        double wsum = 0;
        for (int i = 0; i < q.size(); i++) wsum += w[i];
        double weighted = 0;
        for (int i = 0; i < q.size(); i++) {
            double ww = w[i] / wsum; // WT-3 renormalise
            double c = q.get(i).normPct * ww;
            if (q.get(i).level == AbsoluteLevel.MODERATE) c *= 0.75;
            weighted += c;
        }
        return weighted;
    }

    /**
     * Non-spec "Potential score" construct retained for the report narrative. The spec
     * weighting constants (WT-1/WT-2/WT-3) live here; the psychometric flags are emitted
     * separately in {@link #collectFlags}.
     */
    private PotentialScoreResult computePotentialScore(List<ScoredDimension> riasec,
                                                       List<ScoredDimension> mi,
                                                       List<ScoredDimension> abilities,
                                                       Integer academicPct,
                                                       double completionPctOverride) {
        PotentialScoreResult result = new PotentialScoreResult();

        // ── Component 1: Personality (max 25) ──
        long hiR = riasec.stream().filter(d -> d.level == AbsoluteLevel.HIGH).count();
        if (riasec.stream().allMatch(d -> d.level == AbsoluteLevel.LOW)) {
            result.personality = 3;
        } else {
            double gateMul = hiR >= 2 ? 1.0 : 0.65; // OPEN / HALF (spec §2.3 step 5)
            double weighted = rankWeightedNorm(riasec, new double[]{0.50, 0.30, 0.20});
            double maxNorm = riasec.stream().mapToDouble(d -> d.normPct).max().orElse(0);
            double minNorm = riasec.stream().mapToDouble(d -> d.normPct).min().orElse(0);
            int clarityBonus = (maxNorm - minNorm) >= 60 ? 3 : (maxNorm - minNorm) >= 40 ? 2 : 0;
            double basePts = (weighted / 100.0) * (25 - clarityBonus);
            result.personality = Math.min(25, (int) Math.round((basePts + clarityBonus) * gateMul));
        }

        // ── Component 2: Intelligence (max 25) ──
        long hiMI = mi.stream().filter(d -> d.level == AbsoluteLevel.HIGH).count();
        if (mi.stream().allMatch(d -> d.level == AbsoluteLevel.LOW)) {
            result.intelligence = 2;
        } else {
            double gateMul = hiMI >= 2 ? 1.0 : 0.65;
            double weighted = rankWeightedNorm(mi, new double[]{0.50, 0.30, 0.20});
            result.intelligence = Math.min(25, (int) Math.round((weighted / 100.0) * 25.0 * gateMul));
        }

        // ── Component 3: Ability (max 30) ──
        long hiAb = abilities.stream().filter(d -> d.level == AbsoluteLevel.HIGH).count();
        if (abilities.stream().allMatch(d -> d.level == AbsoluteLevel.LOW)) {
            result.ability = 3;
        } else {
            double gateMul = hiAb >= 3 ? 1.0 : 0.70;
            double weighted = rankWeightedNorm(abilities, new double[]{0.30, 0.25, 0.20, 0.15, 0.10});
            result.ability = Math.min(30, (int) Math.round((weighted / 100.0) * 30.0 * gateMul));
        }

        // ── Component 4: Academic (max 20) ──
        result.academic = academicPct != null ? (int) Math.round((academicPct / 100.0) * 20.0) : 0;

        int potRaw = result.personality + result.intelligence + result.ability + result.academic;
        double completionPct = Math.max(0, Math.min(1, completionPctOverride));
        result.total = Math.max(0, Math.min(100, (int) Math.round(potRaw * completionPct * 1.05)));
        result.completionPct = completionPct;
        return result;
    }

    // ═══════════════════════ PREFERENCE SCORE (Section 6) ═══════════════════════

    private PreferenceScoreResult computePreferenceScore(List<String> values,
                                                         List<String> aspirations,
                                                         List<String> subjects,
                                                         List<RiasecType> topRiasec,
                                                         double ccNorm) {
        PreferenceScoreResult result = new PreferenceScoreResult();
        int valuesSize = values != null ? values.size() : 0;
        int aspirationsSize = aspirations != null ? aspirations.size() : 0;
        int subjectsSize = subjects != null ? subjects.size() : 0;

        // P1
        result.p1Values = (int) Math.round((Math.min(valuesSize, 5) / 5.0) * 20.0);

        // P2: aspiration clarity × coherence with top RIASEC type
        List<RiasecType> aspRiasec = new ArrayList<>();
        if (aspirations != null) {
            for (String a : aspirations) {
                RiasecType r = Navigator360CareerData.ASPIRATION_RIASEC.get(a);
                if (r != null) aspRiasec.add(r);
            }
        }
        RiasecType topType = topRiasec.isEmpty() ? null : topRiasec.get(0);
        long matchingCount = topType == null
                ? 0
                : aspRiasec.stream().filter(t -> t == topType).count();
        double coherence = aspRiasec.isEmpty() ? 0 : (double) matchingCount / aspRiasec.size();
        result.p2Aspirations = (int) Math.round((Math.min(aspirationsSize, 4) / 4.0) * 20.0 * coherence);

        // P3 — cultural compatibility (default 50%)
        result.p3Culture = (int) Math.round((ccNorm / 100.0) * 30.0);

        // P4 — subject ↔ RIASEC alignment
        List<RiasecType> top3 = topRiasec.size() > 3 ? topRiasec.subList(0, 3) : topRiasec;
        long aligned = 0;
        if (subjects != null) {
            for (String s : subjects) {
                RiasecType r = Navigator360CareerData.SUBJECT_RIASEC.get(s);
                if (r != null && top3.contains(r)) aligned++;
            }
        }
        double alignmentPct = subjectsSize > 0 ? (double) aligned / subjectsSize : 0;
        double underPenalty = subjectsSize < 3 ? 0.80 : 1.0;
        result.p4Subjects = (int) Math.round(alignmentPct * underPenalty * 30.0);

        result.total = result.p1Values + result.p2Aspirations + result.p3Culture + result.p4Subjects;
        return result;
    }

    // ═══════════════════════ CSI CAREER MATCHING (Spec §2.3 step 8–9) ═══════════════════════

    private static final double[] RIASEC_W  = {0.50, 0.30, 0.20};
    private static final double[] ABILITY_W = {0.30, 0.25, 0.20, 0.15, 0.10};
    // CURATED (flagged): the spec does not state MI rank-weights for I_score; we reuse the
    // personality rank-weights over the cluster's (up to) 3 required MI domains.
    private static final double[] MI_W      = {0.50, 0.30, 0.20};

    /** P/A/I sub-score = Σ over the cluster's required traits of (norm × rank-weight). Spec §2.3 step 8. */
    private static int clusterSubScore(List<String> requiredTraits, Map<String, Double> normByName, double[] w) {
        if (requiredTraits == null) return 0;
        double s = 0;
        for (int i = 0; i < requiredTraits.size() && i < w.length; i++) {
            Double n = normByName.get(requiredTraits.get(i));
            if (n != null) s += n * w[i];
        }
        return (int) Math.round(Math.max(0, Math.min(100, s)));
    }

    private static class ValuesMatchResult {
        int score;
        List<String> matched;
        ValuesMatchResult(int score, List<String> matched) {
            this.score = score;
            this.matched = matched;
        }
    }

    private ValuesMatchResult computeValuesMatch(CareerDefinition career, List<String> studentValues) {
        List<String> spec = new ArrayList<>();
        if (studentValues != null) {
            for (String v : studentValues) {
                spec.add(Navigator360CareerData.VALUE_LABEL_TO_SPEC.getOrDefault(v, v));
            }
        }
        List<String> matched = new ArrayList<>();
        if (career.values != null) {
            for (String v : spec) {
                if (career.values.contains(v)) matched.add(v);
            }
        }
        // Spec §2.3 step 8 / §8.2: base = 100 × (matched / 5); penalty = 15 × conflict_count; clamp [0,100].
        double base = (matched.size() / 5.0) * 100.0;

        int conflictCount = 0;
        for (String val : spec) {
            List<String> conflicts = Navigator360CareerData.VALUE_CONFLICTS.get(val);
            if (conflicts == null) continue;
            for (String c : conflicts) {
                if (career.name != null && career.name.contains(c)) {
                    conflictCount++;
                    break;
                }
            }
        }
        double penalty = 15.0 * conflictCount;

        int score = (int) Math.round(Math.max(0, Math.min(100, base - penalty)));
        return new ValuesMatchResult(score, matched);
    }

    private List<CareerMatch> matchCareers(List<ScoredDimension> riasec,
                                            List<ScoredDimension> mi,
                                            List<ScoredDimension> abilities,
                                            List<String> studentValues,
                                            List<String> aspirations,
                                            double completionPct,
                                            Set<String> suppressed) {
        Map<String, Double> riasecNorm = new HashMap<>();
        for (ScoredDimension d : riasec) riasecNorm.put(d.name, d.normPct);
        Map<String, Double> miNorm = new HashMap<>();
        for (ScoredDimension d : mi) miNorm.put(d.name, d.normPct);
        Map<String, Double> abilNorm = new HashMap<>();
        for (ScoredDimension d : abilities) abilNorm.put(d.name, d.normPct);

        Set<String> aspCareerIds = new HashSet<>();
        if (aspirations != null) {
            for (String a : aspirations) {
                String id = Navigator360CareerData.ASPIRATION_TO_CAREER.get(a);
                if (id != null) aspCareerIds.add(id);
            }
        }

        // CSI component weights (spec §2.3 step 8). A bias-suppressed component is dropped
        // and the remaining weights renormalise to sum 1.0 (spec §2.2.4 reweighting).
        Map<String, Double> w = new LinkedHashMap<>();
        w.put("personality", 0.40);
        w.put("ability", 0.30);
        w.put("intelligence", 0.20);
        w.put("values", 0.10);
        if (suppressed != null) for (String s : suppressed) w.remove(s);
        double wsum = w.values().stream().mapToDouble(Double::doubleValue).sum();
        if (wsum <= 0) wsum = 1.0;

        double clamped = Math.max(0, Math.min(1, completionPct));

        List<CareerMatch> matches = new ArrayList<>();
        for (CareerDefinition career : Navigator360CareerData.CAREER_DEFINITIONS) {
            List<String> reqRiasec = career.riasec == null ? null
                    : career.riasec.stream().map(Enum::name).collect(Collectors.toList());
            int p = clusterSubScore(reqRiasec, riasecNorm, RIASEC_W);
            int a = clusterSubScore(career.abilities, abilNorm, ABILITY_W);
            int iSc = clusterSubScore(career.mi, miNorm, MI_W);
            ValuesMatchResult valMatch = computeValuesMatch(career, studentValues);

            double csi = 0;
            if (w.containsKey("personality"))  csi += w.get("personality") * p;
            if (w.containsKey("ability"))      csi += w.get("ability") * a;
            if (w.containsKey("intelligence")) csi += w.get("intelligence") * iSc;
            if (w.containsKey("values"))       csi += w.get("values") * valMatch.score;
            csi = csi / wsum; // renormalise to 0–100

            int csiRaw = (int) Math.round(Math.max(0, Math.min(100, csi)));
            // Spec §2.3 step 11: csi_final = clamp(round(csi_raw × completion × 1.05), 0, 100)
            int csiFinal = (int) Math.round(Math.max(0, Math.min(100, csiRaw * clamped * 1.05)));

            CareerMatch m = new CareerMatch();
            m.career = career;
            m.pScore = p;
            m.aScore = a;
            m.iScore = iSc;
            m.valuesMatch = valMatch.score;
            m.csiRaw = csiRaw;
            m.suitability = csiFinal;
            m.potentialMatch = (int) Math.round((p + a + iSc) / 3.0); // back-compat blend
            m.suitability9 = Math.max(1, (int) Math.round((csiFinal / 100.0) * 9.0));
            m.cell = barCell(csiFinal);
            m.matchedValues = valMatch.matched;
            m.isAspiration = aspCareerIds.contains(career.id);
            matches.add(m);
        }

        // Rank desc by csi_final, then cluster cascade Tier A→F as a sort key (spec §9.3, EC-20):
        // P → A → I → V → aspiration → canonical Sr-no (Tier F, deterministic terminator).
        matches.sort(Comparator
                .comparingInt((CareerMatch m) -> m.suitability).reversed()
                .thenComparing(Comparator.comparingInt((CareerMatch m) -> m.pScore).reversed())
                .thenComparing(Comparator.comparingInt((CareerMatch m) -> m.aScore).reversed())
                .thenComparing(Comparator.comparingInt((CareerMatch m) -> m.iScore).reversed())
                .thenComparing(Comparator.comparingInt((CareerMatch m) -> m.valuesMatch).reversed())
                .thenComparing((CareerMatch m) -> m.isAspiration ? 0 : 1)
                .thenComparing((CareerMatch m) -> m.career.srNo));
        return matches;
    }

    /** Spec §2.7.1 Page-4 bar cell = clamp(ceil(csi_pct / 11.11), 1, 9). */
    static int barCell(int csiPct) {
        int cell = (int) Math.ceil(csiPct / 11.11);
        return Math.max(1, Math.min(9, cell));
    }

    // ═══════════════════════ CCI (Section 8) ═══════════════════════

    private CciResult computeCCI(List<String> aspirations, List<CareerMatch> ranked, String gradeGroup) {
        // Spec §2.3 step 10 / §2.6: CCI is not computed for the Insight (6-8) stage.
        if ("6-8".equals(gradeGroup)) {
            return new CciResult(false, null, "N/A");
        }
        List<String> top9 = ranked.stream().limit(9).map(m -> m.career.id).collect(Collectors.toList());
        int mapped = 0;
        int matched = 0;
        if (aspirations != null) {
            for (String a : aspirations) {
                String id = Navigator360CareerData.ASPIRATION_TO_CAREER.get(a);
                if (id == null) continue;       // unmapped aspirations excluded from denominator (WCS-5)
                mapped++;
                if (top9.contains(id)) matched++;
            }
        }
        if (mapped == 0) {
            return new CciResult(false, null, "N/A"); // EC-09: aspirations require counsellor mapping
        }
        int pct = (int) Math.round(((double) matched / mapped) * 100.0);
        String band = pct >= 70 ? "Clear and Aligned"
                : pct >= 40 ? "Partially Aligned"
                : "Aspiration Mismatch";
        return new CciResult(true, pct, band);
    }

    // ═══════════════════════ ALIGNMENT (Section 9) ═══════════════════════

    private int computeAlignment(List<ScoredDimension> riasec,
                                  List<ScoredDimension> mi,
                                  List<ScoredDimension> abilities,
                                  List<CareerMatch> topCareers) {
        List<String> top3R = riasec.stream()
                .sorted(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed())
                .limit(3).map(d -> d.name).collect(Collectors.toList());
        List<String> top3M = mi.stream()
                .sorted(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed())
                .limit(3).map(d -> d.name).collect(Collectors.toList());
        List<String> top3A = abilities.stream()
                .sorted(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed())
                .limit(3).map(d -> d.name).collect(Collectors.toList());

        List<String> dataPoints = new ArrayList<>();
        dataPoints.addAll(top3R);
        dataPoints.addAll(top3M);
        dataPoints.addAll(top3A);
        dataPoints.add("academic"); // 10 points

        List<Double> matchRates = new ArrayList<>();
        for (CareerMatch cm : topCareers.stream().limit(3).collect(Collectors.toList())) {
            List<String> careerDims = new ArrayList<>();
            if (cm.career.riasec != null) {
                cm.career.riasec.forEach(r -> careerDims.add(r.name()));
            }
            if (cm.career.mi != null) careerDims.addAll(cm.career.mi);
            if (cm.career.abilities != null) careerDims.addAll(cm.career.abilities);
            long matching = dataPoints.stream()
                    .filter(dp -> !"academic".equals(dp) && careerDims.contains(dp))
                    .count();
            matchRates.add(matching / 10.0);
        }
        double baseAlignment = matchRates.isEmpty()
                ? 0
                : matchRates.stream().mapToDouble(Double::doubleValue).average().orElse(0) * 100.0;

        double valBonusAvg = topCareers.stream().limit(3).mapToInt(m -> m.valuesMatch).average().orElse(0);
        double valBonus = (valBonusAvg / 3.0) * 0.15;

        return Math.min(99, (int) Math.round(baseAlignment + valBonus));
    }

    // ═══════════════════════ PSYCHOMETRIC FLAGS (Section 10–12) ═══════════════════════

    private List<String> detectValuesAspirationConflict(List<String> studentValues, List<String> aspirations) {
        List<String> spec = new ArrayList<>();
        if (studentValues != null) {
            for (String v : studentValues) {
                spec.add(Navigator360CareerData.VALUE_LABEL_TO_SPEC.getOrDefault(v, v));
            }
        }
        List<String> aspCareerNames = new ArrayList<>();
        if (aspirations != null) {
            for (String a : aspirations) {
                String id = Navigator360CareerData.ASPIRATION_TO_CAREER.get(a);
                if (id == null) continue;
                Navigator360CareerData.CAREER_DEFINITIONS.stream()
                        .filter(c -> id.equals(c.id))
                        .findFirst()
                        .ifPresent(c -> { if (c.name != null) aspCareerNames.add(c.name); });
            }
        }
        Set<String> hits = new HashSet<>();
        for (String v : spec) {
            List<String> conflicts = Navigator360CareerData.VALUE_CONFLICTS.get(v);
            if (conflicts == null) continue;
            for (String conflictName : conflicts) {
                for (String n : aspCareerNames) {
                    if (n.contains(conflictName) || conflictName.contains(n)) {
                        hits.add(v);
                    }
                }
            }
        }
        return new ArrayList<>(hits);
    }

    private List<FlagInfo> collectFlags(List<ScoredDimension> riasec,
                                         List<ScoredDimension> mi,
                                         List<ScoredDimension> abilities,
                                         List<String> aspirations,
                                         List<String> values,
                                         CciResult cci,
                                         String gradeGroup,
                                         Integer academicPct) {
        List<FlagInfo> flags = new ArrayList<>();
        // BIAS flags are emitted by the validity layer (spec §2.2.4) and merged in
        // computeNavigator360 — they are not recomputed here.

        long hiR = riasec.stream().filter(d -> d.level == AbsoluteLevel.HIGH).count();
        boolean allRiasecLow = !riasec.isEmpty() && riasec.stream().allMatch(d -> d.level == AbsoluteLevel.LOW);
        boolean allRiasecMod  = !riasec.isEmpty() && hiR == 0 && riasec.stream().allMatch(d -> d.level == AbsoluteLevel.MODERATE);

        if (allRiasecLow) {                                  // P-01: all 6 RIASEC Low
            flags.add(new FlagInfo("P-01", "Undifferentiated Personality",
                "All RIASEC types are Low. Active exploration phase — counsellor will guide discovery.",
                "11-12".equals(gradeGroup) ? "critical" : "info"));
        }
        if (hiR >= 3) {                                      // P-02: 3+ RIASEC High
            flags.add(new FlagInfo("P-02", "Multi-Dominant Profile",
                "Three or more personality types are equally strong — several pathways fit; counsellor will help focus.",
                "11-12".equals(gradeGroup) ? "warning" : "info"));
        }
        if (allRiasecMod) {                                  // P-03: all RIASEC Moderate, no High
            flags.add(new FlagInfo("P-03", "Flat Moderate Profile",
                "Broad range of interests with no strongly dominant personality type.", "info"));
        }
        if (!mi.isEmpty() && mi.stream().allMatch(d -> d.level == AbsoluteLevel.LOW)) { // P-05: all MI Low
            flags.add(new FlagInfo("P-05", "All MI Low",
                "Learning strengths waiting to be discovered through experience.",
                "11-12".equals(gradeGroup) ? "critical" : "warning"));
        }
        if (!abilities.isEmpty() && abilities.stream().allMatch(d -> d.level == AbsoluteLevel.LOW)) { // P-06: all Ability Low
            flags.add(new FlagInfo("P-06", "All Ability Low",
                "Ability scores may not reflect true strengths. Counsellor will review.",
                "11-12".equals(gradeGroup) ? "critical" : "warning"));
        }
        if (cci != null && cci.applicable && cci.pct != null && cci.pct < 40) { // P-07: CCI < 40%
            flags.add(new FlagInfo("P-07", "Aspiration Mismatch",
                "Career interests differ from top-strength careers — exciting conversation to have with counsellor.",
                "11-12".equals(gradeGroup) ? "critical" : "info"));
        }

        Set<RiasecType> aspRiasecSet = new HashSet<>();
        if (aspirations != null) {
            for (String a : aspirations) {
                RiasecType r = Navigator360CareerData.ASPIRATION_RIASEC.get(a);
                if (r != null) aspRiasecSet.add(r);
            }
        }
        if (aspRiasecSet.size() >= 4) {
            flags.add(new FlagInfo("P-10", "Aspiration Incoherence",
                "Wide-ranging curiosity spanning 4+ career personality types. Exploration session recommended.",
                "11-12".equals(gradeGroup) ? "warning" : "info"));
        }

        List<String> conflictingValues = detectValuesAspirationConflict(values, aspirations);
        if (!conflictingValues.isEmpty()) {
            flags.add(new FlagInfo("P-08", "Values–Aspiration Conflict",
                "A value you ranked highly (" + String.join(", ", conflictingValues)
                    + ") is in tension with one of your aspirations — worth exploring with your counsellor.",
                "info"));
        }

        if (academicPct != null) {
            long hiAb = abilities.stream().filter(a -> a.level == AbsoluteLevel.HIGH).count();
            boolean allLow = !abilities.isEmpty() && abilities.stream().allMatch(a -> a.level == AbsoluteLevel.LOW);
            if (hiAb >= 3 && academicPct < 50) {
                flags.add(new FlagInfo("P-09", "Academic–Ability Discrepancy",
                    "High tested abilities but academic results do not yet reflect them — there is more to explore about how you learn best.",
                    "11-12".equals(gradeGroup) ? "warning" : "info"));
            } else if (academicPct > 85 && allLow) {
                flags.add(new FlagInfo("P-09", "Academic–Ability Discrepancy",
                    "Strong academic results but ability scores are low — counsellor will help you understand what this means.",
                    "info"));
            }
        }
        return flags;
    }

    // ═══════════════════════ GRADE GROUP ═══════════════════════

    private static String resolveGradeGroup(String studentClass) {
        if (studentClass == null) return "6-8";
        String digits = studentClass.replaceAll("\\D", "");
        int num;
        try {
            num = digits.isEmpty() ? 0 : Integer.parseInt(digits);
        } catch (NumberFormatException ex) {
            num = 0;
        }
        if (num >= 11) return "11-12";
        if (num >= 9) return "9-10";
        return "6-8";
    }

    // ═══════════════════════ MAIN COMPUTATION ═══════════════════════

    public Navigator360Result computeNavigator360(IntermediaryScores data,
                                                   Integer academicPct,
                                                   Integer ccRaw,
                                                   double completionPct) {
        return computeNavigator360(data, academicPct, ccRaw, completionPct,
                computeValidity(data, completionPct));
    }

    // ═══════════════════════ VALIDITY / BIAS GATE (Spec §2.2) ═══════════════════════

    /**
     * Validity / bias outcome derivable from the cached intermediary scores: the Section
     * A/B/C minimum gate (VG-2) and the RIASEC acquiescence/disacquiescence biases
     * (VG-3 BIAS-01/02). A single bias suppresses the personality component (reweighted in
     * the CSI); two biases hard-fail.
     *
     * <p><b>Flagged gap:</b> the item-level cleaning gate (VG-1 / ERR-01-02), the ability/MI
     * floor biases (BIAS-03/04) and the real completion_pct denominator (WARN-01) require
     * per-item answer data that is not carried in the cached intermediary payload; they are
     * computed upstream in {@code NavigatorReportGenerationService} and should be threaded
     * through the payload to complete the gate (and to make the EC-04 composite hard-fail
     * reachable from ability/MI bias).
     */
    public ValidityResult computeValidity(IntermediaryScores data, double completionPctParam) {
        ValidityResult v = new ValidityResult();
        v.completionPct = Math.max(0, Math.min(1, completionPctParam));
        String grade = resolveGradeGroup(data.studentClass);

        // VG-2: Section A/B/C minimum (spec §2.2.3). 0 selections is treated as "not collected
        // for this stage" and skipped to avoid mass-blocking on unpopulated fields (flagged).
        sectionMinimum(v, "Core Values (B)", size(data.selectedValues));
        sectionMinimum(v, "Subjects of Interest (C)", size(data.selectedSOIs));
        if (!"6-8".equals(grade)) {
            sectionMinimum(v, "Career Aspirations (A)", size(data.selectedCareerAsps));
        }

        // VG-3: BIAS-01/02 from RIASEC sums (54 items, Yes=2/No=1 ⇒ #Yes = total − 54).
        int biasCount = 0;
        if (data.riasecScores != null && !data.riasecScores.isEmpty()) {
            int total = data.riasecScores.values().stream().mapToInt(Integer::intValue).sum();
            int yes = total - 54;
            int no = 54 - yes;
            if (yes >= 46) {           // ≥85% Yes
                biasCount++;
                v.suppressed.add("personality");
                v.flags.add(new FlagInfo("BIAS-01", "Acquiescence",
                    "Personality answers were almost all 'Yes' — the personality module is set aside for a counsellor conversation.",
                    "warning"));
            } else if (no >= 46) {     // ≥85% No
                biasCount++;
                v.suppressed.add("personality");
                v.flags.add(new FlagInfo("BIAS-02", "Disacquiescence",
                    "Personality answers were almost all 'No' — the personality module is set aside for a counsellor conversation.",
                    "warning"));
            }
        }
        // Composite hard-fail (spec §2.2.4): 2+ bias flags → cover-message only, no Top 9.
        if (biasCount >= 2) {
            v.hardFail = true;
            v.suppressed.clear();
        }
        return v;
    }

    private static void sectionMinimum(ValidityResult v, String section, int n) {
        if (n <= 0) return; // not collected for this stage — skip (flagged conservative choice)
        if (n < 3) {        // 1–2 selections → ERR-04 invalid (spec §2.2.3 / EC-29)
            v.valid = false;
            v.flags.add(new FlagInfo("ERR-04", "Section below minimum",
                section + " has fewer than 3 selections — re-administer this section.", "critical"));
        } else if (n < 5) { // 3–4 selections → WARN-02 (panel blank, record valid) / EC-17,31,32
            v.flags.add(new FlagInfo("WARN-02", "Under-selection",
                section + " has " + n + " selections — panel rendered blank; counsellor to note.", "info"));
        }
    }

    private static int size(List<String> l) { return l == null ? 0 : l.size(); }

    /**
     * @param validity item-level validity / bias outcome (spec §2.2). When non-null its
     *                 completionPct overrides the parameter, its suppressed components are
     *                 dropped from the CSI weighting (reweighted to 100), its flags are
     *                 merged, and a composite bias hard-fail suppresses the Top-9.
     */
    public Navigator360Result computeNavigator360(IntermediaryScores data,
                                                   Integer academicPct,
                                                   Integer ccRaw,
                                                   double completionPct,
                                                   ValidityResult validity) {
        Navigator360Result result = new Navigator360Result();
        result.studentName = data.studentName;
        result.studentClass = data.studentClass;
        result.gradeGroup = resolveGradeGroup(data.studentClass);

        java.util.Set<String> suppressed = validity != null ? validity.suppressed : new HashSet<>();
        boolean invalid = false;
        if (validity != null) {
            completionPct = validity.completionPct;
            result.hardFail = validity.hardFail;
            invalid = !validity.valid; // ERR-* → no report-worthy Top 9
        }

        // 1. Score dimensions
        result.riasec = scoreRIASEC(data.riasecScores);
        result.abilities = scoreAbilitiesOrMI(data.aptitudeScores);
        result.mi = scoreAbilitiesOrMI(data.miScores);

        // 2. Values (pass through; spec mapping done downstream)
        result.values = data.selectedValues != null ? new ArrayList<>(data.selectedValues) : new ArrayList<>();

        // 3. Potential score
        result.potentialScore = computePotentialScore(
                result.riasec, result.mi, result.abilities, academicPct, completionPct);

        // 4. Top RIASEC (for preference score)
        List<RiasecType> topRiasec = result.riasec.stream()
                .sorted(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed())
                .map(d -> RiasecType.valueOf(d.name))
                .collect(Collectors.toList());

        // 5. Cultural compatibility (default 50% when raw not supplied)
        double ccNorm = ccRaw != null ? Math.round(((ccRaw - 6.0) / 18.0) * 100.0) : 50.0;

        // 6. Preference score
        result.preferenceScore = computePreferenceScore(
                result.values, data.selectedCareerAsps, data.selectedSOIs, topRiasec, ccNorm);

        // 7. Career matching — CSI over all 24 clusters, ranked, Top 9 (spec §2.3 step 8–9)
        result.careerMatches = matchCareers(
                result.riasec, result.mi, result.abilities, result.values,
                data.selectedCareerAsps, completionPct, suppressed);
        // Composite bias hard-fail (spec §2.2.4 / EC-04) or ERR-* invalid (spec §2.2): no Top 9.
        List<CareerMatch> top9 = (result.hardFail || invalid)
                ? new ArrayList<>()
                : result.careerMatches.stream().limit(9).collect(Collectors.toList());
        int topCount = "11-12".equals(result.gradeGroup) ? 5 : 3;
        result.topCareers = top9.stream().limit(topCount).collect(Collectors.toList());

        // TOP9-3: suppress bottom tier when ≥4 of the Top 9 fall below csi 50 (spec §9.4)
        result.suppressBottomTier = top9.stream().filter(m -> m.suitability < 50).count() >= 4;

        // 8. CCI (spec §2.3 step 10; skipped for Insight)
        result.cci = computeCCI(data.selectedCareerAsps, result.careerMatches, result.gradeGroup);

        // 9. Alignment
        result.alignmentScore = computeAlignment(result.riasec, result.mi, result.abilities, result.topCareers);

        // 10. Holland code (top 3 RIASEC)
        result.hollandCode = topRiasec.stream().limit(3).map(Enum::name).collect(Collectors.joining());

        // 11. Flags (validity/bias flags first, then psychometric P-flags)
        result.flags = new ArrayList<>();
        if (validity != null) result.flags.addAll(validity.flags);
        result.flags.addAll(collectFlags(
                result.riasec, result.mi, result.abilities,
                data.selectedCareerAsps != null ? data.selectedCareerAsps : new ArrayList<>(),
                result.values, result.cci, result.gradeGroup, academicPct));

        // 12. Pass-through Section A/B/C selections
        result.careerAspirations = data.selectedCareerAsps != null ? new ArrayList<>(data.selectedCareerAsps) : new ArrayList<>();
        result.subjectsOfInterest = data.selectedSOIs != null ? new ArrayList<>(data.selectedSOIs) : new ArrayList<>();

        return result;
    }

    // ═══════════════════════ DISPLAY HELPERS ═══════════════════════

    public static String riasecDisplayName(String key) {
        try {
            return RiasecType.valueOf(key).label();
        } catch (Exception ex) {
            return key;
        }
    }

    public static String abilityDisplayName(String name) {
        return ABILITY_SHORT.getOrDefault(name, name);
    }

    public static String miDisplayName(String name) {
        return MI_DISPLAY.getOrDefault(name, name);
    }
}
