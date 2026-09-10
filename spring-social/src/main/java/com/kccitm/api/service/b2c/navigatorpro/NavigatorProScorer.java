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
 * Pure scoring: contribution rows → indices, families, checks, flags, incomplete
 * list. No I/O. Σ per construct is the plain sum of matched rows; the stored MQT
 * scores already carry any reversal.
 */
public final class NavigatorProScorer {

    /** A validity row scoring this or higher is one flag (scores are oriented high = suspicious). */
    public static final int VALIDITY_FLAG_SCORE = 4;

    private final NavigatorProConstructMap map;
    private final double flatGap;

    public NavigatorProScorer(NavigatorProConstructMap map, double flatGap) {
        this.map = map;
        this.flatGap = flatGap;
    }

    public NavigatorProScores score(List<Contribution> rows, List<ValueRank> values,
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

        // Completeness: every expected question exactly once.
        for (Construct c : map.all()) {
            Map<Long, Integer> got = countByQuestion.getOrDefault(c.key, Map.of());
            for (Long q : new TreeSet<>(expected.getOrDefault(c.key, Set.of()))) {
                int n = got.getOrDefault(q, 0);
                if (n == 0) s.incomplete.add(c.key + ":" + q + ":missing");
                else if (n > 1) s.incomplete.add(c.key + ":" + q + ":duplicate");
            }
        }

        // Factors and drive: floor = questions × 1, range = questions × 4.
        int factorSum = 0;
        int factorQuestions = 0;
        for (String k : NavigatorProConstructMap.FACTOR_KEYS) {
            Construct c = map.get(k);
            s.index.put(k, scale(sum.getOrDefault(k, 0), c.questions, c.questions * 4));
            factorSum += sum.getOrDefault(k, 0);
            factorQuestions += c.questions;
        }
        s.index.put("drive", scale(factorSum, factorQuestions, factorQuestions * 4));

        // Foundation sub-domains: (Σ − k)/(3k); foundation over all 22.
        int subSum = 0;
        int subQuestions = 0;
        for (String k : NavigatorProConstructMap.SUB_KEYS) {
            Construct c = map.get(k);
            s.index.put(k, scale(sum.getOrDefault(k, 0), c.questions, c.questions * 3));
            subSum += sum.getOrDefault(k, 0);
            subQuestions += c.questions;
        }
        s.index.put("foundation", scale(subSum, subQuestions, subQuestions * 3));

        // Reasoning checks: the single row is correct when it scores 1.
        int correct = 0;
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            List<Integer> r = perRow.getOrDefault(k, List.of());
            boolean ok = r.size() == 1 && r.get(0) == 1;
            s.checks.put(k, ok);
            if (ok) correct++;
        }
        s.reasoning = correct;

        // Specialized domains: (m − 1)/4; skill over all 12.
        int domSum = 0;
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) {
            s.index.put(k, scale(sum.getOrDefault(k, 0), 1, 4));
            domSum += sum.getOrDefault(k, 0);
        }
        int domains = NavigatorProConstructMap.DOMAIN_KEYS.size();
        s.index.put("skill", scale(domSum, domains, domains * 4));

        // Families: Yes-count / questions × 100.
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) {
            Construct c = map.get(k);
            s.index.put(k, sum.getOrDefault(k, 0) * 100.0 / c.questions);
        }
        List<String> ranked = new ArrayList<>(NavigatorProConstructMap.FAMILY_KEYS);
        ranked.sort(Comparator.comparingDouble((String k) -> s.get(k)).reversed());
        s.topFamily = ranked.get(0);
        s.secondFamily = ranked.get(1);
        s.flat = (s.get(s.topFamily) - s.get(s.secondFamily)) < flatGap;

        // Values: rank order 1..4.
        List<ValueRank> sorted = new ArrayList<>(values);
        sorted.sort(Comparator.comparingInt(v -> v.rank));
        for (ValueRank v : sorted) {
            if (v.rank >= 1 && v.rank <= 4 && s.values.size() < 4) s.values.add(v.optionText);
        }
        s.valuesMissing = s.values.size() < 4;

        // Validity and attention.
        s.validityFlags = (int) perRow.getOrDefault(NavigatorProConstructMap.VALIDITY, List.of())
                .stream().filter(v -> v >= VALIDITY_FLAG_SCORE).count();
        List<Integer> att = perRow.getOrDefault(NavigatorProConstructMap.ATTENTION, List.of());
        s.attentionPassed = att.size() == 1 && att.get(0) == 1;

        return s;
    }

    private static double scale(int sum, int floor, int range) {
        return range == 0 ? 0.0 : (sum - floor) * 100.0 / range;
    }
}
