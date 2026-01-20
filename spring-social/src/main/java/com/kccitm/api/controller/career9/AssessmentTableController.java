package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireRepository;

@RestController
@RequestMapping("/assessments")
public class AssessmentTableController {

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private QuestionnaireRepository questionnaireRepository;

    @GetMapping("/getAll")
    // @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<AssessmentTable>> getAllAssessments() {
        List<AssessmentTable> assessments = assessmentTableRepository.findAll();
        return ResponseEntity.ok(assessments);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssessmentTable> getAssessmentById(@PathVariable Long id) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findById(id);
        return assessment.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/getby/{id}")
    public List<Questionnaire> getQuestionnaireById(@PathVariable Long id) {

        Long questionnaireId = assessmentTableRepository.findById(id).get().getQuestionnaire().getQuestionnaireId();

        return questionnaireRepository.findAllByQuestionnaireId(questionnaireId);
    }

    @PostMapping("/create")
    public ResponseEntity<AssessmentTable> createAssessment(@RequestBody java.util.Map<String, Object> requestBody) {
        AssessmentTable assessment = new AssessmentTable();

        // Set basic fields from request body
        if (requestBody.get("AssessmentName") != null) {
            assessment.setAssessmentName((String) requestBody.get("AssessmentName"));
        }
        if (requestBody.get("starDate") != null) {
            assessment.setStarDate((String) requestBody.get("starDate"));
        }
        if (requestBody.get("endDate") != null) {
            assessment.setEndDate((String) requestBody.get("endDate"));
        }
        if (requestBody.get("isActive") != null) {
            assessment.setIsActive((Boolean) requestBody.get("isActive"));
        }
        if (requestBody.get("modeofAssessment") != null) {
            assessment.setModeofAssessment((Boolean) requestBody.get("modeofAssessment"));
        }

        // Handle questionnaire - fetch existing entity by ID
        if (requestBody.get("questionnaire") != null) {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> questionnaireData = (java.util.Map<String, Object>) requestBody
                    .get("questionnaire");
            Long questionnaireId = null;

            // Check for questionnaireId field
            if (questionnaireData.get("questionnaireId") != null) {
                questionnaireId = ((Number) questionnaireData.get("questionnaireId")).longValue();
            } else if (questionnaireData.get("id") != null) {
                questionnaireId = ((Number) questionnaireData.get("id")).longValue();
            }

            if (questionnaireId != null) {
                Optional<Questionnaire> existingQuestionnaire = questionnaireRepository.findById(questionnaireId);
                if (existingQuestionnaire.isPresent()) {
                    assessment.setQuestionnaire(existingQuestionnaire.get());
                } else {
                    return ResponseEntity.badRequest().build();
                }
            }
        }

        AssessmentTable savedAssessment = assessmentTableRepository.save(assessment);
        return ResponseEntity.ok(savedAssessment);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AssessmentTable> updateAssessment(@PathVariable Long id,
            @RequestBody AssessmentTable assessment) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessment.setId(id);
        AssessmentTable updatedAssessment = assessmentTableRepository.save(assessment);
        return ResponseEntity.ok(updatedAssessment);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssessment(@PathVariable Long id) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessmentTableRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

}
