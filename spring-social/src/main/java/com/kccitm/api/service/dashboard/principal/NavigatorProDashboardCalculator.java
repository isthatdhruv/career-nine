package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProBlend;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProCalculationService.Evaluation;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProContent;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProNorms;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProScores;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredStudent;

/**
 * The deterministic half of a Navigator Pro college dashboard: one scope's
 * {@code internal_calculation}.
 *
 * <p>The Navigator Pro counterpart of {@link PrincipalDashboardScopeCalculator}. It reads
 * the per-student {@link Evaluation}s the release snapshot already holds — the same
 * evaluation each student's own report was generated from — and aggregates them. Nothing
 * is re-scored, and nothing here can disagree with a student's report: the zone, the
 * best-fit direction and the held/flagged status are the report's own.
 *
 * <p><b>Who is counted where.</b> Three bases, never mixed:
 * <ul>
 *   <li><em>assessed</em> — completed the sitting;</li>
 *   <li><em>evaluated</em> — the engine produced an evaluation (held reports included);</li>
 *   <li><em>delivered</em> — passed the gates and received a report. Every batch average,
 *       zone count and direction count is over this base, matching the cohort the norms
 *       are built from. Held students appear only in the attention queue.</li>
 * </ul>
 *
 * <p><b>Identifiable data.</b> The payload carries student ids and numbers, never names.
 * Names are resolved by a separate request when someone opens a student list. The
 * {@link ScopeResult#sheets} view handed to the model drops the per-student arrays
 * entirely — it is counts and averages only.
 *
 * <p>No percentile is ever emitted, as in the student report (v3 rule): medians are the
 * only cohort statistic shown, because they are what cut the zones.
 */
@Service
public class NavigatorProDashboardCalculator {

    /** Bumped when the aggregation changes shape; stamped onto every row. */
    public static final String LOGIC_VERSION = "navpro-dashboard-1";

    private static final int PAYLOAD_VERSION = 1;

    /** Domain exposure at or above this (answered 3 or 4 of 4) counts as "already hands-on". */
    static final int HANDS_ON_CUT = 67;
    /** Foundation below the red/amber line — the report's own RAG cut. */
    static final int LOW_FOUNDATION_CUT = 34;
    /** Will below the red/amber line. */
    static final int LOW_WILL_CUT = 34;
    /** Everyday logic at or below this (of 5) goes on the lab list. */
    static final int LOW_REASONING = 1;

    /** Counsellor minutes per queue priority — the basis of the time estimate. */
    static final int P1_MINUTES = 60;
    static final int P2_MINUTES = 30;
    static final int P3_MINUTES = 15;

    /** Who acts on a recommendation. Also the colour key on the page. */
    public static final String OWNER_ACADEMICS = "Academics";
    public static final String OWNER_PLACEMENT = "Placement cell";
    public static final String OWNER_COUNSELLORS = "Counsellors";
    public static final String OWNER_PRINCIPAL = "Principal";

    /** Zone keys in display order, with the engine's own zone names. */
    static final String[][] ZONES = {
            {"ready", NavigatorProNorms.ZONE_READY},
            {"motivated", NavigatorProNorms.ZONE_MOTIVATED},
            {"capable", NavigatorProNorms.ZONE_CAPABLE},
            {"support", NavigatorProNorms.ZONE_SUPPORT},
    };

    private final NavigatorProConstructMap map;
    private final NavigatorProContent content;

    @Autowired
    public NavigatorProDashboardCalculator(NavigatorProConstructMap map) {
        this(map, NavigatorProContent.defaults());
    }

    NavigatorProDashboardCalculator(NavigatorProConstructMap map, NavigatorProContent content) {
        this.map = map;
        this.content = content;
    }

    // ───────────────────────────── entry point ─────────────────────────────

    public PrincipalDashboardScopeCalculator.ScopeResult compute(ReleaseSnapshot snapshot, ScopeKey scope) {
        List<ScoredStudent> students = snapshot.inScope(scope);
        ReleaseSnapshot.Cohort cohort = ReleaseSnapshot.cohortOf(students);

        List<ScoredStudent> evaluated = new ArrayList<>();
        List<ScoredStudent> delivered = new ArrayList<>();
        for (ScoredStudent s : students) {
            if (s.pro == null) continue;
            evaluated.add(s);
            if (!s.pro.suppressed()) delivered.add(s);
        }

        Cuts cuts = cuts(snapshot.proNorms(), delivered);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("v", PAYLOAD_VERSION);
        payload.put("engine", PrincipalDashboardData.ENGINE_NAVIGATOR_PRO);
        payload.put("scope", PrincipalDashboardScopeCalculator.scopeBlock(snapshot, scope));
        payload.put("assessment", PrincipalDashboardScopeCalculator.assessmentBlock(snapshot));
        payload.put("institute", PrincipalDashboardScopeCalculator.instituteBlock(snapshot));
        Map<String, Object> participation = PrincipalDashboardScopeCalculator.participationBlock(cohort);
        participation.put("evaluated", evaluated.size());
        participation.put("delivered", delivered.size());
        payload.put("participation", participation);

        List<Map<String, Object>> queue = attentionItems(evaluated, cuts, snapshot);

        Map<String, Object> overview = overview(cohort, evaluated, delivered, queue, snapshot);
        Map<String, Object> zones = zones(delivered, cuts);
        Map<String, Object> will = will(delivered, cuts);
        Map<String, Object> personality = personality(delivered);
        Map<String, Object> improvement = improvement(delivered);
        Map<String, Object> directions = directions(delivered);
        List<Map<String, Object>> industry = industry(directions);
        List<Map<String, Object>> values = values(delivered);
        Map<String, Object> attention = attention(queue, delivered);

        payload.put("overview", overview);
        payload.put("norms", normsBlock(snapshot.proNorms(), cuts));
        payload.put("zones", zones);
        payload.put("will", will);
        payload.put("personality", personality);
        payload.put("improvement", improvement);
        payload.put("directions", directions);
        payload.put("industry", industry);
        payload.put("values", values);
        payload.put("attention", attention);
        payload.put("actions", actions(delivered.size(), overview, zones, will, personality, improvement,
                directions, values, attention));
        payload.put("students", studentRows(evaluated, cuts, queue, snapshot));
        payload.put("provenance", provenance(snapshot));

        PrincipalDashboardScopeCalculator.ScopeResult result = new PrincipalDashboardScopeCalculator.ScopeResult();
        result.scoredCount = evaluated.size();
        result.totalCount = cohort.total;
        result.payload = payload;
        result.sheets = sheets(payload);
        return result;
    }

    /**
     * The anonymised view: every aggregate, no per-student array. This is what the model
     * is sent, and what narrowed scopes compare themselves against.
     */
    @SuppressWarnings("unchecked")
    static Map<String, Object> sheets(Map<String, Object> payload) {
        Map<String, Object> sheets = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : payload.entrySet()) {
            switch (e.getKey()) {
                case "students":
                case "provenance":
                case "scope":
                case "institute":
                case "assessment":
                case "v":
                case "engine":
                    continue;
                case "zones": {
                    Map<String, Object> z = new LinkedHashMap<>((Map<String, Object>) e.getValue());
                    z.remove("points");
                    sheets.put("zones", z);
                    continue;
                }
                case "attention": {
                    Map<String, Object> a = new LinkedHashMap<>((Map<String, Object>) e.getValue());
                    a.remove("items");
                    sheets.put("attention", a);
                    continue;
                }
                default:
                    sheets.put(e.getKey(), e.getValue());
            }
        }
        return sheets;
    }

    // ───────────────────────────── cuts ─────────────────────────────

    /** The Will and Skill medians that split the zones. */
    static final class Cuts {
        final double will;
        final double skill;
        final boolean fromNorms;

        Cuts(double will, double skill, boolean fromNorms) {
            this.will = will; this.skill = skill; this.fromNorms = fromNorms;
        }
    }

    /**
     * The assessment's own norms when they exist — the same cut-lines every student's
     * report placed them against. Without norms (no gate-passed student yet) the scope's
     * own medians stand in, so the map still has lines to draw.
     */
    private static Cuts cuts(NavigatorProNorms.NormSet norms, List<ScoredStudent> delivered) {
        if (norms != null) return new Cuts(norms.driveCut, norms.skillCut, true);
        List<Double> w = new ArrayList<>(), k = new ArrayList<>();
        for (ScoredStudent s : delivered) {
            w.add(s.pro.scores.get("drive"));
            k.add(s.pro.scores.get("skill"));
        }
        return new Cuts(median(w, 50), median(k, 50), false);
    }

    private static Map<String, Object> normsBlock(NavigatorProNorms.NormSet norms, Cuts cuts) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("batchN", norms == null ? 0 : norms.n);
        m.put("provisional", norms == null || norms.provisional);
        m.put("willMedian", r(cuts.will));
        m.put("skillMedian", r(cuts.skill));
        m.put("cutsFromNorms", cuts.fromNorms);
        return m;
    }

    private static String zoneOf(Evaluation ev, Cuts cuts) {
        return NavigatorProNorms.zone(ev.scores.get("drive"), ev.scores.get("skill"), cuts.will, cuts.skill);
    }

    private static String zoneKey(String zoneName) {
        for (String[] z : ZONES) if (z[1].equals(zoneName)) return z[0];
        return null;
    }

    // ───────────────────────────── overview ─────────────────────────────

    private Map<String, Object> overview(ReleaseSnapshot.Cohort cohort, List<ScoredStudent> evaluated,
                                         List<ScoredStudent> delivered, List<Map<String, Object>> queue,
                                         ReleaseSnapshot snapshot) {
        Map<String, Integer> heldByGate = new LinkedHashMap<>();
        for (String g : List.of("R1", "R3", "R4", "R5")) heldByGate.put(g, 0);
        int held = 0, flagged = 0, explorers = 0, tied = 0, trackA = 0, mandatory = 0, counselled = 0;
        for (ScoredStudent s : evaluated) {
            Evaluation ev = s.pro;
            if (snapshot.isCounselled(s.userStudentId)) counselled++;
            if (ev.suppressed()) {
                held++;
                heldByGate.merge(ev.gateCode, 1, Integer::sum);
                continue;
            }
            if (ev.banner) flagged++;
            if (ev.explorer()) explorers++;
            if (ev.banner || ev.explorer()) mandatory++;
            if (ev.trackA) trackA++;
            if (!ev.explorer() && ev.blend != null && ev.blend.tie) tied++;
        }
        int p1 = 0;
        for (Map<String, Object> item : queue) if (Integer.valueOf(1).equals(item.get("priority"))) p1++;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mapped", cohort.total);
        m.put("assessed", cohort.completed);
        m.put("evaluated", evaluated.size());
        m.put("delivered", delivered.size());
        m.put("held", held);
        m.put("heldByGate", heldByGate);
        m.put("flagged", flagged);
        m.put("explorers", explorers);
        m.put("tied", tied);
        m.put("trackA", trackA);
        m.put("counsellingMandatory", mandatory);
        m.put("needAttention", queue.size());
        m.put("needPersonFirst", p1);
        m.put("counselled", counselled);
        m.put("completedPct", cohort.completedPct);
        return m;
    }

    // ───────────────────────────── zones ─────────────────────────────

    private Map<String, Object> zones(List<ScoredStudent> delivered, Cuts cuts) {
        Map<String, List<ScoredStudent>> byZone = new LinkedHashMap<>();
        for (String[] z : ZONES) byZone.put(z[0], new ArrayList<>());
        List<Map<String, Object>> points = new ArrayList<>();
        for (ScoredStudent s : delivered) {
            String zone = zoneKey(zoneOf(s.pro, cuts));
            byZone.get(zone).add(s);
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("id", s.userStudentId);
            p.put("will", r(s.pro.scores.get("drive")));
            p.put("skill", r(s.pro.scores.get("skill")));
            p.put("zone", zone);
            points.add(p);
        }

        List<Map<String, Object>> counts = new ArrayList<>();
        for (String[] z : ZONES) {
            List<ScoredStudent> in = byZone.get(z[0]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", z[0]);
            m.put("label", z[1]);
            m.put("count", in.size());
            m.put("pct", pct(in.size(), delivered.size()));
            m.put("avgWill", avgOf(in, "drive"));
            m.put("avgSkill", avgOf(in, "skill"));
            m.put("avgFoundation", avgOf(in, "foundation"));
            m.put("avgReasoning", avgReasoning(in));
            content.zone(z[1]).ifPresent(copy -> {
                m.put("means", copy.means);
                m.put("first", copy.first);
                m.put("todo", copy.todo);
            });
            counts.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("base", delivered.size());
        out.put("counts", counts);
        out.put("points", points);
        return out;
    }

    // ───────────────────────────── will ─────────────────────────────

    /** Batch headline measures and the three factors Will is built from, split by zone. */
    private Map<String, Object> will(List<ScoredStudent> delivered, Cuts cuts) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("base", delivered.size());
        m.put("avgWill", avgOf(delivered, "drive"));
        m.put("avgFoundation", avgOf(delivered, "foundation"));
        m.put("avgSkill", avgOf(delivered, "skill"));
        m.put("avgReasoning", avgReasoning(delivered));

        Map<String, List<ScoredStudent>> byZone = new LinkedHashMap<>();
        for (String[] z : ZONES) byZone.put(z[0], new ArrayList<>());
        for (ScoredStudent s : delivered) byZone.get(zoneKey(zoneOf(s.pro, cuts))).add(s);

        List<Map<String, Object>> factors = new ArrayList<>();
        for (String k : NavigatorProConstructMap.FACTOR_KEYS) {
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("key", k);
            f.put("label", map.label(k));
            f.put("meaning", content.factorLine(k));
            f.put("avg", avgOf(delivered, k));
            f.put("lowCount", countBelow(delivered, k, LOW_WILL_CUT));
            Map<String, Object> zoneAvgs = new LinkedHashMap<>();
            for (String[] z : ZONES) zoneAvgs.put(z[0], avgOf(byZone.get(z[0]), k));
            f.put("byZone", zoneAvgs);
            factors.add(f);
        }
        factors.sort(Comparator.comparingInt(f -> (Integer) f.get("avg")));
        m.put("factors", factors);
        m.put("weakestFactor", factors.isEmpty() ? null : factors.get(0).get("label"));
        return m;
    }

    // ───────────────────────────── personality ─────────────────────────────

    private Map<String, Object> personality(List<ScoredStudent> delivered) {
        List<Map<String, Object>> families = new ArrayList<>();
        int flat = 0, trackA = 0;
        for (ScoredStudent s : delivered) {
            if (s.pro.scores.flat) flat++;
            if (s.pro.trackA) trackA++;
        }
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) {
            int top = 0, high = 0;
            for (ScoredStudent s : delivered) {
                if (k.equals(s.pro.scores.topFamily)) top++;
                if (r(s.pro.scores.get(k)) >= 67) high++;
            }
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("key", k);
            f.put("label", map.label(k));
            f.put("avg", avgOf(delivered, k));
            f.put("topCount", top);
            f.put("topPct", pct(top, delivered.size()));
            f.put("highCount", high);
            families.add(f);
        }
        List<Map<String, Object>> byAvg = new ArrayList<>(families);
        byAvg.sort(Comparator.comparingInt(f -> -(Integer) f.get("avg")));

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("base", delivered.size());
        m.put("families", families);
        m.put("strongest", byAvg.isEmpty() ? List.of()
                : List.of(byAvg.get(0).get("label"), byAvg.get(1).get("label")));
        m.put("weakest", byAvg.isEmpty() ? List.of()
                : List.of(byAvg.get(byAvg.size() - 1).get("label"), byAvg.get(byAvg.size() - 2).get("label")));
        m.put("tiedProfiles", flat);
        m.put("tiedPct", pct(flat, delivered.size()));
        m.put("trackA", trackA);
        m.put("trackAPct", pct(trackA, delivered.size()));
        return m;
    }

    // ───────────────────────────── improvement ─────────────────────────────

    private Map<String, Object> improvement(List<ScoredStudent> delivered) {
        int n = delivered.size();

        List<Map<String, Object>> checks = new ArrayList<>();
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            int passed = 0;
            for (ScoredStudent s : delivered) if (Boolean.TRUE.equals(s.pro.scores.checks.get(k))) passed++;
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("key", k);
            c.put("label", map.label(k));
            c.put("passed", passed);
            c.put("base", n);
            c.put("pct", pct(passed, n));
            checks.add(c);
        }
        checks.sort(Comparator.comparingInt(c -> (Integer) c.get("pct")));

        int[] dist = new int[6];
        for (ScoredStudent s : delivered) dist[Math.max(0, Math.min(5, s.pro.scores.reasoning))]++;
        List<Integer> distribution = new ArrayList<>();
        for (int d : dist) distribution.add(d);

        Map<String, Integer> lowest = new LinkedHashMap<>();
        for (String k : NavigatorProConstructMap.SUB_KEYS) lowest.put(k, 0);
        for (ScoredStudent s : delivered) lowest.merge(lowestHabit(s.pro.scores), 1, Integer::sum);

        List<Map<String, Object>> habits = new ArrayList<>();
        for (String k : NavigatorProConstructMap.SUB_KEYS) {
            int red = 0, amber = 0, green = 0;
            for (ScoredStudent s : delivered) {
                switch (NavigatorProNorms.ragColour(s.pro.scores.get(k))) {
                    case "red": red++; break;
                    case "amber": amber++; break;
                    default: green++; break;
                }
            }
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("key", k);
            h.put("label", map.label(k));
            h.put("avg", avgOf(delivered, k));
            h.put("red", red);
            h.put("amber", amber);
            h.put("green", green);
            h.put("redPct", pct(red, n));
            h.put("lowestFor", lowest.get(k));
            habits.add(h);
        }
        habits.sort(Comparator.comparingInt(h -> (Integer) h.get("avg")));

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("base", n);
        m.put("checks", checks);
        m.put("reasoningDistribution", distribution);
        m.put("avgReasoning", avgReasoning(delivered));
        m.put("lowReasoning", countReasoningAtMost(delivered, LOW_REASONING));
        m.put("habits", habits);
        m.put("lowFoundation", countBelow(delivered, "foundation", LOW_FOUNDATION_CUT));
        return m;
    }

    /** The student's weakest habit, with the report's own tie order (ND, DI, TP, CI, GD). */
    static String lowestHabit(NavigatorProScores s) {
        List<String> subs = new ArrayList<>(NavigatorProConstructMap.SUB_KEYS);
        subs.sort(Comparator.comparingDouble(s::get));
        return subs.get(0);
    }

    // ───────────────────────────── directions ─────────────────────────────

    private Map<String, Object> directions(List<ScoredStudent> delivered) {
        Map<String, int[]> tally = new LinkedHashMap<>();   // bestFit, tiedSecond, handsOn, aspiring
        Map<String, double[]> fit = new LinkedHashMap<>();  // sum, n
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) {
            tally.put(d, new int[4]);
            fit.put(d, new double[2]);
        }
        int explorers = 0, ties = 0, matched = 0, mismatched = 0, noAspiration = 0, ranked = 0;
        for (ScoredStudent s : delivered) {
            Evaluation ev = s.pro;
            for (String d : NavigatorProConstructMap.DOMAIN_KEYS) {
                if (r(ev.scores.get(d)) >= HANDS_ON_CUT) tally.get(d)[2]++;
                if (ev.scores.aspirations.contains(d)) tally.get(d)[3]++;
                if (ev.blend != null && ev.blend.careerScore.containsKey(d)) {
                    fit.get(d)[0] += ev.blend.careerScore.get(d);
                    fit.get(d)[1]++;
                }
            }
            if (ev.explorer()) { explorers++; continue; }
            NavigatorProBlend.Result b = ev.blend;
            if (b == null || b.ranking.isEmpty()) continue;
            ranked++;
            tally.get(b.ranking.get(0))[0]++;
            if (b.tie) {
                ties++;
                if (b.ranking.size() > 1) tally.get(b.ranking.get(1))[1]++;
            }
            if (ev.scores.aspirations.isEmpty()) {
                noAspiration++;
            } else if (aspirationMatches(ev)) {
                matched++;
            } else {
                mismatched++;
            }
        }

        List<Map<String, Object>> fields = new ArrayList<>();
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) {
            int[] t = tally.get(d);
            double[] f = fit.get(d);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", d);
            m.put("label", map.label(d));
            m.put("bestFit", t[0]);
            m.put("tiedSecond", t[1]);
            m.put("handsOn", t[2]);
            m.put("aspiring", t[3]);
            m.put("avgFit", f[1] == 0 ? 0 : r(f[0] / f[1]));
            fields.add(m);
        }
        fields.sort(Comparator.<Map<String, Object>>comparingInt(m -> -(Integer) m.get("bestFit"))
                .thenComparingInt(m -> -(Integer) m.get("handsOn")));

        Map<String, Object> ambition = new LinkedHashMap<>();
        ambition.put("base", ranked);
        ambition.put("matched", matched);
        ambition.put("mismatched", mismatched);
        ambition.put("noAspiration", noAspiration);
        ambition.put("mismatchedPct", pct(mismatched, matched + mismatched));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("base", delivered.size());
        out.put("ranked", ranked);
        out.put("explorers", explorers);
        out.put("ties", ties);
        out.put("fields", fields);
        out.put("ambitionVsFit", ambition);
        out.put("recipe", "interests 40% · hands-on 40% · values 20%");
        return out;
    }

    /** Whether any of the student's aspiration picks is among their top three best-fit fields. */
    static boolean aspirationMatches(Evaluation ev) {
        if (ev.blend == null) return false;
        List<String> top3 = ev.blend.ranking.subList(0, Math.min(3, ev.blend.ranking.size()));
        for (String a : ev.scores.aspirations) if (top3.contains(a)) return true;
        return false;
    }

    // ───────────────────────────── industry ─────────────────────────────

    /** Six planning cards for the fields with the most best-fit students. */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> industry(Map<String, Object> directions) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> field : (List<Map<String, Object>>) directions.get("fields")) {
            if (out.size() >= 6) break;
            int demand = (Integer) field.get("bestFit") + (Integer) field.get("tiedSecond");
            if (demand == 0) continue;
            String label = (String) field.get("label");
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("key", field.get("key"));
            card.put("label", label);
            card.put("bestFit", field.get("bestFit"));
            card.put("tiedSecond", field.get("tiedSecond"));
            card.put("handsOn", field.get("handsOn"));
            card.put("aspiring", field.get("aspiring"));
            card.put("internships", content.internships(label));
            Optional<NavigatorProContent.IndustryCard> copy = content.industryCard(label);
            card.put("organisations", copy.map(c -> c.organisations).orElse(List.of()));
            card.put("visit", copy.map(c -> c.visit).orElse(""));
            card.put("copyDraft", copy.map(c -> c.draft).orElse(true));
            out.add(card);
        }
        return out;
    }

    // ───────────────────────────── values ─────────────────────────────

    private List<Map<String, Object>> values(List<ScoredStudent> delivered) {
        Map<String, int[]> tally = new LinkedHashMap<>();
        for (String tag : content.valueTags()) tally.put(tag, new int[2]);
        for (ScoredStudent s : delivered) {
            List<String> vs = s.pro.scores.values;
            for (int i = 0; i < vs.size(); i++) {
                String tag = content.value(vs.get(i)).map(v -> v.tag).orElse(vs.get(i));
                int[] t = tally.computeIfAbsent(tag, k -> new int[2]);
                t[0]++;
                if (i == 0) t[1]++;
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, int[]> e : tally.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tag", e.getKey());
            m.put("option", content.value(e.getKey()).map(v -> v.option).orElse(""));
            m.put("topFour", e.getValue()[0]);
            m.put("topFourPct", pct(e.getValue()[0], delivered.size()));
            m.put("rankOne", e.getValue()[1]);
            out.add(m);
        }
        out.sort(Comparator.<Map<String, Object>>comparingInt(m -> -(Integer) m.get("topFour"))
                .thenComparingInt(m -> -(Integer) m.get("rankOne")));
        return out;
    }

    // ───────────────────────────── attention ─────────────────────────────

    /**
     * Every student who needs a person, with why, what to do and who does it.
     *
     * <p>Priority 1 is a report that did not go out, or went out flagged — somebody has to
     * sit with that student before anything else happens. Priority 2 is a student the
     * report could not point anywhere, or who is starting from the bottom on every
     * measure. Priority 3 is targeted help a class-level programme can absorb.
     */
    private List<Map<String, Object>> attentionItems(List<ScoredStudent> evaluated, Cuts cuts,
                                                     ReleaseSnapshot snapshot) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (ScoredStudent s : evaluated) {
            Evaluation ev = s.pro;
            List<Map<String, Object>> reasons = new ArrayList<>();
            if (ev.suppressed()) {
                switch (ev.gateCode) {
                    case "R1":
                        reasons.add(reason("held_attention", 1,
                                "Attention check not passed — report held",
                                "Re-sit the assessment with a counsellor in the room", OWNER_COUNSELLORS));
                        break;
                    case "R5":
                        reasons.add(reason("held_incomplete", 1,
                                "Answer sheet incomplete — report held",
                                "Arrange a supervised re-sit so the sheet is finished", OWNER_COUNSELLORS));
                        break;
                    case "R3":
                        reasons.add(reason("held_weak_peak", 1,
                                "No interest area strong enough to rank directions — report held",
                                "Counsellor-led conversation in place of a report", OWNER_COUNSELLORS));
                        break;
                    default:
                        reasons.add(reason("held_no_signal", 1,
                                "Interests tied and no hands-on exposure yet — report held",
                                "Counsellor-led conversation in place of a report", OWNER_COUNSELLORS));
                        break;
                }
            } else {
                String zone = zoneOf(ev, cuts);
                if (ev.banner) {
                    reasons.add(reason("flagged", 1,
                            "Answers were inconsistent — report delivered with a notice",
                            "Counsellor meeting to read the report together", OWNER_COUNSELLORS));
                }
                if (ev.explorer()) {
                    reasons.add(reason("explorer", 2,
                            "Explorer — no single direction stands out yet",
                            "Counselling session built on the student's own aspirations", OWNER_COUNSELLORS));
                }
                if (NavigatorProNorms.ZONE_SUPPORT.equals(zone) && ev.scores.get("foundation") < LOW_FOUNDATION_CUT) {
                    reasons.add(reason("support_low_foundation", 2,
                            "Will and Skill both at the start line, with weak everyday habits",
                            "Assign a mentor for a weekly small-win check-in", OWNER_ACADEMICS));
                }
                if (NavigatorProNorms.ZONE_CAPABLE.equals(zone) && ev.scores.get("drive") < LOW_WILL_CUT) {
                    reasons.add(reason("disengaged", 3,
                            "Real skill, but very low drive right now",
                            "Mentor conversation: one problem they care about, four weeks", OWNER_COUNSELLORS));
                }
                if (ev.scores.reasoning <= LOW_REASONING) {
                    reasons.add(reason("low_reasoning", 3,
                            "Everyday logic " + ev.scores.reasoning + " of 5",
                            "Place in the applied numeracy and spreadsheet lab", OWNER_ACADEMICS));
                }
            }
            if (reasons.isEmpty()) continue;

            int priority = 3;
            for (Map<String, Object> rsn : reasons) priority = Math.min(priority, (Integer) rsn.get("priority"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", s.userStudentId);
            item.put("priority", priority);
            item.put("reasons", reasons);
            item.put("counselled", snapshot.isCounselled(s.userStudentId));
            items.add(item);
        }
        items.sort(Comparator.<Map<String, Object>>comparingInt(i -> (Integer) i.get("priority"))
                .thenComparing(i -> (Boolean) i.get("counselled"))
                .thenComparingLong(i -> (Long) i.get("id")));
        return items;
    }

    private static Map<String, Object> reason(String code, int priority, String label, String action, String owner) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("priority", priority);
        m.put("label", label);
        m.put("action", action);
        m.put("owner", owner);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> attention(List<Map<String, Object>> items, List<ScoredStudent> delivered) {
        int[] byPriority = new int[4];
        Map<String, Integer> byReason = new LinkedHashMap<>();
        Map<String, Integer> byOwner = new LinkedHashMap<>();
        int minutes = 0, counselled = 0;
        for (Map<String, Object> item : items) {
            int p = (Integer) item.get("priority");
            byPriority[p]++;
            minutes += p == 1 ? P1_MINUTES : p == 2 ? P2_MINUTES : P3_MINUTES;
            if (Boolean.TRUE.equals(item.get("counselled"))) counselled++;
            for (Map<String, Object> rsn : (List<Map<String, Object>>) item.get("reasons")) {
                byReason.merge((String) rsn.get("code"), 1, Integer::sum);
                byOwner.merge((String) rsn.get("owner"), 1, Integer::sum);
            }
        }
        int trackA = 0;
        for (ScoredStudent s : delivered) if (s.pro.trackA) trackA++;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", items.size());
        m.put("p1", byPriority[1]);
        m.put("p2", byPriority[2]);
        m.put("p3", byPriority[3]);
        m.put("byReason", byReason);
        m.put("byOwner", byOwner);
        m.put("alreadyCounselled", counselled);
        m.put("minutesEstimate", minutes);
        m.put("hoursEstimate", Math.round(minutes / 6.0) / 10.0);
        m.put("minutesPerPriority", List.of(P1_MINUTES, P2_MINUTES, P3_MINUTES));
        m.put("trackABriefing", trackA);
        m.put("items", items);
        return m;
    }

    // ───────────────────────────── students ─────────────────────────────

    /** One row per evaluated student: ids and numbers only, names resolved on request. */
    private List<Map<String, Object>> studentRows(List<ScoredStudent> evaluated, Cuts cuts,
                                                  List<Map<String, Object>> queue, ReleaseSnapshot snapshot) {
        Map<Long, Integer> priorities = new LinkedHashMap<>();
        for (Map<String, Object> item : queue) priorities.put((Long) item.get("id"), (Integer) item.get("priority"));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ScoredStudent s : evaluated) {
            Evaluation ev = s.pro;
            NavigatorProScores sc = ev.scores;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.userStudentId);
            m.put("section", s.sectionName);
            m.put("status", ev.suppressed() ? "held" : "delivered");
            m.put("gate", ev.gateCode);
            m.put("gateReason", ev.gateReason);
            m.put("priority", priorities.get(s.userStudentId));
            m.put("counselled", snapshot.isCounselled(s.userStudentId));
            if (!ev.suppressed()) {
                m.put("zone", zoneKey(zoneOf(ev, cuts)));
                m.put("will", r(sc.get("drive")));
                m.put("skill", r(sc.get("skill")));
                m.put("foundation", r(sc.get("foundation")));
                m.put("reasoning", sc.reasoning);
                m.put("topFamily", sc.topFamily == null ? null : map.label(sc.topFamily));
                m.put("secondFamily", sc.secondFamily == null ? null : map.label(sc.secondFamily));
                m.put("lowHabit", map.label(lowestHabit(sc)));
                boolean explorer = ev.explorer();
                NavigatorProBlend.Result b = ev.blend;
                m.put("explorer", explorer);
                m.put("lean", explorer || b == null || b.ranking.isEmpty() ? null : map.label(b.ranking.get(0)));
                m.put("leanScore", explorer || b == null || b.ranking.isEmpty() ? null : r(b.careerScore.get(b.ranking.get(0))));
                m.put("second", explorer || b == null || b.ranking.size() < 2 ? null : map.label(b.ranking.get(1)));
                m.put("tie", !explorer && b != null && b.tie);
                m.put("track", ev.trackA ? "A" : "B");
                m.put("flagged", ev.banner);
                List<String> vals = new ArrayList<>();
                for (String v : sc.values) vals.add(content.value(v).map(x -> x.tag).orElse(v));
                m.put("values", vals);
                List<String> asp = new ArrayList<>();
                for (String a : sc.aspirations) asp.add(map.label(a));
                m.put("aspirations", asp);
                m.put("ambitionMatch", explorer || sc.aspirations.isEmpty() ? null : aspirationMatches(ev));
            }
            rows.add(m);
        }
        rows.sort(Comparator.<Map<String, Object>>comparingInt(m -> m.get("will") == null ? Integer.MAX_VALUE
                : -(Integer) m.get("will")));
        return rows;
    }

    // ───────────────────────────── actions ─────────────────────────────

    /**
     * "What to do with this page", per page, each tagged with who acts.
     *
     * <p>Rule-based and deterministic, so the recommendations exist even when a scope is
     * below the narrative floor and the model is never called. The narrative adds
     * interpretation on top; it never replaces these.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> actions(int n, Map<String, Object> overview, Map<String, Object> zones,
                                        Map<String, Object> will, Map<String, Object> personality, Map<String, Object> improvement,
                                        Map<String, Object> directions, List<Map<String, Object>> values,
                                        Map<String, Object> attention) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (n == 0) return out;

        Map<String, Integer> zoneCounts = new LinkedHashMap<>();
        for (Map<String, Object> z : (List<Map<String, Object>>) zones.get("counts")) {
            zoneCounts.put((String) z.get("key"), (Integer) z.get("count"));
        }
        List<Map<String, Object>> checks = (List<Map<String, Object>>) improvement.get("checks");
        Map<String, Object> weakestCheck = checks.isEmpty() ? null : checks.get(0);
        List<Map<String, Object>> habits = (List<Map<String, Object>>) improvement.get("habits");
        List<Map<String, Object>> fields = (List<Map<String, Object>>) directions.get("fields");
        List<String> top3 = new ArrayList<>();
        for (Map<String, Object> f : fields) {
            if ((Integer) f.get("bestFit") > 0 && top3.size() < 3) top3.add((String) f.get("label"));
        }
        String top3Text = String.join(", ", top3);

        // Executive summary: the three to four decisions the whole dashboard points to.
        List<Map<String, Object>> exec = new ArrayList<>();
        int p1 = (Integer) attention.get("p1");
        if (p1 > 0) {
            exec.add(act("Clear the " + p1 + " priority-1 student" + plural(p1)
                    + " this week — their reports were held or flagged and need a counsellor first.", OWNER_COUNSELLORS));
        }
        int motivated = zoneCounts.getOrDefault("motivated", 0);
        if (motivated > 0) {
            exec.add(act("Start one guided-project programme for the " + motivated
                    + " driven-but-under-skilled students — they improve fastest.", OWNER_ACADEMICS));
        }
        if (weakestCheck != null && (Integer) weakestCheck.get("pct") < 70) {
            exec.add(act("Book one 2-hour " + ((String) weakestCheck.get("label")).toLowerCase() + " lab — only "
                    + weakestCheck.get("pct") + "% passed that check.", OWNER_ACADEMICS));
        }
        if (!top3.isEmpty()) {
            exec.add(act("Give the top field" + (top3.size() > 1 ? "s" : "") + " (" + top3Text
                    + ") first claim on electives, labs and company invites.", OWNER_PLACEMENT));
        }
        out.put("exec", exec);

        // Will vs Skill map.
        List<Map<String, Object>> mapActs = new ArrayList<>();
        mapActs.add(act("Green (" + zoneCounts.getOrDefault("ready", 0)
                + "): push them now — competitions, internships, certifications this semester.", OWNER_ACADEMICS));
        mapActs.add(act("Amber (" + motivated
                + "): give guided projects — their drive turns into skill fastest.", OWNER_ACADEMICS));
        mapActs.add(act("Blue (" + zoneCounts.getOrDefault("capable", 0) + ") and red ("
                + zoneCounts.getOrDefault("support", 0)
                + "): counsellor talks first — blue needs a reason to try, red needs one small win every week.",
                OWNER_COUNSELLORS));
        out.put("map", mapActs);

        // Will — what drives the batch.
        Object weakFactor = will.get("weakestFactor");
        if (weakFactor != null) {
            out.put("will", List.of(act("Build " + weakFactor + " — the batch's weakest Will factor — into "
                    + "mentoring: short, visible weekly goals move it faster than motivational talks.",
                    OWNER_COUNSELLORS)));
        }

        // What kind of batch.
        List<String> weakest = (List<String>) personality.get("weakest");
        List<Map<String, Object>> pers = new ArrayList<>();
        if (!weakest.isEmpty()) {
            pers.add(act("Pick this year's clubs and events to grow the two shortest bars ("
                    + String.join(" and ", weakest) + ") — placements still ask for them.", OWNER_ACADEMICS));
        }
        int trackA = (Integer) personality.get("trackA");
        if (trackA > 0) {
            pers.add(act("Brief counsellors on the " + trackA + " alternate-strength profile" + plural(trackA)
                    + " (neither building nor analysis leads) — orientation, never a deficit label.", OWNER_COUNSELLORS));
        }
        out.put("personality", pers);

        // Areas of improvement.
        List<Map<String, Object>> imp = new ArrayList<>();
        if (weakestCheck != null) {
            imp.add(act("Book one 2-hour " + ((String) weakestCheck.get("label")).toLowerCase() + " lab — "
                    + weakestCheck.get("pct") + "% of " + n + " passed.", OWNER_ACADEMICS));
        }
        for (Map<String, Object> c : checks) {
            if ("chk_src".equals(c.get("key")) && (Integer) c.get("pct") < 70) {
                imp.add(act("Add one assignment that requires citing a real source — only " + c.get("pct")
                        + "% judged sources correctly.", OWNER_ACADEMICS));
            }
        }
        if (habits.size() >= 2) {
            imp.add(act("Protect one hour a week for the habit tasks each student's report set (weakest: "
                    + habits.get(0).get("label") + ", " + habits.get(1).get("label") + ").", OWNER_PRINCIPAL));
        }
        out.put("improvement", imp);

        // Directions.
        List<Map<String, Object>> dir = new ArrayList<>();
        if (!top3.isEmpty()) {
            dir.add(act("Give " + top3Text + " first claim on elective seats and lab hours.", OWNER_ACADEMICS));
            dir.add(act("Invite companies from " + top3Text + " for talks this semester.", OWNER_PLACEMENT));
        }
        Map<String, Object> ambition = (Map<String, Object>) directions.get("ambitionVsFit");
        int mismatched = (Integer) ambition.get("mismatched");
        if (mismatched > 0) {
            dir.add(act("Run an ambition-vs-fit conversation for the " + mismatched + " student" + plural(mismatched)
                    + " whose chosen field is outside their top three fits — widen the plan, never overrule it.",
                    OWNER_COUNSELLORS));
        }
        out.put("directions", dir);

        // Industry plan.
        out.put("industry", List.of(act("Turn the six cards into the semester calendar: one visit and one "
                + "internship drive per field, the largest demand first.", OWNER_PLACEMENT)));

        // Values.
        List<Map<String, Object>> val = new ArrayList<>();
        if (values.size() >= 2) {
            String v1 = (String) values.get(0).get("tag"), v2 = (String) values.get(1).get("tag");
            val.add(act("Open every pre-placement talk with " + v1 + " and " + v2
                    + " — that is what this batch listens for.", OWNER_PLACEMENT));
            val.add(act("Tell visiting companies these values — offers that match get accepted and kept.", OWNER_PLACEMENT));
        }
        out.put("values", val);

        // Attention queue.
        out.put("queue", List.of(
                act("Work the list top-down this week; priority 1 before any class-level programme starts.",
                        OWNER_COUNSELLORS),
                act("Estimated counsellor time this cycle: about " + attention.get("hoursEstimate") + " hours.",
                        OWNER_PRINCIPAL)));
        return out;
    }

    private static Map<String, Object> act(String text, String owner) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("text", text);
        m.put("owner", owner);
        return m;
    }

    private static String plural(int n) {
        return n == 1 ? "" : "s";
    }

    // ───────────────────────────── provenance ─────────────────────────────

    private static Map<String, Object> provenance(ReleaseSnapshot snapshot) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("generatedAt", new Date());
        m.put("logicVersion", LOGIC_VERSION);
        m.put("snapshotStudents", snapshot.allStudents().size());
        m.put("scoringFailures", snapshot.scoringFailures());
        return m;
    }

    // ───────────────────────────── arithmetic ─────────────────────────────

    static int r(double v) {
        return (int) Math.round(v);
    }

    static int pct(int part, int whole) {
        return whole == 0 ? 0 : (int) Math.round(part * 100.0 / whole);
    }

    private static int avgOf(List<ScoredStudent> students, String key) {
        if (students.isEmpty()) return 0;
        double sum = 0;
        for (ScoredStudent s : students) sum += s.pro.scores.get(key);
        return r(sum / students.size());
    }

    /** Everyday logic average out of 5, one decimal. */
    private static double avgReasoning(List<ScoredStudent> students) {
        if (students.isEmpty()) return 0;
        double sum = 0;
        for (ScoredStudent s : students) sum += s.pro.scores.reasoning;
        return Math.round(sum * 10.0 / students.size()) / 10.0;
    }

    private static int countBelow(List<ScoredStudent> students, String key, int cut) {
        int n = 0;
        for (ScoredStudent s : students) if (s.pro.scores.get(key) < cut) n++;
        return n;
    }

    private static int countReasoningAtMost(List<ScoredStudent> students, int max) {
        int n = 0;
        for (ScoredStudent s : students) if (s.pro.scores.reasoning <= max) n++;
        return n;
    }

    private static double median(List<Double> values, double fallback) {
        if (values.isEmpty()) return fallback;
        List<Double> sorted = new ArrayList<>(values);
        sorted.sort(null);
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 1 ? sorted.get(mid) : (sorted.get(mid - 1) + sorted.get(mid)) / 2.0;
    }
}
