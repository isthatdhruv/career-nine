package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/** Golden values hand-computed from Core_Algorithm_Weightages.xlsx sheets 2–5. */
class NavigatorProBlendTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();
    private final NavigatorProBlend blend = new NavigatorProBlend();

    private static NavigatorProScores scores(Map<String, Double> families, double exposureAll, String... values) {
        NavigatorProScores s = new NavigatorProScores();
        for (String f : NavigatorProConstructMap.FAMILY_KEYS) s.index.put(f, families.getOrDefault(f, 0.0));
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) s.index.put(d, exposureAll);
        s.values.addAll(List.of(values));
        return s;
    }

    private NavigatorProBlend.Result compute(NavigatorProScores s) {
        return blend.compute(s, map, 3, 5, 75);
    }

    @Test
    void matricesCoverEveryDomainAndFamily() {
        blend.validateAgainst(map);
        assertThat(blend.valueTags()).hasSize(12).contains("Pay & benefits", "Influence");
        assertThat(blend.weightInterest() + blend.weightExposure() + blend.weightValues()).isEqualTo(1.0);
        assertThat(blend.weightInterest()).isEqualTo(0.40);
        assertThat(blend.weightValues()).isEqualTo(0.20);
    }

    /** Tech Spec v3 §9 VALUES fixture: Pay #1, Autonomy #2, Learning #3, Stability #4. */
    @Test
    void valuesGolden_threeCareersMatchHandComputation() {
        NavigatorProBlend.Result r = compute(scores(Map.of(), 0, "Pay & benefits", "Autonomy", "Learning", "Stability"));
        // Software Development: 4×3 + 3×2 + 2×3 + 1×1 = 25 → 25/30×100
        assertThat(r.valueAlignment.get("d_sd")).isCloseTo(83.333, within(0.1));
        // Power & Energy: 4×1 + 3×0 + 2×1 + 1×3 = 9 → 30
        assertThat(r.valueAlignment.get("d_pe")).isCloseTo(30.0, within(0.1));
        // Technical Business & Consulting: 4×3 + 3×1 + 2×2 + 1×1 = 20 → 66.67
        assertThat(r.valueAlignment.get("d_tb")).isCloseTo(66.667, within(0.1));
    }

    /** Core Algorithm sheet 5 worked example, Software Development. */
    @Test
    void workedExample_softwareDevelopment() {
        NavigatorProScores s = scores(Map.of("fam_r", 40.0, "fam_i", 86.0, "fam_a", 50.0, "fam_s", 33.0,
                "fam_e", 50.0, "fam_c", 67.0), 0);
        s.index.put("d_sd", 75.0);
        NavigatorProBlend.Result r = compute(s);
        // InterestFit = (1×40 + 3×86 + 2×67) / (1+3+2) = 432/6 = 72
        assertThat(r.interestFit.get("d_sd")).isCloseTo(72.0, within(1e-9));
        assertThat(r.exposure.get("d_sd")).isEqualTo(75.0);
        // with no values ranked: .4×72 + .4×75 + .2×0
        assertThat(r.careerScore.get("d_sd")).isCloseTo(58.8, within(1e-9));
    }

    @Test
    void allTwelveRanked_bestFirst_tiesInDomainOrder() {
        NavigatorProBlend.Result r = compute(scores(Map.of("fam_r", 100.0), 0));
        assertThat(r.ranking).hasSize(12).doesNotHaveDuplicates();
        for (int i = 1; i < 12; i++) assertThat(r.score(i)).isGreaterThanOrEqualTo(r.score(i + 1));
        // Hands-on weight 3 careers lead; Electronics precedes Power precedes Mechanical precedes Civil on the tie.
        assertThat(r.ranking.subList(0, 4)).containsExactly("d_ee", "d_pe", "d_md", "d_cs");
    }

    @Test
    void flatEverything_isExplorerAndTie() {
        NavigatorProScores s = scores(Map.of("fam_r", 50.0, "fam_i", 50.0, "fam_a", 50.0, "fam_s", 50.0,
                "fam_e", 50.0, "fam_c", 50.0), 33.33);
        NavigatorProBlend.Result r = compute(s);
        assertThat(r.spread13).isZero();
        assertThat(r.maxExposure).isCloseTo(33.33, within(1e-9));
        assertThat(r.explorer).isTrue();
        assertThat(r.tie).isTrue();
    }

    @Test
    void oneDomainDoneOnTheirOwn_isNotExplorer() {
        NavigatorProScores s = scores(Map.of("fam_r", 50.0, "fam_i", 50.0, "fam_a", 50.0, "fam_s", 50.0,
                "fam_e", 50.0, "fam_c", 50.0), 33.33);
        s.index.put("d_md", 100.0);
        NavigatorProBlend.Result r = compute(s);
        assertThat(r.explorer).isFalse();
        assertThat(r.ranking.get(0)).isEqualTo("d_md");
        assertThat(r.gap12).isCloseTo(0.4 * (100 - 33.33), within(1e-9));
        assertThat(r.tie).isFalse();
    }

    @Test
    void sectorRecipes_areWeightedAveragesOfCareerScores() {
        NavigatorProBlend.Result r = compute(scores(Map.of("fam_r", 100.0), 0));
        double ev = 0.40 * r.careerScore.get("d_md") + 0.30 * r.careerScore.get("d_ee")
                + 0.20 * r.careerScore.get("d_pe") + 0.10 * r.careerScore.get("d_sd");
        assertThat(r.sectors.get("EV & Automotive")).isCloseTo(ev, within(1e-9));
        assertThat(r.sectors).containsKeys("Bioengineering", "Space Engineering", "Semiconductor");
    }

    @Test
    void unknownValueTag_isAHardFailure() {
        assertThatThrownBy(() -> compute(scores(Map.of(), 0, "Growth", "Autonomy", "Learning", "Stability")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Growth");
        assertThat(blend.knowsValueTag("growth")).isFalse();
        assertThat(blend.knowsValueTag(" pay & benefits ")).isTrue();
    }

    @Test
    void rejectsWeightsThatDoNotSumToOne() {
        String json = "{\"weights\":{\"interest\":0.5,\"exposure\":0.4,\"values\":0.2}}";
        assertThatThrownBy(() -> new NavigatorProBlend(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("sum to 1");
    }
}
