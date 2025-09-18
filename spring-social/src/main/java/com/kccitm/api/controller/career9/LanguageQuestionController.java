package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<?> createLanguageQuestion(@RequestBody LanguageQuestion languageQuestion) {
        // JPA will cascade and save options as well
        languagequestionrepository.save(languageQuestion);
        return ResponseEntity.ok("Saved");
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

