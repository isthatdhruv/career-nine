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

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;


@RestController
@RequestMapping("/api/assessment-question-options")
public class AssessmentQuestionOptionsController {

    @Autowired
    private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;

    @GetMapping("/getAll")
    public List<AssessmentQuestionOptions> getAllAssessmentQuestionOptions() {
        return assessmentQuestionOptionsRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public AssessmentQuestionOptions getAssessmentQuestionOptionsById(@PathVariable Long id) {
        return assessmentQuestionOptionsRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public AssessmentQuestionOptions createAssessmentQuestionOptions(@RequestBody AssessmentQuestionOptions assessmentQuestionOptions) {
        return assessmentQuestionOptionsRepository.save(assessmentQuestionOptions);
    }
    @PutMapping("/update/{id}")
    public AssessmentQuestionOptions updateAssessmentQuestionOptions(@PathVariable Long id, @RequestBody AssessmentQuestionOptions assessmentQuestionOptions) {
        assessmentQuestionOptions.setOptionId(id);
        return assessmentQuestionOptionsRepository.save(assessmentQuestionOptions);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteAssessmentQuestionOptions(@PathVariable Long id) {
        assessmentQuestionOptionsRepository.deleteById(id);
    }
}
