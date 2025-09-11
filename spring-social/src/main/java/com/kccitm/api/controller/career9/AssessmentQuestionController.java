package com.kccitm.api.controller.career9;

import java.util.List;

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
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
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
        List<AssessmentQuestions> assementQuestionsObject = assessmentQuestionRepository.findAll();
        assementQuestionsObject.iterator().forEachRemaining(assmentQuestion->{
            assmentQuestion.getOptions().iterator().forEachRemaining(option->{
                option.getOptionScores().iterator().forEachRemaining(score->{
                    score.setMeasuredQualityType(new MeasuredQualityTypes(score.getMeasuredQualityType().getMeasuredQualityTypeId()));
                    score.setQuestion_option(new AssessmentQuestionOptions(score.getQuestion_option().getOptionId()));
                });
            }); 
        });
        return assementQuestionsObject;
    }

    @GetMapping("/get/{id}")
    public AssessmentQuestions getAssessmentQuestionById(@PathVariable Long id) {
        return assessmentQuestionRepository.findById(id).orElse(null);
    }

    @PostMapping(value = "/create", consumes = "application/json")
    public AssessmentQuestions createAssessmentQuestion(@RequestBody AssessmentQuestions assessmentQuestions) throws Exception{
        AssessmentQuestions assementQustionObject ;
        // if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
        //     QuestionSection section = questionSectionRepository.findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
        //     assessmentQuestions.setSection(section);
        // }

        // if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
        //     for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
        //         option.setQuestion(assessmentQuestions);
        //     }
        // }

        
        //   List<AssessmentQuestionOptions> assessmentQuestionOptions =   assessmentQuestions.getOptions();
          
          // Example: before saving AssessmentQuestions
for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
    option.setQuestion(assessmentQuestions); // set parent question
    if (option.getOptionScores() != null) {
        for (OptionScoreBasedOnMEasuredQualityTypes score : option.getOptionScores()) {
            score.setQuestion_option(option); // set parent option
        }
    }
}

          assementQustionObject   = assessmentQuestionRepository.save(assessmentQuestions);
          
          
       
          
          assementQustionObject.getOptions().iterator().forEachRemaining(option->{
                option.getOptionScores().iterator().forEachRemaining(score->{
                    score.setMeasuredQualityType(new MeasuredQualityTypes(score.getMeasuredQualityType().getMeasuredQualityTypeId()));
                    score.setQuestion_option(new AssessmentQuestionOptions(score.getQuestion_option().getOptionId()));
                });
            });
        
        return assementQustionObject.getId() != null ? assementQustionObject : null;
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
    public ResponseEntity<String> deleteAssessmentQuestion(@PathVariable Long id) {
        if (!assessmentQuestionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        // This will also delete all related AssessmentQuestionOptions and join table entries due to cascade settings.
        assessmentQuestionRepository.deleteById(id);
        return ResponseEntity.ok("AssessmentQuestion and all related options/relationships deleted successfully.");
    }
    
    // Many-to-Many relationship management endpoints for MeasuredQualityTypes
    
    

}
