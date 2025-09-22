package com.kccitm.api.controller.career9;
import com.kccitm.api.config.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatGptService chatGptService;
    
    public ChatController(ChatGptService chatGptService) {
        this.chatGptService = chatGptService;
    }

    @PostMapping("/generate")
    public String generateText(@RequestBody String prompt) {
        return chatGptService.generateText(prompt);
    }
}
