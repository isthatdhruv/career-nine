package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap.Construct;

/**
 * Pure scoring (Report Logic v3, sheet 1): contribution rows → indices, families,
 * checks, flags, incomplete list. No I/O. Σ per construct is the plain sum of
 * matched rows; the stored MQT scores already carry any reversal.
 *
 * <p>Every index is (Σ − q·min) / (q·(max − min)) × 100 over the construct's
 * questions q and mark range, which yields exactly the v3 formulas: Will
 * (Σ−11)/44, factors (Σ−4)/16 · (Σ−3)/12 · (Σ−4)/16, Foundation (Σ−22)/66, sub-skills
 * (Σ−k)/3k, Acquired Skill (Σ−12)/36, per-domain (m−1)/3, families Yes/6.
 */
public final class NavigatorProScorer {

    /** A validity row scoring this or higher is one flag (all three items are oriented high = suspicious). */
    public static final int VALIDITY_FLAG_SCORE = 4;
    public static final int RANKED_VALUES = 4;

    private final NavigatorProConstructMap map;
    private final double flatGap;

    public NavigatorProScorer(NavigatorProConstructMap map, double flatGap) {
        this.map = map;
        this.flatGap = flatGap;
    }

    public NavigatorProScores score(List<Contribution> rows, List<ValueRank> values,
                                    Map<String, Set<Long>> expected) {
        return score(rows, values, List.of(), expected);
    }

    public NavigatorProScores score(List<Contribution> rows, List<ValueRank> values, List<String> aspirations,
                                    Map<String, Set<Long>> expected) {
        NavigatorProScores s = new NavigatorProScores();

        Map<String, Integer> sum = new HashMap<>();
        Map<String, List<Integer>> perRow = new HashMap<>();
        Map<String, Map<Long, Integer>> countByQuestion = new HashMap<>();
        for (Contribution r : rows) {
            sum.merge(r.construct, r.score, Integer::sum);
            perRow.computeIfAbsent(r.construct, k -> new ArrayList<>()).add(r.score);
            countByQuestion.computeIfAbsent(r.construct, k -> new HashMap<>()).merge(r.questionId, 1, Integer::sum);
        }
        for (Construct c : map.all()) s.sums.put(c.key, sum.getOrDefault(c.key, 0));

        // Completeness: every expected question exactly once.
        for (Construct c : map.all()) {
            Map<Long, Integer> got = countByQuestion.getOrDefault(c.key, Map.of());
            for (Long q : new TreeSet<>(expected.getOrDefault(c.key, Set.of()))) {
                int n = got.getOrDefault(q, 0);
                if (n == 0) s.incomplete.add(c.key + ":" + q + ":missing");
                else if (n > 1) s.incomplete.add(c.key + ":" + q + ":duplicate");
            }
        }

        // Will (drive) = union of the three factor rows; Foundation = union of the five sub-skills;
        // Acquired Skill = union of the twelve domains.
        s.index.put("drive", group(s, sum, NavigatorProConstructMap.FACTOR_KEYS));
        s.index.put("foundation", group(s, sum, NavigatorProConstructMap.SUB_KEYS));
        s.index.put("skill", group(s, sum, NavigatorProConstructMap.DOMAIN_KEYS));
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) s.index.put(k, scaled(map.get(k), sum.getOrDefault(k, 0)));

        // Everyday logic: the single row of each check is correct when it scores 1.
        int correct = 0;
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            List<Integer> r = perRow.getOrDefault(k, List.of());
            boolean ok = r.size() == 1 && r.get(0) == 1;
            s.checks.put(k, ok);
            if (ok) correct++;
        }
        s.reasoning = correct;

        // Interest shape: families ranked, ties broken in map order (Hands-on first).
        List<String> ranked = new ArrayList<>(NavigatorProConstructMap.FAMILY_KEYS);
        ranked.sort(Comparator.comparingDouble((String k) -> s.get(k)).reversed());
        s.topFamily = ranked.get(0);
        s.secondFamily = ranked.get(1);
        s.flat = (s.get(s.topFamily) - s.get(s.secondFamily)) < flatGap;

        // Values: rank order 1..4 (weights 4/3/2/1 are applied by the blend).
        List<ValueRank> sorted = new ArrayList<>(values);
        sorted.sort(Comparator.comparingInt(v -> v.rank));
        for (ValueRank v : sorted) {
            if (v.rank >= 1 && v.rank <= RANKED_VALUES && s.values.size() < RANKED_VALUES) {
                s.values.add(v.tag);
                s.valueOptions.add(v.optionText);
            }
        }
        s.valuesMissing = s.values.size() < RANKED_VALUES;
        if (s.valuesMissing) s.incomplete.add("values:ranked:" + s.values.size());

        s.aspirations.addAll(aspirations);

        // Validity and attention.
        s.validityFlags = (int) perRow.getOrDefault(NavigatorProConstructMap.VALIDITY, List.of())
                .stream().filter(v -> v >= VALIDITY_FLAG_SCORE).count();
        List<Integer> att = perRow.getOrDefault(NavigatorProConstructMap.ATTENTION, List.of());
        s.attentionPassed = att.size() == 1 && att.get(0) == 1;

        return s;
    }

    /** Scales each member construct and returns the index over their union. */
    private double group(NavigatorProScores s, Map<String, Integer> sum, List<String> keys) {
        int total = 0, floor = 0, range = 0;
        for (String k : keys) {
            Construct c = map.get(k);
            int sk = sum.getOrDefault(k, 0);
            s.index.put(k, scaled(c, sk));
            total += sk;
            floor += c.questions * c.min;
            range += c.questions * (c.max - c.min);
        }
        return range == 0 ? 0.0 : (total - floor) * 100.0 / range;
    }

    static double scaled(Construct c, int sum) {
        int range = c.questions * (c.max - c.min);
        return range == 0 ? 0.0 : (sum - c.questions * c.min) * 100.0 / range;
    }
}
