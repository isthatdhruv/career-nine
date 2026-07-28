package com.kccitm.api.service.dashboard.cohort;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;

/**
 * PLACEHOLDER v0 aggregator. Produces a minimal but real payload (student count +
 * per-dimension average RIASEC normPct) purely to prove the end-to-end pipeline.
 * Replace with the real Navigator-360-style cohort logic later (new @Component with
 * @Primary, or swap this class) and bump LOGIC_VERSION.
 */
@Component
public class PlaceholderCohortInsightAggregator implements CohortInsightAggregator {

    public static final String LOGIC_VERSION = "placeholder-v0";

    @Override
    public String logicVersion() {
        return LOGIC_VERSION;
    }

    @Override
    public CohortInsightPayload aggregate(Long instituteCode, Long assessmentId, List<Navigator360Result> perStudent) {
        CohortInsightPayload payload = new CohortInsightPayload();
        payload.logicVersion = LOGIC_VERSION;
        payload.studentCount = perStudent == null ? 0 : perStudent.size();
        payload.note = "Placeholder cohort aggregation. Real cohort formulas not yet implemented.";

        if (perStudent == null || perStudent.isEmpty()) {
            return payload;
        }

        // Average normPct per RIASEC dimension name across all students who have that dimension.
        Map<String, double[]> sums = new LinkedHashMap<>(); // name -> [sum, count]
        for (Navigator360Result r : perStudent) {
            if (r == null || r.riasec == null) {
                continue;
            }
            for (ScoredDimension d : r.riasec) {
                if (d == null || d.name == null) {
                    continue;
                }
                double[] acc = sums.computeIfAbsent(d.name, k -> new double[2]);
                acc[0] += d.normPct;
                acc[1] += 1;
            }
        }

        List<CohortInsightPayload.CohortDimension> avgs = new ArrayList<>();
        for (Map.Entry<String, double[]> e : sums.entrySet()) {
            double count = e.getValue()[1];
            double avg = count == 0 ? 0.0 : e.getValue()[0] / count;
            avgs.add(new CohortInsightPayload.CohortDimension(e.getKey(), avg));
        }
        payload.riasecAverage = avgs;
        return payload;
    }
}
