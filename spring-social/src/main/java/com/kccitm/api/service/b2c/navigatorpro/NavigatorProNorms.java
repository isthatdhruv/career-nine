package com.kccitm.api.service.b2c.navigatorpro;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Cohort maths for one assessment: empirical percentile rank (midrank on ties),
 * medians as quadrant cuts, n-gates, precision, bands. Pure and static; the
 * calculation service owns caching.
 */
public final class NavigatorProNorms {

    public static final List<String> METRICS =
            List.of("drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning");

    public static final String ZONE_READY    = "Ready to accelerate";
    public static final String ZONE_DRIVEN   = "Driven, still building";
    public static final String ZONE_SKILLED  = "Skilled, needs a spark";
    public static final String ZONE_STARTING = "Starting the journey";

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

    /** Raw-threshold band for the foundation sub-domain bars. */
    public static String ragBand(double raw) {
        if (raw >= 67.0) return "Strong";
        if (raw >= 34.0) return "Developing";
        return "Early";
    }

    public static String ragColour(double raw) {
        if (raw >= 67.0) return "green";
        if (raw >= 34.0) return "amber";
        return "red";
    }

    /** "At the cut" counts as above. */
    public static String zone(double drive, double skill, double driveCut, double skillCut) {
        boolean d = drive >= driveCut;
        boolean s = skill >= skillCut;
        if (d && s) return ZONE_READY;
        if (d) return ZONE_DRIVEN;
        if (s) return ZONE_SKILLED;
        return ZONE_STARTING;
    }
}
