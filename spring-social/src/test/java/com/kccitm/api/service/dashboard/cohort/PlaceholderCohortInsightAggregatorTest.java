package com.kccitm.api.service.dashboard.cohort;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;

class PlaceholderCohortInsightAggregatorTest {

    private Navigator360Result studentWithRiasec(double realisticPct, double investigativePct) {
        Navigator360Result r = new Navigator360Result();
        ScoredDimension realistic = new ScoredDimension();
        realistic.name = "Realistic";
        realistic.normPct = realisticPct;
        ScoredDimension investigative = new ScoredDimension();
        investigative.name = "Investigative";
        investigative.normPct = investigativePct;
        r.riasec = new ArrayList<>(Arrays.asList(realistic, investigative));
        return r;
    }

    @Test
    void aggregatesStudentCountAndAveragesRiasecByDimensionName() {
        PlaceholderCohortInsightAggregator agg = new PlaceholderCohortInsightAggregator();
        List<Navigator360Result> students = Arrays.asList(
                studentWithRiasec(40.0, 60.0),
                studentWithRiasec(60.0, 80.0));

        CohortInsightPayload payload = agg.aggregate(1L, 5L, students);

        assertThat(payload.studentCount).isEqualTo(2);
        assertThat(payload.logicVersion).isEqualTo(agg.logicVersion());
        assertThat(payload.riasecAverage)
                .extracting(d -> d.name)
                .containsExactlyInAnyOrder("Realistic", "Investigative");
        CohortInsightPayload.CohortDimension realistic = payload.riasecAverage.stream()
                .filter(d -> d.name.equals("Realistic")).findFirst().orElseThrow(AssertionError::new);
        assertThat(realistic.avgNormPct).isEqualTo(50.0); // (40 + 60) / 2
    }

    @Test
    void emptyCohortProducesZeroCountAndEmptyAverages() {
        PlaceholderCohortInsightAggregator agg = new PlaceholderCohortInsightAggregator();
        CohortInsightPayload payload = agg.aggregate(1L, 5L, new ArrayList<>());
        assertThat(payload.studentCount).isEqualTo(0);
        assertThat(payload.riasecAverage).isEmpty();
    }
}
