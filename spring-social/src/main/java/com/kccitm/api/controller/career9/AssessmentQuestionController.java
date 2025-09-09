package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Set;

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
import com.kccitm.api.model.career9.QuestionSection;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.QuestionSectionRepository;


@RestController
@RequestMapping("/api/assessment-questions")
public class AssessmentQuestionController {

    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;

    @Autowired
    private QuestionSectionRepository questionSectionRepository;

    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;

    @GetMapping("/getAll")
    public List<AssessmentQuestions> getAllAssessmentQuestions() {
        return assessmentQuestionRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public AssessmentQuestions getAssessmentQuestionById(@PathVariable Long id) {
        return assessmentQuestionRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public AssessmentQuestions createAssessmentQuestion(@RequestBody AssessmentQuestions assessmentQuestions) {
        if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
            QuestionSection section = questionSectionRepository.findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
            assessmentQuestions.setSection(section);
        }
        
        if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
            for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
                option.setQuestion(assessmentQuestions);
            }
        }
        
        return assessmentQuestionRepository.save(assessmentQuestions);
    }
    @PutMapping("/update/{id}")
    public AssessmentQuestions updateAssessmentQuestion(@PathVariable Long id, @RequestBody AssessmentQuestions assessmentQuestions) {
        AssessmentQuestions existingQuestion = assessmentQuestionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with ID: " + id));
        
        existingQuestion.setQuestionText(assessmentQuestions.getQuestionText());
        existingQuestion.setQuestionType(assessmentQuestions.getQuestionType());
        
        if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
            QuestionSection section = questionSectionRepository.findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
            if (section != null) {
                existingQuestion.setSection(section);
            }
        }
        
        if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
            if (existingQuestion.getOptions() != null) {
                existingQuestion.getOptions().clear();
            }
            
            for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
                option.setQuestion(existingQuestion);
            }
            existingQuestion.setOptions(assessmentQuestions.getOptions());
        }
        
        return assessmentQuestionRepository.save(existingQuestion);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteAssessmentQuestion(@PathVariable Long id) {
        assessmentQuestionRepository.deleteById(id);
    }
    
    // Many-to-Many relationship management endpoints for MeasuredQualityTypes
    
    @PostMapping("/{questionId}/measured-quality-types/{typeId}")
    public ResponseEntity<String> addMeasuredQualityTypeToQuestion(@PathVariable Long questionId, @PathVariable Long typeId) {
        AssessmentQuestions question = assessmentQuestionRepository.findById(questionId).orElse(null);
        MeasuredQualityTypes type = measuredQualityTypesRepository.findById(typeId).orElse(null);

        if (question == null || type == null) {
            return ResponseEntity.badRequest().body("AssessmentQuestion or MeasuredQualityType not found");
        }

        question.addMeasuredQualityType(type);
        assessmentQuestionRepository.save(question);

        return ResponseEntity.ok("MeasuredQualityType successfully associated with AssessmentQuestion");
    }

    @DeleteMapping("/{questionId}/measured-quality-types/{typeId}")
    public ResponseEntity<String> removeMeasuredQualityTypeFromQuestion(@PathVariable Long questionId, @PathVariable Long typeId) {
        AssessmentQuestions question = assessmentQuestionRepository.findById(questionId).orElse(null);
        MeasuredQualityTypes type = measuredQualityTypesRepository.findById(typeId).orElse(null);

        if (question == null || type == null) {
            return ResponseEntity.badRequest().body("AssessmentQuestion or MeasuredQualityType not found");
        }

        question.removeMeasuredQualityType(type);
        assessmentQuestionRepository.save(question);

        return ResponseEntity.ok("MeasuredQualityType successfully removed from AssessmentQuestion");
    }

    @GetMapping("/{questionId}/measured-quality-types")
    public ResponseEntity<Set<MeasuredQualityTypes>> getQuestionMeasuredQualityTypes(@PathVariable Long questionId) {
        AssessmentQuestions question = assessmentQuestionRepository.findById(questionId).orElse(null);

        if (question == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(question.getMeasuredQualityTypes());
    }
}
