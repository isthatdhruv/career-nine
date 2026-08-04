package com.kccitm.api.service.dashboard.principal;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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
 * the interpretive JSON the dashboard renders and the .docx is built from.
 *
 * <p><b>The model is never asked for a document.</b> It returns schema-constrained
 * JSON, which is then rendered — to React on the dashboard, and to a .docx by
 * {@code PrincipalDashboardDocxRenderer}. Two consequences follow, and both are the
 * reason for the design: re-rendering the document after a template change costs
 * nothing because no API call is involved, and the dashboard and the document can
 * never disagree, because they are two renderings of one artifact rather than two
 * separate generations.
 *
 * <p>Uses OpenAI structured outputs ({@code response_format: json_schema, strict}) so
 * a malformed response is an API error rather than a parse failure discovered later.
 */
@Service
public class PrincipalDashboardAiService {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardAiService.class);

    private static final String ENDPOINT = "https://api.openai.com/v1/chat/completions";

    /**
     * Bump whenever the prompt or schema changes meaningfully. Stamped onto every row
     * so a later prompt revision does not silently make old and new content look alike.
     */
    public static final String PROMPT_VERSION = "principal-dashboard-v1";

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
    }

    /**
     * Generate the interpretive JSON for one scope.
     *
     * @throws IllegalStateException when the key is unset — a release must fail loudly
     *         rather than quietly storing empty narratives for 25 scopes
     */
    public AiResult generate(Map<String, Object> computedPayload, ScopeKey scope) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "OPENAI_API_KEY is not configured — cannot generate dashboard narratives.");
        }

        String userContent;
        try {
            userContent = objectMapper.writeValueAsString(computedPayload);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialise the computed payload for the prompt", e);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0.2);
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content",
                        "Scope: " + scope.describe() + "\n\nComputed data:\n" + userContent)));
        body.put("response_format", responseFormat());

        try {
            String payload = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ENDPOINT))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
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

            // Token usage per scope — an eager release is ~25 of these, so this is the
            // only place the cost of a release is observable.
            JsonNode usage = root.path("usage");
            log.info("Principal dashboard AI: scope {} ok — {} prompt + {} completion tokens",
                    scope.key(), usage.path("prompt_tokens").asInt(), usage.path("completion_tokens").asInt());

            AiResult result = new AiResult();
            result.json = json;
            result.promptVersion = PROMPT_VERSION;
            return result;

        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("OpenAI call failed for scope " + scope.key() + ": " + e, e);
        }
    }

    private String systemPrompt() {
        return "You are Career-9's school report writer. You receive computed assessment "
             + "aggregates for one scope of one school and return an interpretive report as JSON.\n\n"
             + "Rules:\n"
             + "- Use only the numbers supplied. Never invent a figure, a student, or a trend.\n"
             + "- Where the data does not support a claim, omit the claim.\n"
             + "- Write for a school principal: plain, specific, decision-oriented. No jargon.\n"
             + "- Every finding must name what the school should do about it.\n"
             + "- Never identify or imply an individual student.\n"
             + "- State the cohort size when a figure rests on a small number of students.";
    }

    /**
     * The JSON contract. Kept deliberately close to the shape the dashboard already
     * renders, so one artifact drives both the page and the document.
     */
    private Map<String, Object> responseFormat() {
        Map<String, Object> section = Map.of(
                "type", "object",
                "properties", new LinkedHashMap<>(Map.of(
                        "id", Map.of("type", "string"),
                        "title", Map.of("type", "string"),
                        "body", Map.of("type", "array", "items", Map.of("type", "string")),
                        "callout", Map.of("type", "string"))),
                "required", List.of("id", "title", "body", "callout"),
                "additionalProperties", false);

        Map<String, Object> finding = Map.of(
                "type", "object",
                "properties", new LinkedHashMap<>(Map.of(
                        "label", Map.of("type", "string"),
                        "detail", Map.of("type", "string"),
                        "action", Map.of("type", "string"),
                        "severity", Map.of("type", "string", "enum", List.of("critical", "watch", "good")))),
                "required", List.of("label", "detail", "action", "severity"),
                "additionalProperties", false);

        Map<String, Object> schema = Map.of(
                "type", "object",
                "properties", new LinkedHashMap<>(Map.of(
                        "headline", Map.of("type", "string"),
                        "summary", Map.of("type", "string"),
                        "findings", Map.of("type", "array", "items", finding),
                        "sections", Map.of("type", "array", "items", section))),
                "required", List.of("headline", "summary", "findings", "sections"),
                "additionalProperties", false);

        return Map.of("type", "json_schema",
                "json_schema", Map.of(
                        "name", "principal_dashboard_report",
                        "strict", true,
                        "schema", schema));
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() <= 500 ? s : s.substring(0, 500) + "…";
    }
}
