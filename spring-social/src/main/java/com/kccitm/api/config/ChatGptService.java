package com.kccitm.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class ChatGptService {

    // private static final String QuestionDefaultPrompt = "Translate this in  without any boilerplate text and also keep the hindi easy and understandable , use simpler words of translation:";
    private final WebClient webClient;

    public ChatGptService(@Value("${openai.api.key}") String apiKey) {
        this.webClient = WebClient.builder()
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    public String generateText(String prompt) {
        Map<String, Object> request = Map.of(
                "model", "gpt-4o-mini",
                "messages", new Object[]{
                        Map.of("role", "user", "content", prompt)
                }
        );

        Map<String, Object> response = webClient.post()
                .uri("/chat/completions")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        return (String) ((Map)((Map)((java.util.List)response.get("choices"))
                .get(0)).get("message")).get("content");
    }
}
