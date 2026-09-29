package com.kccitm.api.service.b2c.navigatorpro;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The v3 direction blend (Core_Algorithm_Weightages sheets 2–4, Tech Spec v3 §4). One
 * LOCKED weight set for every profile — Interest .40 · Exposure .40 · Values .20 — over
 * three signals per career domain:
 * <ul>
 *   <li>InterestFit = Σ(weight × family %) ÷ Σ weights, from the 12×6 interest matrix;</li>
 *   <li>Exposure = that domain's own rating (0 / 33 / 67 / 100);</li>
 *   <li>ValueAlignment = Σ rank-weight (4/3/2/1) × supply(career, value) ÷ 30 × 100, from the
 *       12×12 value-supply matrix.</li>
 * </ul>
 * All twelve are ranked (ties broken in domain order). Matrices and weights live in
 * {@code navigator-pro/blend-v3.json}; editing them never needs a code change.
 */
@Component
public class NavigatorProBlend {

    public static final class Result {
        public final Map<String, Double> interestFit = new LinkedHashMap<>();
        public final Map<String, Double> exposure = new LinkedHashMap<>();
        public final Map<String, Double> valueAlignment = new LinkedHashMap<>();
        public final Map<String, Double> careerScore = new LinkedHashMap<>();
        /** Domain keys, best first. */
        public final List<String> ranking = new ArrayList<>();
        /** Sector name → fit (weighted average of CareerScores). Asterisked capability, not displayed. */
        public final Map<String, Double> sectors = new LinkedHashMap<>();
        public double gap12;
        public double spread13;
        public double maxExposure;
        public boolean tie;
        public boolean explorer;

        public double score(int rank) {
            return careerScore.get(ranking.get(rank - 1));
        }
    }

    private final double wInterest, wExposure, wValues;
    private final int[] rankWeights;
    private final double valueDivisor;
    /** Domain label → family label → weight. */
    private final Map<String, Map<String, Integer>> interest = new LinkedHashMap<>();
    /** Domain label → value tag (normalised) → supply 0–3. */
    private final Map<String, Map<String, Integer>> supply = new LinkedHashMap<>();
    private final Map<String, Map<String, Double>> sectorRecipes = new LinkedHashMap<>();
    private final List<String> valueTags = new ArrayList<>();

    public NavigatorProBlend() {
        this(NavigatorProBlend.class.getResourceAsStream("/navigator-pro/blend-v3.json"));
    }

    NavigatorProBlend(InputStream in) {
        if (in == null) throw new IllegalStateException("navigator-pro/blend-v3.json missing from classpath");
        JsonNode root;
        try (InputStream is = in) {
            root = new ObjectMapper().readTree(is);
        } catch (IOException e) {
            throw new IllegalStateException("blend-v3.json unreadable: " + e.getMessage(), e);
        }
        JsonNode w = root.path("weights");
        wInterest = w.path("interest").asDouble(Double.NaN);
        wExposure = w.path("exposure").asDouble(Double.NaN);
        wValues = w.path("values").asDouble(Double.NaN);
        if (Double.isNaN(wInterest) || Double.isNaN(wExposure) || Double.isNaN(wValues)
                || Math.abs(wInterest + wExposure + wValues - 1.0) > 1e-9) {
            throw new IllegalStateException("blend-v3.json: weights must be present and sum to 1");
        }
        JsonNode rw = root.path("rankWeights");
        rankWeights = new int[rw.size()];
        for (int i = 0; i < rw.size(); i++) rankWeights[i] = rw.get(i).asInt();
        valueDivisor = root.path("valueAlignmentDivisor").asDouble(30);
        root.path("interestMatrix").fields().forEachRemaining(e -> {
            Map<String, Integer> row = new LinkedHashMap<>();
            e.getValue().fields().forEachRemaining(f -> row.put(f.getKey(), f.getValue().asInt()));
            interest.put(e.getKey(), row);
        });
        root.path("valueSupply").fields().forEachRemaining(e -> {
            Map<String, Integer> row = new LinkedHashMap<>();
            e.getValue().fields().forEachRemaining(f -> {
                row.put(NavigatorProConstructMap.normalize(f.getKey()), f.getValue().asInt());
                if (!valueTags.contains(f.getKey())) valueTags.add(f.getKey());
            });
            supply.put(e.getKey(), row);
        });
        root.path("sectors").fields().forEachRemaining(e -> {
            Map<String, Double> recipe = new LinkedHashMap<>();
            e.getValue().fields().forEachRemaining(f -> recipe.put(f.getKey(), f.getValue().asDouble()));
            sectorRecipes.put(e.getKey(), recipe);
        });
        if (interest.size() != 12 || supply.size() != 12) {
            throw new IllegalStateException("blend-v3.json: interest and value-supply matrices need 12 career rows");
        }
    }

    /** Checks the matrices cover every domain and family label the construct map uses; fails fast otherwise. */
    public void validateAgainst(NavigatorProConstructMap map) {
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) {
            String label = map.label(d);
            if (!interest.containsKey(label) || !supply.containsKey(label)) {
                throw new IllegalStateException("blend-v3.json has no row for domain '" + label + "'");
            }
            for (String f : NavigatorProConstructMap.FAMILY_KEYS) {
                if (!interest.get(label).containsKey(map.label(f))) {
                    throw new IllegalStateException("blend-v3.json interest row '" + label
                            + "' has no column for family '" + map.label(f) + "'");
                }
            }
        }
    }

    /** True when the value-supply matrix has a column for {@code tag}. */
    public boolean knowsValueTag(String tag) {
        return supply.values().iterator().next().containsKey(NavigatorProConstructMap.normalize(tag));
    }

    public List<String> valueTags() {
        return Collections.unmodifiableList(valueTags);
    }

    public Map<String, Map<String, Integer>> interestMatrix() { return Collections.unmodifiableMap(interest); }
    public Map<String, Map<String, Integer>> supplyMatrix()   { return Collections.unmodifiableMap(supply); }
    public Map<String, Map<String, Double>> sectorRecipes()   { return Collections.unmodifiableMap(sectorRecipes); }
    public double weightInterest() { return wInterest; }
    public double weightExposure() { return wExposure; }
    public double weightValues()   { return wValues; }
    public int[] rankWeights()     { return rankWeights.clone(); }
    public double valueDivisor()   { return valueDivisor; }

    /**
     * @param tieGap          #1 − #2 below this → tie line (v3: 3)
     * @param explorerSpread  #1 − #3 below this … (v3: 5)
     * @param explorerMaxExp  … AND highest domain exposure below this → Explorer (v3: 75)
     */
    public Result compute(NavigatorProScores s, NavigatorProConstructMap map,
                          double tieGap, double explorerSpread, double explorerMaxExp) {
        Result r = new Result();
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) {
            String label = map.label(d);
            Map<String, Integer> row = interest.get(label);
            double num = 0, den = 0;
            for (String f : NavigatorProConstructMap.FAMILY_KEYS) {
                int weight = row.getOrDefault(map.label(f), 0);
                num += weight * s.get(f);
                den += weight;
            }
            double fit = den == 0 ? 0 : num / den;

            double va = 0;
            Map<String, Integer> sup = supply.get(label);
            for (int i = 0; i < s.values.size() && i < rankWeights.length; i++) {
                String tag = NavigatorProConstructMap.normalize(s.values.get(i));
                Integer cell = sup.get(tag);
                if (cell == null) {
                    // Tech Spec v3 §8: a value tag without a matrix row is a hard failure.
                    throw new IllegalStateException("value tag '" + s.values.get(i)
                            + "' has no column in the value-supply matrix");
                }
                va += rankWeights[i] * cell;
            }
            va = va / valueDivisor * 100.0;

            double exp = s.get(d);
            r.interestFit.put(d, fit);
            r.exposure.put(d, exp);
            r.valueAlignment.put(d, va);
            r.careerScore.put(d, wInterest * fit + wExposure * exp + wValues * va);
        }
        List<String> order = new ArrayList<>(NavigatorProConstructMap.DOMAIN_KEYS);
        order.sort(Comparator.comparingDouble((String d) -> r.careerScore.get(d)).reversed());  // stable: domain order on ties
        r.ranking.addAll(order);

        r.gap12 = r.score(1) - r.score(2);
        r.spread13 = r.score(1) - r.score(3);
        r.maxExposure = s.maxDomain();
        r.tie = r.gap12 < tieGap;
        r.explorer = r.spread13 < explorerSpread && r.maxExposure < explorerMaxExp;

        for (Map.Entry<String, Map<String, Double>> e : sectorRecipes.entrySet()) {
            double fit = 0;
            for (Map.Entry<String, Double> part : e.getValue().entrySet()) {
                String dk = map.domainForLabel(part.getKey()).orElseThrow(() ->
                        new IllegalStateException("sector recipe names unknown domain '" + part.getKey() + "'"));
                fit += part.getValue() * r.careerScore.get(dk);
            }
            r.sectors.put(e.getKey(), fit);
        }
        return r;
    }
}
