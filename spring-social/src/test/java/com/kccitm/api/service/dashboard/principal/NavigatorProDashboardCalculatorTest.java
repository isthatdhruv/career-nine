package com.kccitm.api.service.dashboard.principal;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProBlend;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProCalculationService.Evaluation;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProNorms;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProScores;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredRoster;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredStudent;

/**
 * The Navigator Pro college dashboard aggregation, driven from hand-built evaluations so
 * every expected count can be read off the fixture.
 */
class NavigatorProDashboardCalculatorTest {

    private final NavigatorProConstructMap map = new NavigatorProConstructMap();
    private final NavigatorProBlend blend = new NavigatorProBlend();
    private final NavigatorProDashboardCalculator calculator = new NavigatorProDashboardCalculator(map);

    private ScoredRoster roster;
    private final Set<Long> counselled = new HashSet<>();

    @BeforeEach
    void setUp() {
        roster = new ScoredRoster();
        roster.instituteCode = 7;
        roster.instituteName = "Demo Engineering College";
        roster.assessmentId = 84L;
        roster.assessmentName = "Navigator Pro";
        roster.engineCode = PrincipalDashboardData.ENGINE_NAVIGATOR_PRO;
    }

    // ───────────────────────────── fixture ─────────────────────────────

    /** A delivered student: families lean Analytical, exposure highest in Software Development. */
    private Student student(long id, double will, double skill) {
        return new Student(id, will, skill);
    }

    private final class Student {
        final NavigatorProScores s = new NavigatorProScores();
        final long id;
        String gate;
        boolean banner;
        Long sectionId;

        Student(long id, double will, double skill) {
            this.id = id;
            s.index.put("drive", will);
            s.index.put("skill", skill);
            s.index.put("foundation", 60.0);
            for (String f : NavigatorProConstructMap.FACTOR_KEYS) s.index.put(f, 50.0);
            for (String k : NavigatorProConstructMap.SUB_KEYS) s.index.put(k, 60.0);
            for (String f : NavigatorProConstructMap.FAMILY_KEYS) s.index.put(f, 30.0);
            s.index.put("fam_i", 80.0);
            s.index.put("fam_r", 70.0);
            for (String d : NavigatorProConstructMap.DOMAIN_KEYS) s.index.put(d, 0.0);
            s.index.put("d_sd", 100.0);
            for (String c : NavigatorProConstructMap.CHECK_KEYS) s.checks.put(c, true);
            s.reasoning = 5;
            s.topFamily = "fam_i";
            s.secondFamily = "fam_r";
            s.values.addAll(List.of("Autonomy", "Learning", "Curiosity", "Stability"));
            s.attentionPassed = true;
        }

        Student set(String key, double v) { s.index.put(key, v); return this; }
        Student reasoning(int r) { s.reasoning = r; return this; }
        Student failCheck(String key) { s.checks.put(key, false); return this; }
        Student held(String code) { gate = code; return this; }
        Student flagged() { banner = true; return this; }
        Student aspire(String... domains) { s.aspirations.addAll(List.of(domains)); return this; }
        Student section(long sectionId) { this.sectionId = sectionId; return this; }

        void add() {
            NavigatorProBlend.Result b = blend.compute(s, map, 3, 5, 75);
            boolean trackA = s.get("fam_r") < 50 && s.get("fam_i") < 50;
            Evaluation ev = new Evaluation(id, s, gate, gate == null ? null : "held for test", b, banner, trackA);
            ScoredStudent entry = new ScoredStudent();
            entry.userStudentId = id;
            entry.status = "completed";
            entry.sectionId = sectionId;
            entry.pro = ev;
            roster.students.add(entry);
        }
    }

    private void notStarted(long id) {
        ScoredStudent entry = new ScoredStudent();
        entry.userStudentId = id;
        entry.status = "notStarted";
        roster.students.add(entry);
    }

    private ReleaseSnapshot snapshot() {
        return new ReleaseSnapshot(roster, null, ReleaseSnapshot.InstituteProfile.unknown(),
                null, null, counselled);
    }

    private Map<String, Object> computeInstitute() {
        return calculator.compute(snapshot(), ScopeKey.institute(84L)).payload;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> m(Object o) {
        return (Map<String, Object>) o;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object o) {
        return (List<Map<String, Object>>) o;
    }

    private static Map<String, Object> byKey(List<Map<String, Object>> rows, String field, Object value) {
        for (Map<String, Object> r : rows) if (value.equals(r.get(field))) return r;
        throw new AssertionError("no row with " + field + "=" + value);
    }

    // ───────────────────────────── tests ─────────────────────────────

    @Test
    void basesSeparateAssessedEvaluatedAndDelivered() {
        student(1, 80, 80).add();
        student(2, 80, 20).add();
        student(3, 30, 30).held("R1").add();
        student(4, 30, 30).held("R5").add();
        notStarted(5);

        PrincipalDashboardScopeCalculator.ScopeResult result =
                calculator.compute(snapshot(), ScopeKey.institute(84L));
        Map<String, Object> overview = m(result.payload.get("overview"));

        assertThat(result.scoredCount).isEqualTo(4);
        assertThat(result.totalCount).isEqualTo(5);
        assertThat(overview.get("mapped")).isEqualTo(5);
        assertThat(overview.get("assessed")).isEqualTo(4);
        assertThat(overview.get("evaluated")).isEqualTo(4);
        assertThat(overview.get("delivered")).isEqualTo(2);
        assertThat(overview.get("held")).isEqualTo(2);
        assertThat(m(overview.get("heldByGate"))).containsEntry("R1", 1).containsEntry("R5", 1);
        // Zones count delivered reports only.
        assertThat(m(result.payload.get("zones")).get("base")).isEqualTo(2);
    }

    @Test
    void zonesUseTheAssessmentNormsCutLines() {
        // Provisional norms (n < 60) cut at 50/50, exactly as each student's report does.
        List<NavigatorProNorms.Member> members = new ArrayList<>();
        members.add(new NavigatorProNorms.Member(1, Map.of("drive", 90.0, "skill", 90.0)));
        roster.proNorms = NavigatorProNorms.build(members, 30, 60);

        student(1, 60, 60).add();   // ready
        student(2, 60, 40).add();   // motivated
        student(3, 40, 60).add();   // capable
        student(4, 40, 40).add();   // support
        student(5, 50, 50).add();   // at the cut counts as high → ready

        Map<String, Object> zones = m(computeInstitute().get("zones"));
        List<Map<String, Object>> counts = list(zones.get("counts"));
        assertThat(byKey(counts, "key", "ready").get("count")).isEqualTo(2);
        assertThat(byKey(counts, "key", "motivated").get("count")).isEqualTo(1);
        assertThat(byKey(counts, "key", "capable").get("count")).isEqualTo(1);
        assertThat(byKey(counts, "key", "support").get("count")).isEqualTo(1);
        assertThat(list(zones.get("points"))).hasSize(5);

        Map<String, Object> norms = m(computeInstitute().get("norms"));
        assertThat(norms.get("willMedian")).isEqualTo(50);
        assertThat(norms.get("provisional")).isEqualTo(true);
    }

    @Test
    void attentionQueuePrioritisesHeldAndFlaggedFirst() {
        roster.proNorms = NavigatorProNorms.build(List.of(), 30, 60);
        student(1, 80, 80).add();                                   // no attention
        student(2, 80, 80).flagged().add();                         // P1 flagged
        student(3, 30, 30).held("R3").add();                        // P1 held
        student(4, 20, 20).set("foundation", 20).add();             // P2 support + weak foundation
        student(5, 20, 70).add();                                   // P3 disengaged
        student(6, 80, 80).reasoning(1).add();                      // P3 low logic
        counselled.add(3L);

        Map<String, Object> attention = m(computeInstitute().get("attention"));
        List<Map<String, Object>> items = list(attention.get("items"));

        assertThat(attention.get("p1")).isEqualTo(2);
        assertThat(attention.get("p2")).isEqualTo(1);
        assertThat(attention.get("p3")).isEqualTo(2);
        assertThat(items).extracting(i -> i.get("id")).containsExactly(2L, 3L, 4L, 5L, 6L);
        assertThat(byKey(items, "id", 3L).get("counselled")).isEqualTo(true);
        assertThat(m(attention.get("byReason")))
                .containsEntry("flagged", 1).containsEntry("held_weak_peak", 1)
                .containsEntry("support_low_foundation", 1).containsEntry("disengaged", 1)
                .containsEntry("low_reasoning", 1);
        // 2 × 60 + 1 × 30 + 2 × 15 minutes
        assertThat(attention.get("minutesEstimate")).isEqualTo(180);
        assertThat(attention.get("hoursEstimate")).isEqualTo(3.0);
    }

    @Test
    void improvementCountsChecksReasoningAndWeakestHabit() {
        student(1, 60, 60).failCheck("chk_spr").reasoning(4).set("fs_ci", 20).add();
        student(2, 60, 60).failCheck("chk_spr").failCheck("chk_src").reasoning(3).set("fs_ci", 30).add();
        student(3, 60, 60).reasoning(5).set("fs_di", 10).add();

        Map<String, Object> imp = m(computeInstitute().get("improvement"));
        List<Map<String, Object>> checks = list(imp.get("checks"));
        // Sorted weakest first.
        assertThat(checks.get(0).get("key")).isEqualTo("chk_spr");
        assertThat(checks.get(0).get("passed")).isEqualTo(1);
        assertThat(checks.get(0).get("pct")).isEqualTo(33);
        assertThat(imp.get("reasoningDistribution")).isEqualTo(List.of(0, 0, 0, 1, 1, 1));
        assertThat(imp.get("avgReasoning")).isEqualTo(4.0);

        List<Map<String, Object>> habits = list(imp.get("habits"));
        assertThat(byKey(habits, "key", "fs_ci").get("lowestFor")).isEqualTo(2);
        assertThat(byKey(habits, "key", "fs_di").get("lowestFor")).isEqualTo(1);
        assertThat(byKey(habits, "key", "fs_ci").get("red")).isEqualTo(2);
    }

    @Test
    void directionsCountBestFitHandsOnAndAmbitionGap() {
        student(1, 60, 60).aspire("d_sd").add();       // aspiration inside top three → matched
        student(2, 60, 60).aspire("d_cs").add();       // Civil, far from Software → mismatched
        student(3, 60, 60).add();                      // no aspiration

        Map<String, Object> dir = m(computeInstitute().get("directions"));
        List<Map<String, Object>> fields = list(dir.get("fields"));
        Map<String, Object> top = fields.get(0);
        assertThat(top.get("key")).isEqualTo("d_sd");
        assertThat(top.get("bestFit")).isEqualTo(3);
        assertThat(top.get("handsOn")).isEqualTo(3);
        assertThat(byKey(fields, "key", "d_cs").get("aspiring")).isEqualTo(1);

        Map<String, Object> ambition = m(dir.get("ambitionVsFit"));
        assertThat(ambition.get("matched")).isEqualTo(1);
        assertThat(ambition.get("mismatched")).isEqualTo(1);
        assertThat(ambition.get("noAspiration")).isEqualTo(1);

        List<Map<String, Object>> industry = list(computeInstitute().get("industry"));
        assertThat(industry.get(0).get("label")).isEqualTo("Software Development");
        assertThat((List<?>) industry.get(0).get("internships")).isNotEmpty();
        assertThat((List<?>) industry.get(0).get("organisations")).isNotEmpty();
        assertThat(industry.get(0).get("copyDraft")).isEqualTo(false);
    }

    @Test
    void valuesCountTopFourAndRankOne() {
        student(1, 60, 60).add();
        student(2, 60, 60).add();

        List<Map<String, Object>> values = list(computeInstitute().get("values"));
        assertThat(values).hasSize(12);
        Map<String, Object> autonomy = byKey(values, "tag", "Autonomy");
        assertThat(autonomy.get("topFour")).isEqualTo(2);
        assertThat(autonomy.get("rankOne")).isEqualTo(2);
        assertThat(values.get(0).get("tag")).isEqualTo("Autonomy");
        assertThat(byKey(values, "tag", "Pay & benefits").get("topFour")).isEqualTo(0);
    }

    @Test
    void sheetsSentToTheModelCarryNoStudentLevelData() throws Exception {
        student(1, 60, 60).flagged().add();
        student(2, 30, 30).held("R1").add();

        PrincipalDashboardScopeCalculator.ScopeResult result =
                calculator.compute(snapshot(), ScopeKey.institute(84L));

        assertThat(result.sheets).doesNotContainKeys("students", "provenance");
        assertThat(m(result.sheets.get("zones"))).doesNotContainKey("points");
        assertThat(m(result.sheets.get("attention"))).doesNotContainKey("items");
        // The full payload still holds them for the page.
        assertThat(list(result.payload.get("students"))).hasSize(2);

        String json = new ObjectMapper().writeValueAsString(result.sheets);
        assertThat(json).doesNotContain("\"id\":1").doesNotContain("\"id\":2");
    }

    @Test
    void sectionScopeAggregatesOnlyItsStudents() {
        student(1, 80, 80).section(10).add();
        student(2, 20, 20).section(10).add();
        student(3, 80, 80).section(11).add();

        Map<String, Object> payload = calculator.compute(snapshot(),
                ScopeKey.section(84L, null, null, 10L)).payload;
        assertThat(m(payload.get("overview")).get("delivered")).isEqualTo(2);
        assertThat(list(payload.get("students"))).extracting(r -> r.get("id")).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void actionsNameTheOwnerAndCarryNumbers() {
        roster.proNorms = NavigatorProNorms.build(List.of(), 30, 60);
        student(1, 80, 20).failCheck("chk_spr").add();
        student(2, 80, 20).failCheck("chk_spr").add();
        student(3, 30, 30).held("R1").add();

        Map<String, Object> actions = m(computeInstitute().get("actions"));
        List<Map<String, Object>> exec = list(actions.get("exec"));
        assertThat(exec).extracting(a -> a.get("owner"))
                .contains(NavigatorProDashboardCalculator.OWNER_COUNSELLORS,
                        NavigatorProDashboardCalculator.OWNER_ACADEMICS,
                        NavigatorProDashboardCalculator.OWNER_PLACEMENT);
        assertThat(exec).extracting(a -> (String) a.get("text"))
                .anyMatch(t -> t.contains("1 priority-1 student"))
                .anyMatch(t -> t.contains("2 driven-but-under-skilled"))
                .anyMatch(t -> t.contains("spreadsheet logic lab") && t.contains("0%"));
    }

    @Test
    void emptyScopeProducesZeroesNotErrors() {
        notStarted(1);
        Map<String, Object> payload = computeInstitute();
        assertThat(m(payload.get("overview")).get("delivered")).isEqualTo(0);
        assertThat(m(payload.get("actions"))).isEmpty();
        assertThat(new LinkedHashMap<>(m(payload.get("zones")))).containsEntry("base", 0);
    }
}
