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

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;


@RestController
@RequestMapping("/api/assessment-question-options")
public class AssessmentQuestionOptionsController {

    @Autowired
    private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;
    
    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;

    @GetMapping("/getAll")
    public List<AssessmentQuestionOptions> getAllAssessmentQuestionOptions() {
        List<AssessmentQuestionOptions> aqo =  assessmentQuestionOptionsRepository.findAll();
        aqo.iterator().forEachRemaining(option -> {
            // Force loading of lazy relationships
            option.getOptionScores().iterator().forEachRemaining(score -> {
                score.setMeasuredQualityType(new MeasuredQualityTypes(score.getMeasuredQualityType().getMeasuredQualityTypeId()));
                    score.setQuestion_option(new AssessmentQuestionOptions(score.getQuestion_option().getOptionId()));
            });
            
        });
        return aqo;
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<AssessmentQuestionOptions> getAssessmentQuestionOptionsById(@PathVariable Long id) {
        Optional<AssessmentQuestionOptions> option = assessmentQuestionOptionsRepository.findById(id);
        return option.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/create")
    public ResponseEntity<AssessmentQuestionOptions> createAssessmentQuestionOptions(@RequestBody AssessmentQuestionOptions assessmentQuestionOptions) {
        try {
            // Validate that the question exists if provided
            if (assessmentQuestionOptions.getQuestion() != null && assessmentQuestionOptions.getQuestion().getQuestionId() != null) {
                AssessmentQuestions question = assessmentQuestionRepository.findById(assessmentQuestionOptions.getQuestion().getQuestionId()).orElse(null);
                if (question == null) {
                    return ResponseEntity.badRequest().build();
                }
                assessmentQuestionOptions.setQuestion(question);
            }
            
            AssessmentQuestionOptions savedOption = assessmentQuestionOptionsRepository.save(assessmentQuestionOptions);
            return ResponseEntity.ok(savedOption);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @PutMapping("/update/{id}")
    public ResponseEntity<AssessmentQuestionOptions> updateAssessmentQuestionOptions(@PathVariable Long id, @RequestBody AssessmentQuestionOptions assessmentQuestionOptions) {
        if (!assessmentQuestionOptionsRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            // Get existing option to preserve relationships
            AssessmentQuestionOptions existingOption = assessmentQuestionOptionsRepository.findById(id).orElse(null);
            if (existingOption == null) {
                return ResponseEntity.notFound().build();
            }
            
            // Update basic fields
            existingOption.setOptionText(assessmentQuestionOptions.getOptionText());
            existingOption.setCorrect(assessmentQuestionOptions.isCorrect());
            
            // Update question relationship if provided
            if (assessmentQuestionOptions.getQuestion() != null && assessmentQuestionOptions.getQuestion().getQuestionId() != null) {
                AssessmentQuestions question = assessmentQuestionRepository.findById(assessmentQuestionOptions.getQuestion().getQuestionId()).orElse(null);
                if (question != null) {
                    existingOption.setQuestion(question);
                }
            }
            
            AssessmentQuestionOptions updatedOption = assessmentQuestionOptionsRepository.save(existingOption);
            return ResponseEntity.ok(updatedOption);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteAssessmentQuestionOptions(@PathVariable Long id) {
        if (!assessmentQuestionOptionsRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            assessmentQuestionOptionsRepository.deleteById(id);
            return ResponseEntity.ok("Assessment question option deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to delete option: " + e.getMessage());
        }
    }
    
    // Additional endpoints for relationship management
    @GetMapping("/by-question/{questionId}")
    public ResponseEntity<List<AssessmentQuestionOptions>> getOptionsByQuestion(@PathVariable Long questionId) {
        AssessmentQuestions question = assessmentQuestionRepository.findById(questionId).orElse(null);
        if (question == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(question.getOptions());
    }
}
