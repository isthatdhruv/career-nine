package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;

@RestController
@RequestMapping("/assessment-answer")
public class AssessmentAnswerController {
    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @GetMapping(value = "/getByStudent/{studentId}", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAssessmentAnswersByStudent(@PathVariable("studentId") Long studentId) {
        UserStudent userStudent = userStudentRepository.findById(studentId).orElse(null);
        return assessmentAnswerRepository.findByUserStudent(userStudent);
    }

    @GetMapping(value = "/getAll", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAllAssessmentAnswers() {
        return assessmentAnswerRepository.findAll();
    }
}