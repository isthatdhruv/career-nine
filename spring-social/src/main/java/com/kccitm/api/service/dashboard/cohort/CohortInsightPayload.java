package com.kccitm.api.service.dashboard.cohort;

import java.util.ArrayList;
import java.util.List;

/**
 * Cohort-level insight payload stored as JSON in school_report.report_data.
 * PLACEHOLDER SHAPE: the real Navigator-360-style cohort schema replaces this
 * behind the same {@link CohortInsightAggregator} interface (bump logicVersion).
 */
public class CohortInsightPayload {

    public int studentCount;
    public List<CohortDimension> riasecAverage = new ArrayList<>();
    public String logicVersion;
    public String note;

    public static class CohortDimension {
        public String name;
        public double avgNormPct;

        public CohortDimension() {}

        public CohortDimension(String name, double avgNormPct) {
            this.name = name;
            this.avgNormPct = avgNormPct;
        }
    }
}
