package com.kccitm.api.service.career9;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.*;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.CareerRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class Qwen3CareerService {

    private static final String OLLAMA_URL = "http://localhost:11434/api/generate";
    private static final String MODEL = "qwen3";

    @Autowired
    private StudentAssessmentMappingRepository mappingRepo;

    @Autowired
    private AssessmentRawScoreRepository rawScoreRepo;

    @Autowired
    private CareerRepository careerRepo;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public CareerSuggestionResult suggest(Long studentId, Long assessmentId) {
        // Fetch scores
        StudentAssessmentMapping mapping = mappingRepo
                .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId)
                .orElseThrow(() -> new RuntimeException("No assessment mapping found for student " + studentId));

        List<AssessmentRawScore> scores = rawScoreRepo
                .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

        // Group scores
        Map<String, Integer> personalityScores = new LinkedHashMap<>();
        Map<String, Integer> intelligenceScores = new LinkedHashMap<>();
        Map<String, Integer> abilityScores = new LinkedHashMap<>();

        for (AssessmentRawScore s : scores) {
            String mqName = s.getMeasuredQuality() != null ? s.getMeasuredQuality().getMeasuredQualityName() : "";
            String mqtName = s.getMeasuredQualityType() != null ? s.getMeasuredQualityType().getMeasuredQualityTypeName() : "";
            int rawScore = s.getRawScore() != null ? s.getRawScore() : 0;

            if (mqName.toLowerCase().contains("personality")) {
                personalityScores.put(mqtName, rawScore);
            } else if (mqName.toLowerCase().contains("intelligence")) {
                intelligenceScores.put(mqtName, rawScore);
            } else if (mqName.toLowerCase().contains("abilit")) {
                abilityScores.put(mqtName, rawScore);
            }
        }

        List<Career> allCareers = careerRepo.findAll();
        String prompt = buildPrompt(personalityScores, intelligenceScores, abilityScores, allCareers);

        String jsonResponse = callOllama(prompt);
        return parseResponse(jsonResponse, allCareers);
    }

    private String buildPrompt(Map<String, Integer> personalityScores,
                                Map<String, Integer> intelligenceScores,
                                Map<String, Integer> abilityScores,
                                List<Career> careers) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a career counsellor using RIASEC, Howard Gardner's Multiple Intelligences, and GATB theories.\n\n");

        sb.append("STUDENT SCORES:\n");
        sb.append("Personality (RIASEC):\n");
        personalityScores.forEach((k, v) -> sb.append("  ").append(k).append(": ").append(v).append("\n"));

        sb.append("Intelligence (Gardner):\n");
        intelligenceScores.forEach((k, v) -> sb.append("  ").append(k).append(": ").append(v).append("\n"));

        sb.append("Abilities (GATB):\n");
        abilityScores.forEach((k, v) -> sb.append("  ").append(k).append(": ").append(v).append("\n"));

        sb.append("\nAVAILABLE CAREER PATHWAYS:\n");
        careers.forEach(c -> sb.append("  - ").append(c.getTitle()).append("\n"));

        sb.append("\nBased on these scores and career counselling theories, identify:\n");
        sb.append("1. Top 3 most suited career pathways (green)\n");
        sb.append("2. Next 3 moderately suited career pathways (orange)\n");
        sb.append("3. 3 least suited career pathways (red)\n\n");
        sb.append("Respond ONLY with valid JSON in this exact format (no thinking, no explanation):\n");
        sb.append("{\n");
        sb.append("  \"green\": [\"Career Title 1\", \"Career Title 2\", \"Career Title 3\"],\n");
        sb.append("  \"orange\": [\"Career Title 4\", \"Career Title 5\", \"Career Title 6\"],\n");
        sb.append("  \"red\": [\"Career Title 7\", \"Career Title 8\", \"Career Title 9\"]\n");
        sb.append("}\n");
        sb.append("Use ONLY career titles from the provided list. Output JSON only.");

        return sb.toString();
    }

    private String callOllama(String prompt) {
        try {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("model", MODEL);
            requestBody.put("prompt", prompt);
            requestBody.put("stream", false);
            requestBody.put("think", false);

            String requestJson = objectMapper.writeValueAsString(requestBody);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(OLLAMA_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());
            return root.path("response").asText("");
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("Failed to call Ollama: " + e.getMessage(), e);
        }
    }

    private CareerSuggestionResult parseResponse(String llmResponse, List<Career> allCareers) {
        Map<String, Career> careerByTitle = allCareers.stream()
                .collect(Collectors.toMap(Career::getTitle, c -> c, (a, b) -> a));

        // Extract JSON block from response (LLM may prefix/suffix with text)
        String json = extractJson(llmResponse);

        List<Career> green = new ArrayList<>();
        List<Career> orange = new ArrayList<>();
        List<Career> red = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(json);
            green = titlesToCareers(root.path("green"), careerByTitle);
            orange = titlesToCareers(root.path("orange"), careerByTitle);
            red = titlesToCareers(root.path("red"), careerByTitle);
        } catch (Exception e) {
            // If parsing fails, return empty result
        }

        CareerSuggestionResult result = new CareerSuggestionResult();
        result.setGreenPathways(green);
        result.setOrangePathways(orange);
        result.setRedPathways(red);
        result.setTopPersonalityTraits(Collections.emptyList());
        result.setTopIntelligenceTypes(Collections.emptyList());
        result.setTopAbilities(Collections.emptyList());
        return result;
    }

    private String extractJson(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return "{}";
    }

    private List<Career> titlesToCareers(JsonNode arrayNode, Map<String, Career> careerByTitle) {
        List<Career> result = new ArrayList<>();
        if (arrayNode.isArray()) {
            for (JsonNode node : arrayNode) {
                String title = node.asText();
                Career career = careerByTitle.get(title);
                if (career != null) result.add(career);
            }
        }
        return result;
    }
}
