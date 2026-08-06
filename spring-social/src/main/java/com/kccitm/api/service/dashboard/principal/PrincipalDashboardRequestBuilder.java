package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.PrincipalDashboardData;

/**
 * Assembles the JSON the model is given for one scope.
 *
 * <p>The request is a <em>projection</em> of {@code internal_calculation} plus the
 * context the numbers cannot carry: who the school is, how the programme ran, what was
 * excluded, and what the same measures look like across the whole school. It is built
 * here and stored verbatim alongside the response, because "why did it say that" is
 * only answerable if you kept what it saw.
 *
 * <p>No student-level data crosses this boundary. The narrative reports anonymised
 * counts, so the counts are what it is given.
 */
@Component
public class PrincipalDashboardRequestBuilder {

    /**
     * Which report sections a scope is asked for.
     *
     * <p>Sections 1, 8, 10 and 11 are facts about the school's engagement — the
     * programme summary, teacher training, counsellor capability, the standing action
     * plan. Repeating them under every class and section turns a report into
     * boilerplate, and a teacher reading their own section does not need the school's
     * next-year plan restated. Section 8 is dropped everywhere until teacher-training
     * observations are captured; with none, and with no per-student board to compare
     * against, it has nothing to say.
     */
    private static final List<Integer> SECTIONS_INSTITUTE =
            Arrays.asList(1, 2, 3, 4, 5, 6, 7, 9, 10, 11);
    private static final List<Integer> SECTIONS_CLASS =
            Arrays.asList(2, 3, 4, 5, 6, 7, 9);
    private static final List<Integer> SECTIONS_NARROW =
            Arrays.asList(2, 3, 4, 6, 9);

    /**
     * Columns worth comparing against the whole school, as
     * {@code sheet → (table path, column index, new column name)}.
     *
     * <p>One extra number per row is what separates "42% are strong on speed and
     * accuracy" from "42% against 58% school-wide — this is the weak class". The
     * institute scope is computed in the same release, so the comparison costs a lookup.
     */
    private static final String[][] BASELINE_COLUMNS = {
            // sheet,          nested table,  source column index, appended name
            {"personality",    null,          "3",  "base_topTraitPct"},
            {"learningStyle",  null,          "1",  "base_strongPct"},
            {"abilities",      null,          "1",  "base_strongPct"},
            {"values",         null,          "1",  "base_topFivePct"},
            {"careerGap",      "streams",     "3",  "base_gap"},
    };

    /**
     * Build the request for one scope.
     *
     * @param scopePayload   this scope's {@code internal_calculation}
     * @param baselineSheets the institute scope's compact sheets, or null at institute
     *                       level where a self-comparison is noise
     * @param event          programme facts for the whole institute
     * @param level          the scope's level, which decides the section list
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> build(Map<String, Object> scopePayload,
                                     Map<String, Object> baselineSheets,
                                     Map<String, Object> event,
                                     String level) {
        Map<String, Object> req = new LinkedHashMap<>();
        req.put("scope", scopePayload.get("scope"));
        req.put("cohort", scopePayload.get("cohort"));
        req.put("participation", scopePayload.get("participation"));
        req.put("flags", scopePayload.get("flags"));
        req.put("school_meta", schoolMeta(scopePayload));
        req.put("event", event);

        Map<String, Object> sheets = deepCopySheets(
                (Map<String, Object>) scopePayload.get("sheets"));
        if (baselineSheets != null && !baselineSheets.isEmpty()) {
            applyBaseline(sheets, baselineSheets);
            req.put("baseline", baseline(baselineSheets, scopePayload));
        }
        req.put("dashboard_sheets", sheets);

        req.put("data_audit", dataAudit(scopePayload));
        req.put("pending", pending());
        req.put("sections_required", sectionsFor(level));
        return req;
    }

    // ─────────────────────────── blocks ───────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> schoolMeta(Map<String, Object> payload) {
        Map<String, Object> institute = (Map<String, Object>) payload.get("institute");
        Map<String, Object> m = new LinkedHashMap<>();
        if (institute != null) {
            m.put("name", institute.get("name"));
            m.put("location", location(institute));
            m.put("boards_present", institute.get("boards"));
        }
        // No board is recorded against a student, so a board-wise split cannot be
        // quantified however many boards the school lists. The prompt keeps section 8
        // observational when this is false rather than inventing a comparison.
        m.put("board_tagged", false);
        m.put("catchment", null);
        return m;
    }

    private static String location(Map<String, Object> institute) {
        Object city = institute.get("city");
        Object state = institute.get("state");
        if (city == null && state == null) return null;
        if (city == null) return String.valueOf(state);
        if (state == null) return String.valueOf(city);
        return city + ", " + state;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> baseline(Map<String, Object> baselineSheets,
                                         Map<String, Object> payload) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", "Whole school");
        Map<String, Object> summary = (Map<String, Object>) baselineSheets.get("summary");
        m.put("n", summary == null ? null : summary.get("studentsInView"));
        return m;
    }

    /**
     * What was left out of this scope's numbers, and why.
     *
     * <p>Computed here rather than asked of the model. The original prompt had the model
     * audit the sheets and suppress anything that failed — which, when the numbers are
     * generated deterministically from one scoring pass, means a hallucinated failure
     * can silently delete a true figure from a school's report. We know exactly what was
     * excluded; the model's job is to report it, not to rediscover it.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> dataAudit(Map<String, Object> payload) {
        Map<String, Object> participation = (Map<String, Object>) payload.get("participation");
        List<Map<String, Object>> excluded = new ArrayList<>();

        if (participation != null) {
            int unscored = intOf(participation.get("unscored"));
            if (unscored > 0) {
                excluded.add(entry("Completed the assessment but could not be scored", unscored));
            }
            int ongoing = intOf(participation.get("ongoing"));
            if (ongoing > 0) {
                excluded.add(entry("Still in progress, so absent from every sheet", ongoing));
            }
            int notStarted = intOf(participation.get("notStarted"));
            if (notStarted > 0) {
                excluded.add(entry("Not started, so absent from every sheet", notStarted));
            }
        }

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("excluded", excluded);
        audit.put("cured", new ArrayList<>());
        audit.put("noted", Arrays.asList(
                "Every sheet figure is based on scored students only; participation counts"
                + " use the full roster for this scope."));
        return audit;
    }

    /**
     * Inputs the system does not capture, declared up front.
     *
     * <p>Pre-populated rather than left for the model to discover, so the same two gaps
     * are reported identically on every scope of every school instead of depending on
     * whether the model noticed.
     */
    private List<Map<String, Object>> pending() {
        List<Map<String, Object>> pending = new ArrayList<>();
        pending.add(pendingEntry("school_meta.catchment",
                "Socio-economic catchment is not recorded; skip the contextual"
                + " interpretation in sections 2 and 7 rather than inferring it."));
        pending.add(pendingEntry("event.teacher_training_observations",
                "Teacher-training observations are not captured; omit section 8."));
        pending.add(pendingEntry("event.session_duration",
                "Session duration is not recorded."));
        return pending;
    }

    private List<Integer> sectionsFor(String level) {
        if (PrincipalDashboardData.LEVEL_INSTITUTE.equals(level)
                || PrincipalDashboardData.LEVEL_SESSION.equals(level)) {
            return SECTIONS_INSTITUTE;
        }
        if (PrincipalDashboardData.LEVEL_CLASS.equals(level)) {
            return SECTIONS_CLASS;
        }
        return SECTIONS_NARROW;
    }

    // ─────────────────────────── baseline merge ───────────────────────────

    @SuppressWarnings("unchecked")
    private void applyBaseline(Map<String, Object> sheets, Map<String, Object> baselineSheets) {
        for (String[] spec : BASELINE_COLUMNS) {
            String sheet = spec[0];
            String nested = spec[1];
            int sourceCol = Integer.parseInt(spec[2]);
            String newName = spec[3];

            Map<String, Object> table = (Map<String, Object>) sheets.get(sheet);
            Map<String, Object> baseTable = (Map<String, Object>) baselineSheets.get(sheet);
            if (table == null || baseTable == null) continue;
            if (nested != null) {
                table = (Map<String, Object>) table.get(nested);
                baseTable = (Map<String, Object>) baseTable.get(nested);
                if (table == null || baseTable == null) continue;
            }
            CompactDashboardJson.appendBaselineColumn(table, baseTable, sourceCol, newName);
        }
    }

    /**
     * Copy the tables the baseline merge widens, so appending a column to the request
     * never mutates the payload already stored as {@code internal_calculation}.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> deepCopySheets(Map<String, Object> sheets) {
        Map<String, Object> copy = new LinkedHashMap<>();
        if (sheets == null) return copy;
        for (Map.Entry<String, Object> e : sheets.entrySet()) {
            Object value = e.getValue();
            copy.put(e.getKey(), value instanceof Map
                    ? copyTable((Map<String, Object>) value) : value);
        }
        return copy;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> copyTable(Map<String, Object> table) {
        Map<String, Object> copy = new LinkedHashMap<>(table);
        Object cols = table.get(CompactDashboardJson.COLS);
        if (cols instanceof List) {
            copy.put(CompactDashboardJson.COLS, new ArrayList<>((List<Object>) cols));
        }
        Object rows = table.get(CompactDashboardJson.ROWS);
        if (rows instanceof List) {
            copy.put(CompactDashboardJson.ROWS, new ArrayList<>((List<Object>) rows));
        }
        for (Map.Entry<String, Object> e : table.entrySet()) {
            if (e.getValue() instanceof Map) {
                copy.put(e.getKey(), copyTable((Map<String, Object>) e.getValue()));
            }
        }
        return copy;
    }

    // ─────────────────────────── helpers ───────────────────────────

    private static Map<String, Object> entry(String what, int n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("what", what);
        m.put("n", n);
        return m;
    }

    private static Map<String, Object> pendingEntry(String field, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("field", field);
        m.put("note", note);
        return m;
    }

    private static int intOf(Object o) {
        return o instanceof Number ? ((Number) o).intValue() : 0;
    }
}
