package com.kccitm.api.controller.career9.Questionaire;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireRepository;

@RestController
@RequestMapping("/api/questionnaire")
public class QuestionnaireController {

    @Autowired
    private QuestionnaireRepository questionnaireRepository;

    @PostMapping("/create")
    public ResponseEntity<Questionnaire> create(
            @RequestBody Questionnaire questionnaire) {

        Questionnaire saved = questionnaireRepository.save(questionnaire);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping(value = "/get", headers = "Accept=application/json")
	public List<Questionnaire> getallQuestionnaire() {
		// List<Questionnaire> allQuestionnaires = questionnaireRepository.findAll();
		
		return questionnaireRepository.findAll();
	}

    @GetMapping("/getbyid/{id}")
    public ResponseEntity<Questionnaire> getById(
            @PathVariable Long id) {

        Optional<Questionnaire> optional =
                questionnaireRepository.findById(id);

        return optional
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<Questionnaire> update(
            @PathVariable Long id,
            @RequestBody Questionnaire questionnaire) {

        return questionnaireRepository.findById(id)
                .map(existing -> {
                    existing.setModeId(questionnaire.getModeId());
                    existing.setPrice(questionnaire.getPrice());
                    existing.setIsFree(questionnaire.getIsFree());
                    existing.setTool(questionnaire.getTool());

                    Questionnaire updated =
                            questionnaireRepository.save(existing);

                    return ResponseEntity.ok(updated);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {

        if (!questionnaireRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        questionnaireRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
