package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * TEMPORARY — prints the numbers behind the dashboard's charts to the server console.
 *
 * <p>Added on request to inspect what the page is drawing. It reads the stored payload
 * rather than recomputing, so what appears in the console is exactly what the charts are
 * rendering, not a second opinion about it.
 *
 * <p>Delete this class together with the {@code /log-chart-data} endpoint and the button
 * on the dashboard that calls it. Nothing else references it.
 */
@Component
public class PrincipalDashboardChartLogger {

    private static final String BAR = "════════════════════════════════════════════════════════════";

    private final ObjectMapper objectMapper;

    public PrincipalDashboardChartLogger(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Dump one scope's chart data.
     *
     * <p>Uses {@code System.out} deliberately rather than the logger: this is a
     * throwaway inspection tool, and routing it through the logger would put it behind
     * whatever level and appender configuration the environment happens to have.
     *
     * @return how many chart-shaped blocks were printed
     */
    public int dump(String scopeLabel, String scopeKey, String internalCalculation, String aiResponse) {
        System.out.println();
        System.out.println(BAR);
        System.out.println("  DASHBOARD CHART DATA  ·  " + (scopeLabel == null ? "?" : scopeLabel));
        System.out.println("  scope: " + scopeKey);
        System.out.println(BAR);

        int charts = 0;
        try {
            JsonNode root = objectMapper.readTree(internalCalculation);
            printCohort(root);
            charts += printSheets(root.path("sheets"));
        } catch (Exception e) {
            System.out.println("  ! could not read internal_calculation: " + e);
        }

        if (aiResponse != null && !aiResponse.isBlank()) {
            try {
                charts += printNarrativeCharts(objectMapper.readTree(aiResponse));
            } catch (Exception e) {
                System.out.println("  ! could not read ai_response: " + e);
            }
        }

        System.out.println(BAR);
        System.out.println("  " + charts + " chart block(s) printed");
        System.out.println(BAR);
        System.out.println();
        return charts;
    }

    private void printCohort(JsonNode root) {
        JsonNode p = root.path("participation");
        JsonNode c = root.path("cohort");
        System.out.println();
        System.out.println("── COHORT ──");
        System.out.printf("  total %s · completed %s · ongoing %s · notStarted %s · scored %s · unscored %s%n",
                p.path("total").asText("?"), p.path("completed").asText("?"),
                p.path("ongoing").asText("?"), p.path("notStarted").asText("?"),
                p.path("scored").asText("?"), p.path("unscored").asText("?"));
        System.out.printf("  girls %s · boys %s · grades %s%n",
                c.path("girls").asText("?"), c.path("boys").asText("?"),
                c.path("gradesPresent").toString());

        JsonNode f = root.path("flags");
        if (!f.isMissingNode()) {
            System.out.printf("  flags — acute %s · abilitySupport %s · guidanceMismatch %s (of %s)%n",
                    f.path("acute").asText("0"), f.path("abilitySupport").asText("0"),
                    f.path("guidanceMismatch").asText("0"), f.path("base").asText("0"));
        }
    }

    /** Each sheet is a compact table: {@code {c: [headers], r: [[values]]}}. */
    private int printSheets(JsonNode sheets) {
        if (sheets.isMissingNode() || !sheets.fieldNames().hasNext()) {
            System.out.println();
            System.out.println("── SHEETS ── (none stored)");
            return 0;
        }

        int printed = 0;
        Iterator<String> names = sheets.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            JsonNode sheet = sheets.path(name);

            if (isTable(sheet)) {
                printTable(name, sheet);
                printed++;
            } else if (sheet.isObject()) {
                // careerGap holds two tables; byClass holds several plus a class list.
                Iterator<String> inner = sheet.fieldNames();
                List<String> scalars = new ArrayList<>();
                while (inner.hasNext()) {
                    String key = inner.next();
                    JsonNode child = sheet.path(key);
                    if (isTable(child)) {
                        printTable(name + "." + key, child);
                        printed++;
                    } else if (child.isValueNode() || child.isArray()) {
                        scalars.add(key + "=" + child.toString());
                    }
                }
                if (!scalars.isEmpty()) {
                    System.out.println();
                    System.out.println("── " + name.toUpperCase() + " (scalars) ──");
                    System.out.println("  " + String.join(" · ", scalars));
                }
            }
        }
        return printed;
    }

    private static boolean isTable(JsonNode node) {
        return node.isObject() && node.path("c").isArray() && node.path("r").isArray();
    }

    /** Column-aligned so a wide table stays readable in a terminal. */
    private void printTable(String title, JsonNode table) {
        JsonNode cols = table.path("c");
        JsonNode rows = table.path("r");

        List<String> header = new ArrayList<>();
        cols.forEach(c -> header.add(c.asText()));

        List<List<String>> body = new ArrayList<>();
        rows.forEach(row -> {
            List<String> cells = new ArrayList<>();
            row.forEach(cell -> cells.add(cell.isNull() ? "—" : cell.asText()));
            body.add(cells);
        });

        int[] width = new int[header.size()];
        for (int i = 0; i < header.size(); i++) {
            width[i] = header.get(i).length();
        }
        for (List<String> row : body) {
            for (int i = 0; i < row.size() && i < width.length; i++) {
                width[i] = Math.max(width[i], row.get(i).length());
            }
        }

        System.out.println();
        System.out.println("── " + title.toUpperCase() + " ──  (" + body.size() + " rows)");
        System.out.println("  " + pad(header, width));
        for (List<String> row : body) {
            System.out.println("  " + pad(row, width));
        }
    }

    private static String pad(List<String> cells, int[] width) {
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            String cell = cells.get(i);
            int w = i < width.length ? width[i] : cell.length();
            line.append(String.format("%-" + Math.max(1, w) + "s", cell));
            if (i < cells.size() - 1) line.append("  ");
        }
        return line.toString();
    }

    /** The charts the model returned, printed in the same shape for comparison. */
    private int printNarrativeCharts(JsonNode narrative) {
        int printed = 0;
        for (JsonNode section : narrative.path("report").path("sections")) {
            for (JsonNode chart : section.path("charts")) {
                System.out.println();
                System.out.println("── NARRATIVE CHART ── " + chart.path("title").asText("(untitled)"));
                System.out.println("  section " + section.path("number").asText("?")
                        + " · " + section.path("title").asText(""));

                List<String> labels = new ArrayList<>();
                chart.path("labels").forEach(l -> labels.add(l.asText()));
                System.out.println("  labels: " + String.join(", ", labels));

                for (JsonNode series : chart.path("series")) {
                    List<String> values = new ArrayList<>();
                    series.path("values").forEach(v -> values.add(v.asText()));
                    System.out.printf("  %-18s %s%s%n",
                            series.path("name").asText(""),
                            String.join(", ", values),
                            series.path("unit").asText("").isEmpty()
                                    ? "" : " (" + series.path("unit").asText() + ")");
                }
                printed++;
            }
        }
        return printed;
    }

    /** Unused hook kept alongside {@link #dump} for symmetry with a Map payload. */
    public int dump(String scopeLabel, String scopeKey, Map<String, Object> payload) {
        try {
            return dump(scopeLabel, scopeKey, objectMapper.writeValueAsString(payload), null);
        } catch (Exception e) {
            System.out.println("  ! could not serialise payload: " + e);
            return 0;
        }
    }
}
