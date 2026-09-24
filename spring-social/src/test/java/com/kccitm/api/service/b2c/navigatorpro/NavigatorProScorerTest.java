package com.kccitm.api.service.b2c.navigatorpro;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class NavigatorProScorerTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();
    private final NavigatorProScorer scorer = new NavigatorProScorer(map, 10.0);

    /** Mutable fixture: rows + the expected question ids per construct. */
    private static final class Fx {
        final List<Contribution> rows = new ArrayList<>();
        final Map<String, Set<Long>> expected = new HashMap<>();
        final List<ValueRank> values = new ArrayList<>();
        long nextQ = 1;

        /** One question per score under {@code construct}; registers each question id as expected. */
        void add(String construct, int... scores) {
            for (int sc : scores) {
                long q = nextQ++;
                rows.add(new Contribution(construct, q, sc));
                expected.computeIfAbsent(construct, k -> new HashSet<>()).add(q);
            }
        }

        /** Fill every construct with one score per question, repeated per scale. */
        void fillAll(int agree, int freq, int mcq, int intensity, int yes, int validity, int attention) {
            for (String k : NavigatorProConstructMap.FACTOR_KEYS) add(k, repeat(agree, k.equals("f_st") ? 3 : 4));
            add(NavigatorProConstructMap.VALIDITY, repeat(validity, 3));
            add(NavigatorProConstructMap.ATTENTION, attention);
            for (String k : NavigatorProConstructMap.FAMILY_KEYS) add(k, repeat(yes, 6));
            for (String k : NavigatorProConstructMap.SUB_KEYS) add(k, repeat(freq, k.equals("fs_tp") ? 6 : 4));
            for (String k : NavigatorProConstructMap.CHECK_KEYS) add(k, mcq);
            for (String k : NavigatorProConstructMap.DOMAIN_KEYS) add(k, intensity);
            rank("Pay & benefits", "Autonomy", "Learning", "Stability");
        }

        void rank(String... tags) {
            for (int i = 0; i < tags.length; i++) values.add(new ValueRank(i + 1, tags[i], "opt " + tags[i]));
        }

        static int[] repeat(int v, int n) { int[] a = new int[n]; java.util.Arrays.fill(a, v); return a; }
    }

    private NavigatorProScores score(Fx fx) {
        return scorer.score(fx.rows, fx.values, fx.expected);
    }

    @Test
    void maxFixture_scoresEverythingAtHundred() {
        Fx fx = new Fx();
        fx.fillAll(5, 4, 1, 4, 1, 1, 1);   // exposure max is "Did it on my own" = 4
        NavigatorProScores s = score(fx);
        assertThat(s.get("f_id")).isEqualTo(100.0);
        assertThat(s.get("f_st")).isEqualTo(100.0);
        assertThat(s.get("f_ae")).isEqualTo(100.0);
        assertThat(s.get("drive")).isEqualTo(100.0);
        assertThat(s.get("foundation")).isEqualTo(100.0);
        assertThat(s.get("fs_tp")).isEqualTo(100.0);
        assertThat(s.reasoning).isEqualTo(5);
        assertThat(s.get("skill")).isEqualTo(100.0);
        assertThat(s.get("d_pe")).isEqualTo(100.0);
        assertThat(s.get("fam_r")).isEqualTo(100.0);
        assertThat(s.validityFlags).isZero();
        assertThat(s.attentionPassed).isTrue();
        assertThat(s.incomplete).isEmpty();
    }

    @Test
    void minFixture_scoresEverythingAtZero() {
        Fx fx = new Fx();
        fx.fillAll(1, 1, 0, 1, 0, 1, 1);
        NavigatorProScores s = score(fx);
        assertThat(s.get("drive")).isZero();
        assertThat(s.get("foundation")).isZero();
        assertThat(s.get("fs_gd")).isZero();
        assertThat(s.reasoning).isZero();
        assertThat(s.checks.values()).containsOnly(false);
        assertThat(s.get("skill")).isZero();
        assertThat(s.get("fam_c")).isZero();
        assertThat(s.maxFamily()).isZero();
        assertThat(s.maxDomain()).isZero();
    }

    @Test
    void reverseItem_isJustItsStoredScore_andDriveIsTheUnionOfFactorRows() {
        Fx fx = new Fx();
        fx.add("f_id", 4, 4, 4, 4);   // Σ16 → (16−4)/16 = 75
        fx.add("f_st", 5, 4, 2);      // Σ11 → (11−3)/12 = 66.67
        fx.add("f_ae", 5, 5, 1, 5);   // reverse item stored 1 → Σ16 → 75
        NavigatorProScores s = score(fx);
        assertThat(s.get("f_id")).isEqualTo(75.0);
        assertThat(s.get("f_st")).isCloseTo(66.667, within(0.01));
        assertThat(s.get("f_ae")).isEqualTo(75.0);
        assertThat(s.get("drive")).isCloseTo((43 - 11) * 100.0 / 44, within(0.0001));
    }

    @Test
    void validityFlags_countRowsAtFourOrAbove() {
        Fx a = new Fx(); a.add(NavigatorProConstructMap.VALIDITY, 4, 5, 1);
        assertThat(score(a).validityFlags).isEqualTo(2);
        Fx b = new Fx(); b.add(NavigatorProConstructMap.VALIDITY, 2, 2, 5);
        assertThat(score(b).validityFlags).isEqualTo(1);
        Fx c = new Fx(); c.add(NavigatorProConstructMap.VALIDITY, 3, 3, 3);
        assertThat(score(c).validityFlags).isZero();
    }

    @Test
    void attention_passesOnlyOnScoreOne() {
        Fx yes = new Fx(); yes.add(NavigatorProConstructMap.ATTENTION, 0);
        assertThat(score(yes).attentionPassed).isFalse();
        Fx no = new Fx(); no.add(NavigatorProConstructMap.ATTENTION, 1);
        assertThat(score(no).attentionPassed).isTrue();
        assertThat(score(new Fx()).attentionPassed).isFalse();
    }

    @Test
    void families_shapeIsDifferentiatedWhenGapReachesTen() {
        Fx fx = new Fx();
        fx.add("fam_r", 1, 1, 1, 1, 1, 0);   // 83.3
        fx.add("fam_i", 1, 1, 1, 0, 0, 0);   // 50
        fx.add("fam_a", 1, 1, 0, 0, 0, 0);
        fx.add("fam_s", 1, 1, 0, 0, 0, 0);
        fx.add("fam_e", 1, 1, 1, 0, 0, 0);
        fx.add("fam_c", 1, 0, 0, 0, 0, 0);
        NavigatorProScores s = score(fx);
        assertThat(s.topFamily).isEqualTo("fam_r");
        assertThat(s.secondFamily).isEqualTo("fam_i");
        assertThat(s.flat).isFalse();
        assertThat(s.maxFamily()).isCloseTo(83.333, within(0.01));
    }

    @Test
    void families_shapeIsFlatOnTie() {
        Fx fx = new Fx();
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) fx.add(k, 1, 1, 1, 0, 0, 0);
        assertThat(score(fx).flat).isTrue();
    }

    @Test
    void subDomains_useTheirOwnK() {
        Fx fx = new Fx();
        fx.add("fs_nd", 4, 4, 3, 2);            // Σ13 → (13−4)/12 = 75
        fx.add("fs_tp", 4, 4, 3, 3, 3, 2);      // Σ19 → (19−6)/18 = 72.2
        NavigatorProScores s = score(fx);
        assertThat(s.get("fs_nd")).isEqualTo(75.0);
        assertThat(s.get("fs_tp")).isCloseTo(72.222, within(0.01));
    }

    @Test
    void reasoning_countsCorrectChecksAndReportsEachChip() {
        Fx fx = new Fx();
        fx.add("chk_num", 1); fx.add("chk_dat", 1); fx.add("chk_cau", 1); fx.add("chk_src", 1); fx.add("chk_spr", 0);
        NavigatorProScores s = score(fx);
        assertThat(s.reasoning).isEqualTo(4);
        assertThat(s.checks.get("chk_spr")).isFalse();
        assertThat(s.checks.get("chk_num")).isTrue();
    }

    @Test
    void domains_fourPointExposureAndSkillIndex() {
        Fx fx = new Fx();
        int[] m = {4, 3, 2, 1, 2, 3, 3, 4, 2, 1, 3, 2}; // Σ30 → (30−12)/36 = 50
        int i = 0;
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) fx.add(k, m[i++]);
        NavigatorProScores s = score(fx);
        assertThat(s.get("d_sd")).isEqualTo(100.0);                          // (4−1)/3
        assertThat(s.get("d_da")).isCloseTo(66.667, within(0.01));           // (3−1)/3
        assertThat(s.get("d_si")).isCloseTo(33.333, within(0.01));
        assertThat(s.get("d_cy")).isZero();
        assertThat(s.get("skill")).isEqualTo(50.0);
        assertThat(s.maxDomain()).isEqualTo(100.0);
    }

    @Test
    void incomplete_listsSkippedAndDuplicatedQuestions() {
        Fx fx = new Fx();
        fx.rank("Pay & benefits", "Autonomy", "Learning", "Stability");
        fx.add("f_id", 4, 4, 4, 4);
        long skipped = 99L;
        fx.expected.get("f_id").add(skipped);                       // expected but never answered
        fx.rows.add(new Contribution("f_id", 1L, 4));               // question 1 answered twice
        NavigatorProScores s = score(fx);
        assertThat(s.incomplete).containsExactlyInAnyOrder("f_id:99:missing", "f_id:1:duplicate");
    }

    @Test
    void values_orderedByRankAndFewerThanFourIsIncomplete() {
        Fx fx = new Fx();
        fx.values.add(new ValueRank(3, "Learning", "c"));
        fx.values.add(new ValueRank(1, "Pay & benefits", "a"));
        fx.values.add(new ValueRank(4, "Stability", "d"));
        fx.values.add(new ValueRank(2, "Autonomy", "b"));
        NavigatorProScores s = score(fx);
        assertThat(s.values).containsExactly("Pay & benefits", "Autonomy", "Learning", "Stability");
        assertThat(s.valueOptions).containsExactly("a", "b", "c", "d");
        assertThat(s.valuesMissing).isFalse();
        assertThat(s.incomplete).isEmpty();

        Fx three = new Fx();
        three.rank("Pay & benefits", "Autonomy", "Learning");
        NavigatorProScores t = score(three);
        assertThat(t.valuesMissing).isTrue();
        assertThat(t.incomplete).containsExactly("values:ranked:3");        // Tech Spec v3 §3: <4 ranks = R5
    }

    @Test
    void aspirations_arePassedThroughUnscored() {
        Fx fx = new Fx();
        fx.fillAll(3, 2, 1, 2, 1, 1, 1);
        NavigatorProScores s = scorer.score(fx.rows, fx.values, java.util.List.of("d_ee", "d_pe"), fx.expected);
        assertThat(s.aspirations).containsExactly("d_ee", "d_pe");
        assertThat(s.get("d_ee")).isCloseTo(33.333, within(0.01));           // exposure untouched by the pick
    }
}
