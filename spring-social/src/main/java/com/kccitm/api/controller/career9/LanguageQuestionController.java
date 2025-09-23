package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.LanguageQuestion;
import com.kccitm.api.model.career9.LanguagesSupported;
import com.kccitm.api.repository.Career9.LanguageQuestionRepository;

@RestController
@RequestMapping("/api/language-question")
public class LanguageQuestionController {

    @Autowired
    private LanguageQuestionRepository languagequestionrepository;

    @PostMapping("/create-with-options")
    // @Transactional
    public ResponseEntity<?> createLanguageQuestion(@RequestBody LanguageQuestion languageQuestion) {
        try {
            // Step 1: Delete existing language questions with same questionId and
            // languageId
            Long questionId = languageQuestion.getAssessmentQuestion().getQuestionId();
            Long languageId = languageQuestion.getLanguage().getLanguageId();

            List<LanguageQuestion> existingQuestions = languagequestionrepository.findAll()
                    .stream()
                    .filter(lq -> lq.getAssessmentQuestion() != null &&
                            lq.getAssessmentQuestion().getQuestionId().equals(questionId) &&
                            lq.getLanguage() != null &&
                            lq.getLanguage().getLanguageId().equals(languageId))
                    .collect(java.util.stream.Collectors.toList());

            if (!existingQuestions.isEmpty()) {
                languagequestionrepository.deleteAll(existingQuestions);
            }

            // Step 2: Set bidirectional relationships
            if (languageQuestion.getOptions() != null) {
                languageQuestion.getOptions().forEach(option -> {
                    option.setLanguageQuestion(languageQuestion);
                    option.setLanguage(languageQuestion.getLanguage());
                });
            }

            // Step 3: Save normally using JPA save method
            LanguageQuestion savedQuestion = languagequestionrepository.save(languageQuestion);

            return ResponseEntity
                    .ok("Translation saved successfully with ID: " + savedQuestion.getLanguageQuestionId());

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
    // @Override
    // @Override
    // @PostMapping("/create-with-options")
    // public ResponseEntity<?> createLanguageQuestion(@RequestBody LanguageQuestion languageQuestion) {
    //     try {
    //         // Step 1: Delete existing language questions with same questionId and
    //         // languageId
    //         Long questionId = languageQuestion.getAssessmentQuestion().getQuestionId();
    //         Long languageId = languageQuestion.getLanguage().getLanguageId();

    //         List<LanguageQuestion> existingQuestions = languagequestionrepository.findAll()
    //                 .stream()
    //                 .filter(lq -> lq.getAssessmentQuestion() != null &&
    //                         lq.getAssessmentQuestion().getQuestionId().equals(questionId) &&
    //                         lq.getLanguage() != null &&
    //                         lq.getLanguage().getLanguageId().equals(languageId))
    //                 .collect(java.util.stream.Collectors.toList());

    //         if (!existingQuestions.isEmpty()) {
    //             languagequestionrepository.deleteAll(existingQuestions); // DELETES existing
    //         }

    //         // Step 2: Save new translation
    //         LanguageQuestion saved = languagequestionrepository.save(languageQuestion); // INSERTS new

    //         return ResponseEntity.ok("Saved with ID: " + saved.getLanguageQuestionId());

    //     } catch (Exception e) {
    //         return ResponseEntity.badRequest().body("Error: " + e.getMessage());
    //     }
    // }

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
