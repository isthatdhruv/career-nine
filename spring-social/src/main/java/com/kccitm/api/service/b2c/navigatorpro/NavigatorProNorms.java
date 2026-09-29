package com.kccitm.api.service.b2c.navigatorpro;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Cohort maths for one assessment (v3): empirical percentile rank within the cohort
 * (midrank on ties) — used internally to pick bands, never printed on the report —
 * medians as quadrant cuts, n-gates, precision, bands. Pure and static; the
 * calculation service owns caching.
 */
public final class NavigatorProNorms {

    public static final List<String> METRICS =
            List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning");

    // Report Logic v3 sheet 4 / Tech Spec v3: locked grid, Q1 = High-High (Will × Acquired Skill).
    public static final String ZONE_READY     = "Ready to accelerate";        // HH
    public static final String ZONE_MOTIVATED = "Motivated, needs skilling";  // High Will · Low Skill
    public static final String ZONE_CAPABLE   = "Capable, needs engagement";  // Low Will · High Skill
    public static final String ZONE_SUPPORT   = "Needs structured support";   // LL

    private NavigatorProNorms() {}

    public static final class Member {
        public final long userStudentId;
        public final Map<String, Double> metrics;

        public Member(long userStudentId, Map<String, Double> metrics) {
            this.userStudentId = userStudentId;
            this.metrics = Map.copyOf(metrics);
        }
    }

    public static final class NormSet {
        public final int n;
        public final int prec;
        public final boolean percentilesSuppressed;
        public final boolean provisional;
        public final double driveCut;
        public final double skillCut;
        private final Map<String, double[]> sorted;

        NormSet(int n, int prec, boolean percentilesSuppressed, boolean provisional,
                double driveCut, double skillCut, Map<String, double[]> sorted) {
            this.n = n; this.prec = prec; this.percentilesSuppressed = percentilesSuppressed;
            this.provisional = provisional; this.driveCut = driveCut; this.skillCut = skillCut;
            this.sorted = sorted;
        }

        /** Percentile of {@code x} for {@code metric}, or null while percentiles are suppressed. */
        public Double percentile(String metric, double x) {
            if (percentilesSuppressed) return null;
            double[] v = sorted.get(metric);
            if (v == null || v.length == 0) return null;
            return percentileRank(v, x);
        }
    }

    public static NormSet build(List<Member> members, int percentileMinN, int normsMinN) {
        int n = members.size();
        Map<String, double[]> sorted = new HashMap<>();
        for (String metric : METRICS) {
            double[] v = new double[n];
            for (int i = 0; i < n; i++) v[i] = members.get(i).metrics.getOrDefault(metric, 0.0);
            Arrays.sort(v);
            sorted.put(metric, v);
        }
        boolean suppressed = n < percentileMinN;
        boolean provisional = n < normsMinN;
        double driveCut = provisional ? 50.0 : median(sorted.get("drive"));
        double skillCut = provisional ? 50.0 : median(sorted.get("skill"));
        return new NormSet(n, precision(n), suppressed, provisional, driveCut, skillCut, sorted);
    }

    /** Midrank percentile: 100 × (below + 0.5 × equal) / n. */
    public static double percentileRank(double[] sorted, double x) {
        if (sorted.length == 0) return 0.0;
        int below = 0, equal = 0;
        for (double v : sorted) {
            if (v < x) below++;
            else if (v == x) equal++;
        }
        return 100.0 * (below + 0.5 * equal) / sorted.length;
    }

    public static double median(double[] sorted) {
        int n = sorted.length;
        if (n == 0) return 0.0;
        return n % 2 == 1 ? sorted[n / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
    }

    public static int precision(int n) {
        return n <= 0 ? 0 : (int) Math.round(100.0 / Math.sqrt(n));
    }

    /** Percentile-only band on the UNROUNDED percentile. */
    public static String band(double percentile) {
        if (percentile >= 75.0) return "Strong";
        if (percentile >= 25.0) return "Developing";
        return "Early";
    }

    /**
     * Raw RAG band (Report Logic v3 sheet 2): green ≥ 67 · amber 34–66 · red &lt; 34, judged
     * on the integer that prints (66.67 prints 67 and is Strong, as in the v3 sample).
     */
    public static String ragBand(double raw) {
        long v = Math.round(raw);
        if (v >= 67) return "Strong";
        if (v >= 34) return "Developing";
        return "Early";
    }

    public static String ragColour(double raw) {
        long v = Math.round(raw);
        if (v >= 67) return "green";
        if (v >= 34) return "amber";
        return "red";
    }

    /** Personality-card bullet band (Backend Content v3 sheet 3): High ≥ 67 · Mid 34–66 · Low ≤ 33. */
    public static String familyBand(double pct) {
        long v = Math.round(pct);
        if (v >= 67) return "High";
        if (v >= 34) return "Mid";
        return "Low";
    }

    /** Will × Acquired Skill quadrant; "at the cut" counts as high. */
    public static String zone(double will, double skill, double willCut, double skillCut) {
        boolean w = will >= willCut;
        boolean s = skill >= skillCut;
        if (w && s) return ZONE_READY;
        if (w) return ZONE_MOTIVATED;
        if (s) return ZONE_CAPABLE;
        return ZONE_SUPPORT;
    }
}
