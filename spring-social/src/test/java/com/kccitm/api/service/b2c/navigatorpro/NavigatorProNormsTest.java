package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NavigatorProNormsTest {

    private static NavigatorProNorms.Member member(long id, double drive, double skill) {
        return new NavigatorProNorms.Member(id, Map.of(
                "drive", drive, "f_id", drive, "f_st", drive, "f_ae", drive,
                "foundation", skill, "skill", skill, "reasoning", 3.0));
    }

    private static List<NavigatorProNorms.Member> cohort(int n) {
        List<NavigatorProNorms.Member> m = new ArrayList<>();
        for (int i = 0; i < n; i++) m.add(member(i, 10 + i, 90 - i));
        return m;
    }

    @Test
    void percentileRank_usesMidrankOnTies() {
        double[] sorted = {10, 20, 20, 30};
        assertThat(NavigatorProNorms.percentileRank(sorted, 20)).isEqualTo(50.0);
        assertThat(NavigatorProNorms.percentileRank(sorted, 30)).isEqualTo(87.5);
        assertThat(NavigatorProNorms.percentileRank(sorted, 5)).isZero();
        assertThat(NavigatorProNorms.percentileRank(sorted, 40)).isEqualTo(100.0);
    }

    @Test
    void band_isDecidedOnTheUnroundedPercentile() {
        assertThat(NavigatorProNorms.band(74.9)).isEqualTo("Developing");
        assertThat(NavigatorProNorms.band(75.0)).isEqualTo("Strong");
        assertThat(NavigatorProNorms.band(24.99)).isEqualTo("Early");
        assertThat(NavigatorProNorms.band(25.0)).isEqualTo("Developing");
    }

    @Test
    void rag_usesRawThresholds() {
        assertThat(NavigatorProNorms.ragBand(67)).isEqualTo("Strong");
        assertThat(NavigatorProNorms.ragColour(67)).isEqualTo("green");
        assertThat(NavigatorProNorms.ragBand(66.4)).isEqualTo("Developing");
        assertThat(NavigatorProNorms.ragColour(34)).isEqualTo("amber");
        assertThat(NavigatorProNorms.ragBand(33.9)).isEqualTo("Early");
        assertThat(NavigatorProNorms.ragColour(0)).isEqualTo("red");
    }

    @Test
    void precision_isRoundedHundredOverRootN() {
        assertThat(NavigatorProNorms.precision(84)).isEqualTo(11);
        assertThat(NavigatorProNorms.precision(100)).isEqualTo(10);
        assertThat(NavigatorProNorms.precision(0)).isZero();
    }

    @Test
    void median_ofEvenCountIsMeanOfMiddleTwo() {
        assertThat(NavigatorProNorms.median(new double[]{1, 2, 3, 4})).isEqualTo(2.5);
        assertThat(NavigatorProNorms.median(new double[]{1, 2, 3})).isEqualTo(2.0);
    }

    @Test
    void zone_treatsTheCutAsAbove() {
        assertThat(NavigatorProNorms.zone(50, 50, 50, 50)).isEqualTo("Ready to accelerate");
        assertThat(NavigatorProNorms.zone(60, 40, 50, 50)).isEqualTo("Driven, still building");
        assertThat(NavigatorProNorms.zone(40, 60, 50, 50)).isEqualTo("Skilled, needs a spark");
        assertThat(NavigatorProNorms.zone(40, 40, 50, 50)).isEqualTo("Starting the journey");
    }

    @Test
    void below30_percentilesSuppressedAndProvisionalCuts() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(cohort(29), 30, 60);
        assertThat(n.n).isEqualTo(29);
        assertThat(n.percentilesSuppressed).isTrue();
        assertThat(n.provisional).isTrue();
        assertThat(n.driveCut).isEqualTo(50.0);
        assertThat(n.skillCut).isEqualTo(50.0);
        assertThat(n.percentile("drive", 20)).isNull();
    }

    @Test
    void between30And59_percentilesOnButCutsProvisional() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(cohort(59), 30, 60);
        assertThat(n.percentilesSuppressed).isFalse();
        assertThat(n.provisional).isTrue();
        assertThat(n.driveCut).isEqualTo(50.0);
        assertThat(n.percentile("drive", 10)).isCloseTo(100.0 * 0.5 / 59, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void atLeast60_cutsAreCohortMedians() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(cohort(60), 30, 60);
        assertThat(n.provisional).isFalse();
        assertThat(n.driveCut).isEqualTo(39.5);   // drives 10..69 → median (39+40)/2
        assertThat(n.skillCut).isEqualTo(60.5);   // skills 90..31 → median (60+61)/2
        assertThat(n.prec).isEqualTo(13);          // round(100/√60)
    }

    @Test
    void emptyCohort_isSafe() {
        NavigatorProNorms.NormSet n = NavigatorProNorms.build(List.of(), 30, 60);
        assertThat(n.n).isZero();
        assertThat(n.percentilesSuppressed).isTrue();
        assertThat(n.percentile("skill", 1)).isNull();
    }
}
