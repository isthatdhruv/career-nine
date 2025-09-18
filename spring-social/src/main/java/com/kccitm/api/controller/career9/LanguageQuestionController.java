package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.LanguageQuestion;
import com.kccitm.api.repository.Career9.LanguageQuestionRepository;


@RestController
@RequestMapping("/api/language-question")
public class LanguageQuestionController {
    
    @Autowired
    private LanguageQuestionRepository languagequestionrepository;

    @PostMapping("/create-with-options")
    @Transactional
    public ResponseEntity<?> createLanguageQuestion(@RequestBody LanguageQuestion languageQuestion) {
        try {
            // Step 1: Find and delete existing translations
            if (languageQuestion.getAssessmentQuestion() != null && 
                languageQuestion.getAssessmentQuestion().getQuestionId() != null && 
                languageQuestion.getLanguage() != null && 
                languageQuestion.getLanguage().getLanguageId() != null) {
                
                // Get all existing language questions
                List<LanguageQuestion> allQuestions = languagequestionrepository.findAll();
                
                // Filter and delete matching ones
                List<LanguageQuestion> toDelete = allQuestions.stream()
                    .filter(lq -> lq.getAssessmentQuestion() != null && 
                                 lq.getAssessmentQuestion().getQuestionId().equals(languageQuestion.getAssessmentQuestion().getQuestionId()) &&
                                 lq.getLanguage() != null &&
                                 lq.getLanguage().getLanguageId().equals(languageQuestion.getLanguage().getLanguageId()))
                    .collect(java.util.stream.Collectors.toList());
                
                if (!toDelete.isEmpty()) {
                    languagequestionrepository.deleteAll(toDelete);
                }
            }
            
            // Step 2: Set bi-directional relationships for options
            if (languageQuestion.getOptions() != null) {
                languageQuestion.getOptions().forEach(option -> {
                    option.setLanguageQuestion(languageQuestion);
                    option.setLanguage(languageQuestion.getLanguage());
                });
            }
            
            // Step 3: Save new translation
            LanguageQuestion savedQuestion = languagequestionrepository.save(languageQuestion);
            
            return ResponseEntity.ok("Translation updated successfully with ID: " + savedQuestion.getLanguageQuestionId());
            
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/getAll")
    public List<LanguageQuestion> getAllLanguageQuestions() {
        return languagequestionrepository.findAll();
    }

    @GetMapping("/get/{id}")
    public LanguageQuestion getLanguageQuestionById(Long id) {
        return languagequestionrepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public LanguageQuestion languageQuestionCreate(@RequestBody LanguageQuestion languageQuestion) {
        return languagequestionrepository.save(languageQuestion);
    }
}

