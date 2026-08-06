package com.kccitm.api.service.dashboard.principal;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The expensive half of a generated dashboard: turns one scope's computed payload into
 * the interpretive JSON the dashboard renders and the .docx will be built from.
 *
 * <p><b>The model is never asked for a document.</b> It returns schema-constrained JSON,
 * which is then rendered — to React on the dashboard, and later to a .docx. Two
 * consequences follow, and both are the reason for the design: re-rendering after a
 * template change costs nothing because no API call is involved, and the dashboard and
 * the document can never disagree, because they are two renderings of one artifact.
 *
 * <p><b>The model never does arithmetic.</b> It receives aggregates computed
 * deterministically upstream, so a percentage it prints cannot contradict the chart
 * beside it. Its job is interpretation.
 *
 * <p>Uses OpenAI structured outputs ({@code response_format: json_schema, strict}), which
 * is why every section carries the same shape: strict mode cannot express an object whose
 * fields vary by section, and one shape is also what lets a single renderer walk the
 * whole report.
 */
@Service
public class PrincipalDashboardAiService {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardAiService.class);

    private static final String ENDPOINT = "https://api.openai.com/v1/chat/completions";

    /**
     * The charts the dashboard draws, by id.
     *
     * <p>These ids are a contract with the page: it looks each block up by id to place it
     * under the right chart. Changing one here without changing
     * {@code SchoolDashboardPage.tsx} silently drops that chart's commentary, so they are
     * listed in one place on each side and named the same.
     */
    private static final String[] CHART_IDS = {
            "students-by-class",
            "stream-fit-vs-ambition",
            "personality-profile",
            "trait-leadership",
            "learning-styles",
            "ability-gaps",
            "work-values",
            "clarity-by-class",
    };

    /**
     * Bump whenever the prompt or schema changes meaningfully. Stamped onto every row so
     * a later revision does not silently make old and new content look alike.
     */
    public static final String PROMPT_VERSION = "principal-dashboard-v6";

    private final ObjectMapper objectMapper;
    private final HttpClient http;

    @Value("${app.openai.api-key:}")
    private String apiKey;

    @Value("${app.principal-dashboard.model:gpt-4o}")
    private String model;

    @Value("${app.principal-dashboard.request-timeout-seconds:180}")
    private long timeoutSeconds;

    public PrincipalDashboardAiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    public static final class AiResult {
        public String json;
        public String promptVersion;
        /** Exactly what the model was sent. Stored so "why did it say that" is answerable. */
        public String requestJson;
        public int promptTokens;
        public int completionTokens;
    }

    /**
     * Generate the interpretive JSON for one scope.
     *
     * @param request the assembled request from {@link PrincipalDashboardRequestBuilder}
     * @throws IllegalStateException when the key is unset — a release must fail loudly
     *         rather than quietly storing empty narratives for every scope
     */
    public AiResult generate(Map<String, Object> request, ScopeKey scope) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "OPENAI_API_KEY is not configured — cannot generate dashboard narratives.");
        }

        String userContent;
        try {
            userContent = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialise the request for the prompt", e);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0.2);
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", userContent)));
        body.put("response_format", responseFormat());

        try {
            String payload = objectMapper.writeValueAsString(body);
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(ENDPOINT))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = http.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "OpenAI returned " + response.statusCode() + ": " + truncate(response.body()));
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || content.asText().isBlank()) {
                throw new IllegalStateException("OpenAI returned no content for scope " + scope.key());
            }

            // Validate before storing: a row marked GENERATED must hold parseable JSON,
            // otherwise the failure surfaces to a principal instead of to this log.
            String json = content.asText();
            objectMapper.readTree(json);

            JsonNode usage = root.path("usage");
            AiResult result = new AiResult();
            result.json = json;
            result.promptVersion = PROMPT_VERSION;
            result.requestJson = userContent;
            result.promptTokens = usage.path("prompt_tokens").asInt();
            result.completionTokens = usage.path("completion_tokens").asInt();

            // Per-scope usage — a release is many of these, and this is the only place
            // its cost is observable.
            log.info("Principal dashboard AI: scope {} ok — {} prompt + {} completion tokens",
                    scope.key(), result.promptTokens, result.completionTokens);
            return result;

        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("OpenAI call failed for scope " + scope.key() + ": " + e, e);
        }
    }

    // ─────────────────────────────── prompt ───────────────────────────────

    private String systemPrompt() {
        return String.join("\n",
        "You are the Career-9 insight engine for the Navigator360 school programme. Each call sends you",
        "one scope of one school as a JSON object. A scope is the whole school, a session, a class, a",
        "section, or a group — `scope.level` and `scope.label` say which, and every statement you make is",
        "about that scope alone.",
        "",
        "INPUT BLOCKS",
        "  scope             which cohort this is, and its label.",
        "  cohort            n, girls, boys, grades_present. `n` is the base for every sheet figure.",
        "  participation     total / completed / ongoing / notStarted / scored for this scope.",
        "  flags             anonymised screening counts: acute, abilitySupport, guidanceMismatch, base.",
        "  school_meta       name, location, boards_present, board_tagged, catchment.",
        "  event             programme facts: students assessed, students counselled, windows.",
        "  baseline          the whole school, for comparison. Absent at school level.",
        "  dashboard_sheets  the computed Navigator360 dashboard.",
        "  data_audit        what was excluded from the numbers, computed upstream.",
        "  pending           inputs this system does not capture.",
        "  sections_required which report sections to produce, by number.",
        "",
        "READING THE SHEETS",
        "Tables are columnar to stay compact: {\"c\": [column names], \"r\": [[row values]]}. Read each row",
        "positionally against `c`. A column named base_* is the same measure for the whole school — use it",
        "to say whether this scope is ahead of or behind its school, which is usually the finding. Do not",
        "report a base_* value as if it belonged to this scope.",
        "",
        "HARD RULES",
        "- Never invent a number, a name, or a date. Every number you print must appear in the input.",
        "- Every claim carries its number and its base (\"62% of 69 scored students\").",
        "- Never ask for missing information and never stop to request it.",
        "- data_audit and pending are given to you. Report them; never re-derive them, never audit the",
        "  arithmetic, and never suppress a supplied number on suspicion. The figures were computed",
        "  deterministically from one scoring pass and are consistent by construction.",
        "- Produce exactly the sections listed in sections_required, in ascending order. Produce no others.",
        "- Flagged students appear only as anonymised counts, taken from `flags`. You are never given",
        "  student-level data and must never write as though you were.",
        "- Never use the word \"clinical\". These are psychometric screening flags; students needing more",
        "  support \"may benefit from further professional evaluation\".",
        "- Where school_meta.catchment is null, omit socio-economic interpretation rather than guessing.",
        "- Where board_tagged is false, keep any board discussion observational — no board-wise comparison.",
        "- Recommend Career-9 offerings only where they answer a specific finding in this scope's data.",
        "- Simple professional English. Optimistic and strengths-first. No jargon. Body entries are prose",
        "  paragraphs, never bullet fragments.",
        "",
        "SECTIONS",
        "Every section has the same shape: id, number, title, body, charts, tables, bullets, callouts.",
        "Arrays you do not need come back empty — never omitted, never padded with filler.",
        "  1  Programme summary — a table of assessed, counselled, and the windows from `event`.",
        "  2  Career clarity and trending careers — clarity with its base; stream trends and top aspired",
        "     clusters with readiness, for the grades in cohort.grades_present only. Charts: stream",
        "     fit-vs-wish, top clusters.",
        "  3  Top suitable careers with readiness — then one bullet per trending cluster, label = cluster,",
        "     meta carrying aspirants / readiness_pct / gap_type (personality or ability), text explaining",
        "     the gap with evidence. A callout naming the bridge careers the data supports.",
        "  4  Cohesive personality — top-trait chart, top-three presence, a character summary teachers",
        "     would recognise.",
        "  5  Cohesive learning style and values — one chart each, each tied to how to teach and talk to",
        "     these students.",
        "  6  Weak abilities as a co-curricular table — gap, students affected, the programme to run. The",
        "     final row leverages this cohort's strengths.",
        "  7  Management summary — at most five bullets, each carrying its number, plus a closing",
        "     paragraph on next year.",
        "  9  Red-flag cases — from `flags` only. Tiers: acute (no ability at strength level and eight or",
        "     more weak), ability support (five or more weak), guidance mismatch (no overlap between",
        "     aspirations and suitability). A table of anonymised counts with the action for each.",
        " 10  Counsellor capability and the certification recommendation.",
        " 11  Action plan table — the Career-9 career library and monthly industry visits always, plus what",
        "     this scope's data justifies. A closing paragraph.",
        "",
        "THE HEADLINE",
        "`headline` is the single sentence the dashboard opens with, set large. Write the one thing a",
        "principal must know if they read nothing else — the sharpest tension or risk in this cohort's",
        "data, carrying its numbers. Prefer a contrast the figures actually show (\"three in five want",
        "Science, but only one in three has the profile for it\") over a summary of what the report covers.",
        "Under 30 words. Never a greeting, a title, or a description of the document.",
        "",
        "DASHBOARD LAYER",
        "dashboard_insights is rendered directly and must stand on its own.",
        "  kpis    four at most, and only ones this scope's data supports: completion, career clarity, the",
        "          headline gap, the count needing support. value is a number; put the symbol in unit.",
        "          Omit any KPI whose input is missing rather than printing a zero.",
        "  cards   six to ten, ordered so the most urgent is first. Each carries: one sentence with its",
        "          number and base; `action`, a concrete next step the school can take this term, phrased",
        "          as an instruction (\"Run a stream-counselling round before Class 11 forms go out\") and",
        "          never as an observation; machine-readable numbers; a type (strength | gap | risk |",
        "          opportunity); and section_ref to the section that expands it. Only the first three are",
        "          shown by default, so put the ones that most need acting on at the top. Cover at minimum:",
        "          the stream suited-vs-aspiring gap, the most fixable readiness gap, the cohort's",
        "          personality character, the top weak ability, the values pattern, and the flagged picture.",
        "  alerts  anonymised counts needing action, each with the action to take.",
        "",
        "Charts are always ready to bind: id, type, title, caption, labels, series[{name, values, unit}].",
        "Series values must be index-aligned with labels.",
        "",
        "CHART COMMENTARY",
        "`chart_notes` is what a principal reads underneath each chart on the dashboard. Produce one",
        "entry for every chart id below, drawn from the block named beside it. Every entry needs all",
        "three lists.",
        "  students-by-class       sheets.summary.studentsByClass and byClass.headline `students`.",
        "  stream-fit-vs-ambition  sheets.careerGap.streams — suited against aspiring, and the gap.",
        "  personality-profile     sheets.personality, the avgRaw column across the six traits.",
        "  trait-leadership        sheets.personality, topTraitPct and topThreePct.",
        "  learning-styles         sheets.learningStyle — strongPct against lowPct per intelligence.",
        "  ability-gaps            sheets.abilities — the gap column, plus nWith5PlusWeak.",
        "  work-values             sheets.values — topFivePct across the fifteen values.",
        "  clarity-by-class        sheets.byClass.headline `careerClarityPct`, class by class.",
        "",
        "  insights      three to five. What the chart actually shows, each with its number and base.",
        "  implications  three to five. What it means for this school if nothing changes — consequences",
        "                for students, not restatements of the number.",
        "  actions       three to five. What Career-9 advises the school do about it, phrased as an",
        "                instruction and scoped to this term.",
        "",
        "Three is a floor, not a target: every list needs at least three entries, and a chart that",
        "seems to support only one or two has more in it than you have looked at — the same block",
        "carries other columns, other rows, and the comparison between them. Do not pad to reach",
        "three by rephrasing an earlier entry; draw the third from a different column or a different",
        "row of the same block.",
        "",
        "Write these on the alerting side: name the risk plainly, say who it lands on and when, and do",
        "not soften a real problem into \"worth monitoring\". Where a chart genuinely shows the school",
        "doing well, say so with the same directness rather than inventing a concern.",
        "",
        "",
        "EMPHASIS",
        "Wrap the part of a sentence that carries the finding in double asterisks — the figure and what",
        "it applies to, as in \"**48% of Grade 10** are aiming at a stream their profile does not",
        "support\". Double asterisks are the only markup allowed anywhere in this response.",
        "",
        "Use it in: the headline, card titles, insights and actions, alert labels and actions, section",
        "body paragraphs, bullets, callouts, and every chart_notes sentence.",
        "",
        "At most one emphasis per sentence, and never the whole sentence — a paragraph where every",
        "line is emphasised reads as none of it being. Emphasise the number and its subject, not the",
        "verb around them.");
    }

    // ─────────────────────────────── schema ───────────────────────────────

    /**
     * The JSON contract.
     *
     * <p>Every report section is the same object with the same fields, unused arrays
     * empty. Strict mode requires each property to be declared and required, so a
     * per-section shape is not expressible — and the uniformity is what lets the
     * dashboard and the .docx renderer each walk one structure instead of eleven.
     */
    private Map<String, Object> responseFormat() {
        Map<String, Object> chart = obj(props(
                "id", str(),
                "type", str(),
                "title", str(),
                "caption", str(),
                "labels", arr(str()),
                "series", arr(obj(props(
                        "name", str(),
                        "values", arr(num()),
                        "unit", str())))));

        Map<String, Object> table = obj(props(
                "id", str(),
                "title", str(),
                "columns", arr(str()),
                "rows", arr(arr(str()))));

        Map<String, Object> bullet = obj(props(
                "label", str(),
                "text", str(),
                "meta", arr(obj(props("key", str(), "value", str())))));

        Map<String, Object> callout = obj(props(
                "type", str(),
                "text", str()));

        Map<String, Object> section = obj(props(
                "id", str(),
                "number", num(),
                "title", str(),
                "body", arr(str()),
                "charts", arr(chart),
                "tables", arr(table),
                "bullets", arr(bullet),
                "callouts", arr(callout)));

        Map<String, Object> kpi = obj(props(
                "id", str(),
                "label", str(),
                "value", num(),
                "unit", str(),
                "target", nullable("number")));

        Map<String, Object> card = obj(props(
                "id", str(),
                "title", str(),
                "insight", str(),
                // Required, not optional. A finding a principal cannot act on is a
                // statistic, and the dashboard prints this directly under the insight.
                "action", str(),
                // Strict mode cannot express a free-form object, so the machine-readable
                // figures are a typed list rather than an open map.
                "numbers", arr(obj(props("key", str(), "value", num(), "unit", str()))),
                "type", enumOf("strength", "gap", "risk", "opportunity"),
                "section_ref", str()));

        Map<String, Object> alert = obj(props(
                "id", str(),
                "label", str(),
                "count", num(),
                "action", str()));

        Map<String, Object> auditEntry = obj(props("what", str(), "n", num()));

        // Commentary for the charts the dashboard draws. Keyed by a fixed id so the page
        // can put each block under the right chart without matching on titles.
        Map<String, Object> chartNote = obj(props(
                "chart_id", enumOf(CHART_IDS),
                "insights", arr(str()),
                "implications", arr(str()),
                "actions", arr(str())));

        Map<String, Object> schema = obj(props(
                "school", obj(props(
                        "name", str(),
                        "location", nullable("string"),
                        "location_status", str())),
                "cohort", obj(props(
                        "label", str(),
                        "n", num(),
                        "girls", num(),
                        "boys", num(),
                        "grades_present", arr(num()))),
                "pending", arr(obj(props("field", str(), "note", str()))),
                "data_audit", obj(props(
                        "excluded", arr(auditEntry),
                        "cured", arr(auditEntry),
                        "noted", arr(str()))),
                // The one sentence the page leads with. It sits at the root rather than
                // inside dashboard_insights because it is the whole report's verdict,
                // not one of its cards.
                "headline", str(),
                "dashboard_insights", obj(props(
                        "kpis", arr(kpi),
                        "cards", arr(card),
                        "alerts", arr(alert))),
                "chart_notes", arr(chartNote),
                "report", obj(props("sections", arr(section)))));

        return Map.of("type", "json_schema",
                "json_schema", Map.of(
                        "name", "principal_dashboard_report",
                        "strict", true,
                        "schema", schema));
    }

    // ───────────────────────── schema helpers ─────────────────────────
    // Strict mode demands additionalProperties:false and every property listed in
    // required. Building objects through one helper is what keeps that true as the
    // schema grows, rather than relying on remembering it at each site.

    private static Map<String, Object> obj(Map<String, Object> properties) {
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("type", "object");
        o.put("properties", properties);
        o.put("required", new ArrayList<>(properties.keySet()));
        o.put("additionalProperties", false);
        return o;
    }

    private static Map<String, Object> props(Object... keyValues) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            m.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return m;
    }

    private static Map<String, Object> str() {
        return Map.of("type", "string");
    }

    private static Map<String, Object> num() {
        return Map.of("type", "number");
    }

    private static Map<String, Object> arr(Map<String, Object> items) {
        return Map.of("type", "array", "items", items);
    }

    /** Strict mode has no optional fields; an absent value is an explicit null. */
    private static Map<String, Object> nullable(String type) {
        return Map.of("type", Arrays.asList(type, "null"));
    }

    private static Map<String, Object> enumOf(String... values) {
        return Map.of("type", "string", "enum", Arrays.asList(values));
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() <= 500 ? s : s.substring(0, 500) + "…";
    }
}
