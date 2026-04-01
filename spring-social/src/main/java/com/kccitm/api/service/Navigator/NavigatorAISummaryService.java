package com.kccitm.api.service.Navigator;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Phase 4: AI Summaries
 * Generates AI Summary and Learning Style Summary using OpenAI API.
 * Uses direct HTTP calls to avoid Jackson version conflicts with the OpenAI Java SDK.
 */
@Service
public class NavigatorAISummaryService {

    private static final Logger logger = LoggerFactory.getLogger(NavigatorAISummaryService.class);
    private static final String OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
    private static final ObjectMapper mapper = new ObjectMapper();
    private static final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.openai.api-key:}")
    private String openaiApiKey;

    @PostConstruct
    public void init() {
        logger.info("============= OpenAI API Configuration =============");
        logger.info("  API Key:  {}", openaiApiKey != null && openaiApiKey.length() > 8
                ? openaiApiKey.substring(0, 8) + "****" : "(not set)");
        logger.info("  Model:    gpt-4o");
        logger.info("  Endpoint: {}", OPENAI_API_URL);
        if (openaiApiKey == null || openaiApiKey.isEmpty()) {
            logger.warn("  Status:   NOT CONFIGURED - Set OPENAI_API_KEY env variable or app.openai.api-key in application.yml");
        } else {
            logger.info("  Status:   READY");
        }
        logger.info("=====================================================");
    }

    // ═══════════════════════ RESULT HOLDER ═══════════════════════

    public static class AISummaryResult {
        public String aiSummary;
        public String learningStyleSummary;
    }

    // ═══════════════════════ MAIN ENTRY ═══════════════════════

    public AISummaryResult generateSummaries(
            String studentName,
            String studentClass,
            NavigatorCoreAnalysis.CoreAnalysisResult coreResult) {

        AISummaryResult result = new AISummaryResult();

        String personality1 = safe(coreResult.personalityTop1);
        String personality2 = safe(coreResult.personalityTop2);
        String intelligence1 = safe(coreResult.intelligenceTop1);
        String intelligence2 = safe(coreResult.intelligenceTop2);
        String learningStyle1 = safe(coreResult.learningStyle1);
        String learningStyle2 = safe(coreResult.learningStyle2);
        String learningStyle3 = safe(coreResult.learningStyle3);
        String careerPathway = coreResult.suitabilityIndex != null && coreResult.suitabilityIndex.length > 0
                ? safe(coreResult.suitabilityIndex[0]) : "";
        String weakAbility = safe(coreResult.weakAbility);
        if (weakAbility.isEmpty()) weakAbility = "communication";

        // ── AI Summary Prompt ──
        String aiSummaryPrompt = "Generate a summary of a student's profile under 200 words, "
                + "designed to help them gain confidence and a better understanding of themselves. "
                + "The summary must include the following details: "
                + "Name: " + studentName + ", "
                + "Standard: " + studentClass + ", "
                + "Top 2 Personality Codes Interpretation: Explain the top two personality traits "
                + personality1 + " and " + personality2 + " and how they positively influence "
                + "the student's strengths, behaviors, and approach to life, "
                + "Top 2 Intelligence Types Explanation: Provide a brief explanation of the student's "
                + "top two intelligences " + intelligence1 + " and " + intelligence2 + ", focusing on "
                + "their natural skills and how they can apply these abilities, "
                + "Learning Style Identified: Mention the student's preferred learning styles "
                + learningStyle1 + ", " + learningStyle2 + ", and " + learningStyle3
                + " and how they can use them to enhance their studies effectively, "
                + "Recommended Career Pathway: Suggest a suitable career pathway " + careerPathway
                + " based on their strengths and interests, "
                + "Weak Ability Identified and Recommendations: Highlight one weak ability "
                + weakAbility + " positively and include actionable recommendations for improvement. "
                + "Use motivational, simple, and encouraging language so the student feels empowered "
                + "after reading the summary. Address the student in second person directly.";

        // ── Learning Style Summary Prompt ──
        String learningStylePrompt = "Generate a concise, motivational summary of a student's profile "
                + "in no more than 160 words. The summary must include:\n\n"
                + "1. Name: " + studentName + "\n\n"
                + "2. Top 3 Intelligence Types: Briefly describe the top three intelligences ("
                + intelligence1 + ", " + intelligence2 + ", and " + learningStyle1
                + ") that highlight the student's natural strengths.\n\n"
                + "3. Strengths in Finding Learning Style: Connect these intelligences to their "
                + "preferred learning style (" + learningStyle1 + ", " + learningStyle2 + ", "
                + learningStyle3 + ") and explain how the student can use this understanding "
                + "to excel in their studies.\n\n"
                + "Use simple, positive, and encouraging language, ensuring the summary empowers "
                + "the student to embrace their strengths and improve their learning approach. "
                + "Address the student in second person directly.";

        try {
            logger.info("Generating AI summaries for {} ...", studentName);

            result.aiSummary = callOpenAI(aiSummaryPrompt);
            logger.info("  AI Summary generated ({} chars)", result.aiSummary.length());

            result.learningStyleSummary = callOpenAI(learningStylePrompt);
            logger.info("  Learning Style Summary generated ({} chars)", result.learningStyleSummary.length());

        } catch (Exception e) {
            logger.error("Failed to generate AI summaries for {}: {}", studentName, e.getMessage());
            result.aiSummary = "Summary generation failed: " + e.getMessage();
            result.learningStyleSummary = "Summary generation failed: " + e.getMessage();
        }

        return result;
    }

    // ═══════════════════════ OPENAI CALL (HTTP) ═══════════════════════

    private String callOpenAI(String prompt) {
        if (openaiApiKey == null || openaiApiKey.isEmpty()) {
            throw new RuntimeException("OpenAI API key not configured. Set OPENAI_API_KEY in .env or app.openai.api-key in application.yml");
        }

        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                // Build JSON request body manually to avoid Jackson version issues
                String requestBody = mapper.writeValueAsString(new java.util.LinkedHashMap<String, Object>() {{
                    put("model", "gpt-4o");
                    put("max_completion_tokens", 2048);
                    put("temperature", 1.0);
                    put("top_p", 1.0);
                    put("frequency_penalty", 0.0);
                    put("presence_penalty", 0.0);
                    put("messages", java.util.List.of(
                        new java.util.LinkedHashMap<String, String>() {{
                            put("role", "user");
                            put("content", prompt);
                        }}
                    ));
                }});

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(OPENAI_API_URL))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + openaiApiKey)
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    throw new RuntimeException("OpenAI API returned status " + response.statusCode() + ": " + response.body());
                }

                JsonNode root = mapper.readTree(response.body());
                String content = root.get("choices").get(0).get("message").get("content").asText("");

                // Clean output (remove *** markers like Python version)
                return content.replace("***", "").trim();

            } catch (Exception e) {
                logger.warn("  OpenAI attempt {}/3 failed: {}", attempt, e.getMessage());
                if (attempt < 3) {
                    try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                } else {
                    throw new RuntimeException("OpenAI API failed after 3 attempts: " + e.getMessage(), e);
                }
            }
        }
        return "";
    }

    private static String safe(String val) {
        return val != null ? val : "";
    }
}
