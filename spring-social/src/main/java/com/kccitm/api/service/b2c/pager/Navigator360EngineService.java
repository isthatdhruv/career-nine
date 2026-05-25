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
import com.kccitm.api.service.b2c.pager.Navigator360Models.FlagInfo;
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

    private static int riasecStanine(int raw) {
        if (raw <= 10) return 1;
        if (raw == 11) return 2;
        if (raw == 12) return 3;
        if (raw == 13) return 4;
        if (raw == 14) return 5;
        if (raw == 15) return 6;
        if (raw == 16) return 7;
        if (raw == 17) return 8;
        return 9; // 18
    }

    private static int abilityMIStanine(int raw) {
        if (raw <= 4) return 1;
        if (raw == 5) return 2;
        if (raw == 6) return 3;
        if (raw == 7) return 4;
        if (raw == 8) return 5;
        if (raw == 9) return 6;
        if (raw == 10) return 7;
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

    // ═══════════════════════ BIAS CHECKS (Section 2.5) ═══════════════════════

    private List<FlagInfo> checkBiases(List<ScoredDimension> riasec,
                                        List<ScoredDimension> abilities,
                                        List<ScoredDimension> mi) {
        List<FlagInfo> flags = new ArrayList<>();

        // BIAS-01 / BIAS-02 — RIASEC acquiescence / disacquiescence
        int riasecTotal = riasec.stream().mapToInt(d -> d.rawScore).sum();
        int maxRiasec = riasec.size() * 18;
        int minRiasec = riasec.size() * 9;
        if (maxRiasec > 0 && (double) riasecTotal / maxRiasec >= 0.83) {
            flags.add(new FlagInfo("BIAS-01", "Acquiescence",
                "Personality answers followed an unusual positive pattern. Profile may be artificially high.",
                "warning"));
        }
        if (maxRiasec - minRiasec > 0
                && (double) (riasecTotal - minRiasec) / (maxRiasec - minRiasec) <= 0.17) {
            flags.add(new FlagInfo("BIAS-02", "Disacquiescence",
                "Personality answers followed an unusual negative pattern. All types may be suppressed.",
                "warning"));
        }

        // BIAS-03 — abilities floor
        if (!abilities.isEmpty()) {
            long lowAb = abilities.stream().filter(a -> a.rawScore <= 4).count();
            if ((double) lowAb / abilities.size() >= 0.83) {
                flags.add(new FlagInfo("BIAS-03", "Ability Floor Bias",
                    "Most ability scores at floor level. May indicate disengagement or reading difficulty.",
                    "warning"));
            }
        }

        // BIAS-04 — MI floor
        if (!mi.isEmpty()) {
            long lowMI = mi.stream().filter(m -> m.rawScore <= 4).count();
            if ((double) lowMI / mi.size() >= 0.83) {
                flags.add(new FlagInfo("BIAS-04", "MI Floor Bias",
                    "Most intelligence scores at floor level. Discovery plan recommended.",
                    "warning"));
            }
        }
        return flags;
    }

    // ═══════════════════════ POTENTIAL SCORE (Section 5) ═══════════════════════

    private PotentialScoreResult computePotentialScore(List<ScoredDimension> riasec,
                                                       List<ScoredDimension> mi,
                                                       List<ScoredDimension> abilities,
                                                       Integer academicPct,
                                                       double completionPctOverride) {
        PotentialScoreResult result = new PotentialScoreResult();

        // ── Component 1: Personality (max 25) ──
        List<ScoredDimension> hiR = riasec.stream().filter(d -> d.level == AbsoluteLevel.HIGH).collect(Collectors.toList());
        List<ScoredDimension> mdR = riasec.stream().filter(d -> d.level == AbsoluteLevel.MODERATE).collect(Collectors.toList());
        int personality;
        if (hiR.isEmpty()) {
            personality = 3;
            result.flags.add("P-01");
        } else {
            double gateMul = hiR.size() == 1 ? 0.65 : 1.0;
            List<ScoredDimension> qualified = new ArrayList<>();
            qualified.addAll(hiR);
            qualified.addAll(mdR);
            qualified.sort(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed());
            if (qualified.size() > 3) qualified = qualified.subList(0, 3);
            double[] weights = {0.50, 0.30, 0.20};
            double weighted = 0;
            for (int i = 0; i < qualified.size() && i < 3; i++) {
                double contribution = qualified.get(i).normPct * weights[i];
                if (qualified.get(i).level == AbsoluteLevel.MODERATE) contribution *= 0.75;
                weighted += contribution;
            }
            double maxNorm = riasec.stream().mapToDouble(d -> d.normPct).max().orElse(0);
            double minNorm = riasec.stream().mapToDouble(d -> d.normPct).min().orElse(0);
            double spread = maxNorm - minNorm;
            int clarityBonus = spread >= 60 ? 3 : spread >= 40 ? 2 : 0;
            double basePts = (weighted / 100.0) * (25 - clarityBonus);
            personality = Math.min(25, (int) Math.round((basePts + clarityBonus) * gateMul));

            // P-03: flat moderate
            if (hiR.isEmpty() && riasec.stream().allMatch(d -> d.stanine >= 3 && d.stanine <= 5)) {
                result.flags.add("P-03");
            }
        }
        result.personality = personality;

        // ── Component 2: Intelligence (max 25) ──
        List<ScoredDimension> hiMI = mi.stream().filter(d -> d.level == AbsoluteLevel.HIGH).collect(Collectors.toList());
        List<ScoredDimension> mdMI = mi.stream().filter(d -> d.level == AbsoluteLevel.MODERATE).collect(Collectors.toList());
        int intelligence;
        if (hiMI.isEmpty()) {
            intelligence = 2;
            result.flags.add("P-05");
        } else {
            double gateMul = hiMI.size() == 1 ? 0.65 : 1.0;
            List<ScoredDimension> qualified = new ArrayList<>();
            qualified.addAll(hiMI);
            qualified.addAll(mdMI);
            qualified.sort(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed());
            if (qualified.size() > 3) qualified = qualified.subList(0, 3);
            double[] weights = {0.50, 0.30, 0.20};
            double weighted = 0;
            for (int i = 0; i < qualified.size() && i < 3; i++) {
                double contribution = qualified.get(i).normPct * weights[i];
                if (qualified.get(i).level == AbsoluteLevel.MODERATE) contribution *= 0.75;
                weighted += contribution;
            }
            intelligence = Math.min(25, (int) Math.round((weighted / 100.0) * 25.0 * gateMul));
        }
        result.intelligence = intelligence;

        // ── Component 3: Ability (max 30) ──
        List<ScoredDimension> hiAb = abilities.stream().filter(d -> d.level == AbsoluteLevel.HIGH).collect(Collectors.toList());
        List<ScoredDimension> mdAb = abilities.stream().filter(d -> d.level == AbsoluteLevel.MODERATE).collect(Collectors.toList());
        int ability;
        if (hiAb.isEmpty()) {
            ability = 3;
            result.flags.add("P-06");
        } else {
            double gateMul = hiAb.size() < 3 ? 0.70 : 1.0;
            List<ScoredDimension> qualified = new ArrayList<>();
            qualified.addAll(hiAb);
            qualified.addAll(mdAb);
            qualified.sort(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed());
            if (qualified.size() > 5) qualified = qualified.subList(0, 5);
            double[] weights = {0.30, 0.25, 0.20, 0.15, 0.10};
            double weighted = 0;
            for (int i = 0; i < qualified.size() && i < 5; i++) {
                double contribution = qualified.get(i).normPct * weights[i];
                if (qualified.get(i).level == AbsoluteLevel.MODERATE) contribution *= 0.75;
                weighted += contribution;
            }
            ability = Math.min(30, (int) Math.round((weighted / 100.0) * 30.0 * gateMul));
        }
        result.ability = ability;

        // ── Component 4: Academic (max 20) ──
        int academic = academicPct != null ? (int) Math.round((academicPct / 100.0) * 20.0) : 0;
        result.academic = academic;

        // ── Final ──
        int potRaw = personality + intelligence + ability + academic;
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

    // ═══════════════════════ CAREER MATCHING (Section 7) ═══════════════════════

    private int computePotentialMatch(CareerDefinition career,
                                       Map<String, AbsoluteLevel> riasecLevels,
                                       Map<String, AbsoluteLevel> miLevels,
                                       Map<String, AbsoluteLevel> abilityLevels) {
        double[] weights = {1.0, 0.6, 0.3};

        double rPts = 0;
        if (career.riasec != null) {
            for (int i = 0; i < Math.min(career.riasec.size(), 3); i++) {
                AbsoluteLevel lvl = riasecLevels.get(career.riasec.get(i).name());
                if (lvl == AbsoluteLevel.HIGH) rPts += 13.3 * weights[i];
                else if (lvl == AbsoluteLevel.MODERATE) rPts += 8.0 * weights[i];
            }
        }

        double mPts = 0;
        if (career.mi != null) {
            for (int i = 0; i < Math.min(career.mi.size(), 3); i++) {
                AbsoluteLevel lvl = miLevels.get(career.mi.get(i));
                if (lvl == AbsoluteLevel.HIGH) mPts += 10.0 * weights[i];
                else if (lvl == AbsoluteLevel.MODERATE) mPts += 6.0 * weights[i];
            }
        }

        double aPts = 0;
        if (career.abilities != null) {
            for (int i = 0; i < Math.min(career.abilities.size(), 3); i++) {
                AbsoluteLevel lvl = abilityLevels.get(career.abilities.get(i));
                if (lvl == AbsoluteLevel.HIGH) aPts += 10.0 * weights[i];
                else if (lvl == AbsoluteLevel.MODERATE) aPts += 6.0 * weights[i];
            }
        }

        return Math.min(100, (int) Math.round(rPts + mPts + aPts));
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
        double matchScore = spec.isEmpty() ? 0 : ((double) matched.size() / spec.size()) * 100.0;

        double conflictPenalty = 0;
        for (String val : spec) {
            List<String> conflicts = Navigator360CareerData.VALUE_CONFLICTS.get(val);
            if (conflicts == null) continue;
            for (String c : conflicts) {
                if (career.name != null && career.name.contains(c)) {
                    conflictPenalty += 15;
                    break;
                }
            }
        }

        int score = Math.max(0, (int) Math.round(matchScore - conflictPenalty));
        return new ValuesMatchResult(score, matched);
    }

    private List<CareerMatch> matchCareers(List<ScoredDimension> riasec,
                                            List<ScoredDimension> mi,
                                            List<ScoredDimension> abilities,
                                            List<String> studentValues,
                                            List<String> aspirations) {
        Map<String, AbsoluteLevel> riasecLevels = new HashMap<>();
        for (ScoredDimension d : riasec) riasecLevels.put(d.name, d.level);
        Map<String, AbsoluteLevel> miLevels = new HashMap<>();
        for (ScoredDimension d : mi) miLevels.put(d.name, d.level);
        Map<String, AbsoluteLevel> abilityLevels = new HashMap<>();
        for (ScoredDimension d : abilities) abilityLevels.put(d.name, d.level);

        Set<String> aspCareerIds = new HashSet<>();
        if (aspirations != null) {
            for (String a : aspirations) {
                String id = Navigator360CareerData.ASPIRATION_TO_CAREER.get(a);
                if (id != null) aspCareerIds.add(id);
            }
        }

        List<CareerMatch> matches = new ArrayList<>();
        for (CareerDefinition career : Navigator360CareerData.CAREER_DEFINITIONS) {
            int potMatch = computePotentialMatch(career, riasecLevels, miLevels, abilityLevels);
            ValuesMatchResult valMatch = computeValuesMatch(career, studentValues);
            boolean isAspiration = aspCareerIds.contains(career.id);
            int aspBonus = isAspiration ? 10 : 0;
            int suitability = Math.min(100, (int) Math.round(potMatch * 0.60 + valMatch.score * 0.40 + aspBonus));
            int suit9 = (int) Math.round((suitability / 100.0) * 9.0);

            CareerMatch m = new CareerMatch();
            m.career = career;
            m.potentialMatch = potMatch;
            m.valuesMatch = valMatch.score;
            m.suitability = suitability;
            m.suitability9 = Math.max(1, suit9);
            m.matchedValues = valMatch.matched;
            m.isAspiration = isAspiration;
            matches.add(m);
        }
        matches.sort(Comparator.comparingInt((CareerMatch m) -> m.suitability).reversed());
        return matches;
    }

    // ═══════════════════════ CCI (Section 8) ═══════════════════════

    private CciLevel computeCCI(List<String> aspirations, List<CareerMatch> ranked) {
        List<String> top3 = ranked.stream().limit(3).map(m -> m.career.id).collect(Collectors.toList());
        List<String> top9 = ranked.stream().limit(9).map(m -> m.career.id).collect(Collectors.toList());

        List<String> aspIds = new ArrayList<>();
        if (aspirations != null) {
            for (String a : aspirations) {
                String id = Navigator360CareerData.ASPIRATION_TO_CAREER.get(a);
                if (id != null) aspIds.add(id);
            }
        }
        long matchTop3 = aspIds.stream().filter(top3::contains).count();
        long matchTop9 = aspIds.stream().filter(top9::contains).count();
        if (matchTop3 >= 2) return CciLevel.High;
        if (matchTop3 == 1 || matchTop9 >= 1) return CciLevel.Moderate;
        return CciLevel.Low;
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
                                         CciLevel cci,
                                         List<String> potFlags,
                                         String gradeGroup,
                                         Integer academicPct) {
        List<FlagInfo> flags = new ArrayList<>();
        flags.addAll(checkBiases(riasec, abilities, mi));

        if (potFlags.contains("P-01")) {
            flags.add(new FlagInfo("P-01", "Undifferentiated Personality",
                "All RIASEC types are Low. Active exploration phase — counsellor will guide discovery.",
                "11-12".equals(gradeGroup) ? "critical" : "info"));
        }
        if (potFlags.contains("P-03")) {
            flags.add(new FlagInfo("P-03", "Flat Moderate Profile",
                "Broad range of interests with no strongly dominant personality type.", "info"));
        }
        if (potFlags.contains("P-05")) {
            flags.add(new FlagInfo("P-05", "All MI Low",
                "Learning strengths waiting to be discovered through experience.",
                "11-12".equals(gradeGroup) ? "critical" : "warning"));
        }
        if (potFlags.contains("P-06")) {
            flags.add(new FlagInfo("P-06", "All Ability Low",
                "Ability scores may not reflect true strengths. Counsellor will review.",
                "11-12".equals(gradeGroup) ? "critical" : "warning"));
        }
        if (cci == CciLevel.Low) {
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
        Navigator360Result result = new Navigator360Result();
        result.studentName = data.studentName;
        result.studentClass = data.studentClass;
        result.gradeGroup = resolveGradeGroup(data.studentClass);

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

        // 7. Career matching
        result.careerMatches = matchCareers(
                result.riasec, result.mi, result.abilities, result.values, data.selectedCareerAsps);
        int topCount = "11-12".equals(result.gradeGroup) ? 5 : 3;
        result.topCareers = result.careerMatches.stream().limit(topCount).collect(Collectors.toList());

        // 8. CCI
        result.cci = computeCCI(data.selectedCareerAsps, result.careerMatches);

        // 9. Alignment
        result.alignmentScore = computeAlignment(result.riasec, result.mi, result.abilities, result.topCareers);

        // 10. Holland code (top 3 RIASEC)
        result.hollandCode = topRiasec.stream().limit(3).map(Enum::name).collect(Collectors.joining());

        // 11. Flags
        result.flags = collectFlags(
                result.riasec, result.mi, result.abilities,
                data.selectedCareerAsps != null ? data.selectedCareerAsps : new ArrayList<>(),
                result.values, result.cci, result.potentialScore.flags, result.gradeGroup, academicPct);

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
