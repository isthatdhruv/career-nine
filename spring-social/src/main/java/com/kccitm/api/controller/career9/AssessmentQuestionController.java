package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;


@RestController
@RequestMapping("/api/assessment-questions")
public class AssessmentQuestionController {

    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;

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
        return assessmentQuestionRepository.save(assessmentQuestions);
    }
    @PutMapping("/update/{id}")
    public AssessmentQuestions updateAssessmentQuestion(@PathVariable Long id, @RequestBody AssessmentQuestions assessmentQuestions) {
        assessmentQuestions.setId(id);
        return assessmentQuestionRepository.save(assessmentQuestions);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteAssessmentQuestion(@PathVariable Long id) {
        assessmentQuestionRepository.deleteById(id);
    }
}
