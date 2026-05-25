package com.kccitm.api.controller.career9.Questionaire;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.Questionaire.QuestionnaireLanguage;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireLanguageRepository;

@RestController
@RequestMapping("/api/questionnaire-language")
@CrossOrigin(origins = "*")
public class QuestionnaireLanguageController {

    @Autowired
    private QuestionnaireLanguageRepository questionnaireLanguageRepository;

    @PostMapping("/create")
    @PreAuthorize("@auth.allows('questionnaire_language.create')")
    public ResponseEntity<QuestionnaireLanguage> create(
            @RequestBody QuestionnaireLanguage questionnaireLanguage) {

        QuestionnaireLanguage saved =
                questionnaireLanguageRepository.save(questionnaireLanguage);

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping("/getAll")
    @PreAuthorize("@auth.allows('questionnaire_language.read')")
    public ResponseEntity<List<QuestionnaireLanguage>> getAll() {
        return ResponseEntity.ok(questionnaireLanguageRepository.findAll());
    }

    @GetMapping("/getbyid/{id}")
    @PreAuthorize("@auth.allows('questionnaire_language.read')")
    public ResponseEntity<QuestionnaireLanguage> getById(@PathVariable Long id) {

        Optional<QuestionnaireLanguage> optional =
                questionnaireLanguageRepository.findById(id);

        return optional
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    @PreAuthorize("@auth.allows('questionnaire_language.update')")
    public ResponseEntity<QuestionnaireLanguage> update(
            @PathVariable Long id,
            @RequestBody QuestionnaireLanguage request) {

        return questionnaireLanguageRepository.findById(id)
                .map(existing -> {
                    existing.setInstructions(request.getInstructions());
                    existing.setLanguage(request.getLanguage());
                    existing.setQuestionnaire(request.getQuestionnaire());

                    QuestionnaireLanguage updated =
                            questionnaireLanguageRepository.save(existing);

                    return ResponseEntity.ok(updated);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/delete/{id}")
    @PreAuthorize("@auth.allows('questionnaire_language.delete')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {

        if (!questionnaireLanguageRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        questionnaireLanguageRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
