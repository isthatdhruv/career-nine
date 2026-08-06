package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import com.kccitm.api.service.schoolreport.SchoolDashboard;

/**
 * Serialises a computed {@link SchoolDashboard} into the compact form that is stored
 * as {@code internal_calculation} and sent to the model.
 *
 * <p><b>Columnar, not array-of-objects.</b> The dashboard is mostly repeated tables —
 * 6 traits, 8 intelligences, 10 abilities, 15 values, 24 career clusters — and an
 * array of objects repeats every key on every row. Twenty-four clusters would carry
 * 144 key strings to deliver 144 numbers. A {@code {c: [...headers], r: [[...]]}} pair
 * carries the headers once. The whole payload lands near 8&nbsp;KB, which keeps the
 * model's budget on reasoning rather than on punctuation.
 *
 * <p>Two things are deliberately dropped:
 * <ul>
 *   <li>{@code rows} — the per-student paste data. It is the raw sheet, it is the
 *       largest thing here by an order of magnitude, and nothing downstream reads it:
 *       flags are counted in code, and the narrative interprets aggregates.</li>
 *   <li>{@code charts} — the sheet's own comment says it computes nothing new, only
 *       chart-ready copies of sheets 2–7. Storing it would pay twice for one number.</li>
 * </ul>
 */
public final class CompactDashboardJson {

    private CompactDashboardJson() {}

    /** Key of the compact table's header row. */
    public static final String COLS = "c";
    /** Key of the compact table's data rows. */
    public static final String ROWS = "r";

    public static Map<String, Object> of(SchoolDashboard dash) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (dash == null) {
            return out;
        }
        if (dash.summary != null)      out.put("summary", summary(dash.summary));
        if (dash.personality != null)  out.put("personality", personality(dash.personality));
        if (dash.learningStyle != null) out.put("learningStyle", learningStyle(dash.learningStyle));
        if (dash.abilities != null)    out.put("abilities", abilities(dash.abilities));
        if (dash.values != null)       out.put("values", values(dash.values));
        if (dash.careerGap != null)    out.put("careerGap", careerGap(dash.careerGap));
        if (dash.byClass != null)      out.put("byClass", byClass(dash.byClass));
        return out;
    }

    // ───────────────────────────── sheets ─────────────────────────────

    private static Map<String, Object> summary(SchoolDashboard.SummarySheet s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("studentsInView", s.studentsInView);
        m.put("girls", s.girls);
        m.put("boys", s.boys);
        m.put("careerClarityPct", s.careerClarityPct);
        m.put("avgMatchedAspirations", round1(s.avgMatchedAspirations));
        m.put("dominantPersonality", s.dominantPersonality);
        m.put("secondPersonality", s.secondPersonality);
        m.put("dominantLearningStyle", s.dominantLearningStyle);
        m.put("weakestLearningStyle", s.weakestLearningStyle);
        m.put("strongestAbility", s.strongestAbility);
        m.put("weakestAbility", s.weakestAbility);
        m.put("topValue", s.topValue);
        m.put("bestFitStream", s.bestFitStream);
        m.put("mostWantedStream", s.mostWantedStream);
        m.put("studentsByClass", table(
                new Object[]{"class", "n", "pctOfSchool"},
                s.studentsByClass,
                c -> new Object[]{c.studentClass, c.students, c.pctOfSchool}));
        return m;
    }

    private static Map<String, Object> personality(SchoolDashboard.PersonalitySheet p) {
        Map<String, Object> m = table(
                new Object[]{"trait", "riasec", "avgRaw", "topTraitPct", "topThreePct", "nTop", "nTop3"},
                p.traits,
                t -> new Object[]{t.label, t.riasecName, round1(t.avgRawScore), t.pctAsTopTrait,
                        t.pctInTopThree, t.studentsTopTrait, t.studentsInTopThree});
        m.put("highestShare", p.highestTraitShare);
        m.put("lowestShare", p.lowestTraitShare);
        m.put("spread", p.spread);
        m.put("traitsAbove20", p.traitsAbove20);
        return m;
    }

    private static Map<String, Object> learningStyle(SchoolDashboard.LearningStyleSheet l) {
        return table(
                new Object[]{"intelligence", "strongPct", "lowPct", "avg", "nStrong", "nLow"},
                l.intelligences,
                i -> new Object[]{i.label, i.pctStrong, i.pctLow, round1(i.avgScore),
                        i.studentsStrong, i.studentsLow});
    }

    private static Map<String, Object> abilities(SchoolDashboard.AbilitiesSheet a) {
        Map<String, Object> m = table(
                new Object[]{"ability", "strongPct", "lowPct", "gap", "avg", "nStrong", "nLow"},
                a.abilities,
                r -> new Object[]{r.label, r.pctStrong, r.pctLow, r.gap, round1(r.avgScore),
                        r.studentsStrong, r.studentsLow});
        m.put("avgStrong", round1(a.avgAbilities10Plus));
        m.put("avgWeak", round1(a.avgAbilities8OrLess));
        m.put("nWith5PlusWeak", a.studentsWith5PlusWeak);
        m.put("pctWith5PlusWeak", a.pctWith5PlusWeak);
        return m;
    }

    private static Map<String, Object> values(SchoolDashboard.ValuesSheet v) {
        return table(
                new Object[]{"value", "topFivePct", "n", "rank"},
                v.values,
                r -> new Object[]{r.label, r.pctInTopFive, r.students, r.rank});
    }

    private static Map<String, Object> careerGap(SchoolDashboard.CareerGapSheet c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("streams", table(
                new Object[]{"stream", "suitedPct", "aspiringPct", "gap", "nSuited", "nAspiring"},
                c.streams,
                r -> new Object[]{r.label, r.suitedPct, r.aspiringPct, r.gap,
                        r.studentsSuited, r.studentsAspiring}));
        m.put("clusters", table(
                new Object[]{"cluster", "suitedTop3", "aspiring", "gap", "readinessPct", "stream"},
                c.clusters,
                r -> new Object[]{r.label, r.suitedTop3, r.aspiring, r.gap, r.readinessPct, r.stream}));
        return m;
    }

    /**
     * Sheet 8, with the class list doubling as the column header.
     *
     * <p>Every series here is index-aligned with {@code classes}, so making the classes
     * the headers removes the separate index array that would otherwise have to be kept
     * in step with each row.
     *
     * <p>Below institute level this narrows on its own — the rows fed in are already
     * scoped, so a class view has one column and a section view has one column. That is
     * why the sheet needs no scope-specific handling: it degenerates truthfully.
     */
    private static Map<String, Object> byClass(SchoolDashboard.ByClassSheet b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("classes", b.classes);

        Object[] header = header(b.classes, "metric");
        List<Object[]> headline = new ArrayList<>();
        headline.add(prepend("students", b.students));
        headline.add(prepend("careerClarityPct", b.careerClarityPct));
        headline.add(prepend("weak5Plus", b.fiveOrMoreWeakAbilities));
        m.put("headline", rawTable(header, headline));

        m.put("personalityTopTraitPct", series(b.classes, "trait", b.personalityTopTraitPct));
        m.put("learningStyleStrongPct", series(b.classes, "intelligence", b.learningStyleStrongPct));
        m.put("abilityLowPct", series(b.classes, "ability", b.abilityLowPct));
        m.put("streamFitVsWish", series(b.classes, "series", b.streamFitVsWish));
        return m;
    }

    private static Map<String, Object> series(List<Integer> classes, String firstCol,
                                              List<SchoolDashboard.LabeledSeries> rows) {
        List<Object[]> data = new ArrayList<>();
        if (rows != null) {
            for (SchoolDashboard.LabeledSeries s : rows) {
                data.add(prepend(s.label, s.values));
            }
        }
        return rawTable(header(classes, firstCol), data);
    }

    // ───────────────────────────── baseline ─────────────────────────────

    /**
     * Append a column from the institute's table onto a scoped table, matched by the
     * row's first cell.
     *
     * <p>"42% are strong on speed and accuracy" is a fact; "42% against 58% school-wide"
     * is a finding. The institute scope is computed in the same release, so the
     * comparison costs one lookup per row and roughly two hundred tokens, and it is the
     * difference between a narrative that describes and one that tells a principal
     * which class needs them.
     *
     * <p>Applied only below institute level, where a self-comparison would be noise.
     *
     * @param table     the scoped table, mutated in place
     * @param baseline  the institute table with the same shape
     * @param sourceCol index of the column to copy across
     * @param newName   header for the appended column
     */
    @SuppressWarnings("unchecked")
    public static void appendBaselineColumn(Map<String, Object> table, Map<String, Object> baseline,
                                            int sourceCol, String newName) {
        if (table == null || baseline == null) return;
        List<Object> cols = (List<Object>) table.get(COLS);
        List<Object[]> rows = (List<Object[]>) table.get(ROWS);
        List<Object[]> baseRows = (List<Object[]>) baseline.get(ROWS);
        if (cols == null || rows == null || baseRows == null) return;

        Map<Object, Object[]> byLabel = new LinkedHashMap<>();
        for (Object[] r : baseRows) {
            if (r.length > 0) byLabel.put(r[0], r);
        }

        cols.add(newName);
        List<Object[]> merged = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Object[] base = r.length > 0 ? byLabel.get(r[0]) : null;
            Object value = base != null && base.length > sourceCol ? base[sourceCol] : null;
            Object[] widened = Arrays.copyOf(r, r.length + 1);
            widened[r.length] = value;
            merged.add(widened);
        }
        table.put(ROWS, merged);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private static <T> Map<String, Object> table(Object[] cols, List<T> source,
                                                 Function<T, Object[]> mapper) {
        List<Object[]> rows = new ArrayList<>();
        if (source != null) {
            for (T item : source) {
                if (item != null) rows.add(mapper.apply(item));
            }
        }
        return rawTable(cols, rows);
    }

    private static Map<String, Object> rawTable(Object[] cols, List<Object[]> rows) {
        Map<String, Object> t = new LinkedHashMap<>();
        // Mutable, so appendBaselineColumn can widen it without rebuilding.
        t.put(COLS, new ArrayList<>(Arrays.asList(cols)));
        t.put(ROWS, rows);
        return t;
    }

    private static Object[] header(List<Integer> classes, String firstCol) {
        List<Object> cols = new ArrayList<>();
        cols.add(firstCol);
        if (classes != null) cols.addAll(classes);
        return cols.toArray();
    }

    private static Object[] prepend(String label, List<Integer> values) {
        List<Object> row = new ArrayList<>();
        row.add(label);
        if (values != null) row.addAll(values);
        return row.toArray();
    }

    /** The sheets already round for display; this keeps 8.200000000000001 out of the JSON. */
    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
