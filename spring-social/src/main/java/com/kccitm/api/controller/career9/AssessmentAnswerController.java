package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@RestController
@RequestMapping("/assessment-answer")
public class AssessmentAnswerController {
    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;

    @Autowired
    private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @GetMapping(value = "/getByStudent/{studentId}", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAssessmentAnswersByStudent(@PathVariable("studentId") Long studentId) {
        UserStudent userStudent = userStudentRepository.findById(studentId).orElse(null);
        return assessmentAnswerRepository.findByUserStudent(userStudent);
    }

    @GetMapping(value = "/getAll", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAllAssessmentAnswers() {
        return assessmentAnswerRepository.findAll();
    }

    @PostMapping(value = "/submit", headers = "Accept=application/json")
    public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
        try {
            // Extract userStudentId and assessmentId
            Long userStudentId = submissionData.get("userStudentId") != null 
                ? ((Number) submissionData.get("userStudentId")).longValue() 
                : null;
            Long assessmentId = submissionData.get("assessmentId") != null 
                ? ((Number) submissionData.get("assessmentId")).longValue() 
                : null;

            if (userStudentId == null || assessmentId == null) {
                return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
            }

            // Fetch UserStudent and AssessmentTable
            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new RuntimeException("UserStudent not found with id: " + userStudentId));
            
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found with id: " + assessmentId));

            StudentAssessmentMapping studentAssessmentMapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseGet(() -> {
                    StudentAssessmentMapping mapping = new StudentAssessmentMapping();
                    mapping.setUserStudent(userStudent);
                    mapping.setAssessmentId(assessmentId);
                    return studentAssessmentMappingRepository.save(mapping);
                });

            // Extract answers list
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");

            if (answers == null || answers.isEmpty()) {
                return ResponseEntity.badRequest().body("No answers provided");
            }

            List<AssessmentAnswer> savedAnswers = new ArrayList<>();
            Map<Long, Integer> rawScoresByQualityType = new HashMap<>();
            Map<Long, MeasuredQualityTypes> qualityTypeLookup = new HashMap<>();

            // Process each answer
            for (Map<String, Object> answer : answers) {
                Long questionnaireQuestionId = answer.get("questionnaireQuestionId") != null 
                    ? ((Number) answer.get("questionnaireQuestionId")).longValue() 
                    : null;
                Long optionId = answer.get("optionId") != null 
                    ? ((Number) answer.get("optionId")).longValue() 
                    : null;

                if (questionnaireQuestionId == null || optionId == null) {
                    continue; // Skip invalid entries
                }

                // Fetch QuestionnaireQuestion and AssessmentQuestionOptions
                QuestionnaireQuestion questionnaireQuestion = questionnaireQuestionRepository
                    .findById(questionnaireQuestionId)
                    .orElse(null);
                
                AssessmentQuestionOptions option = assessmentQuestionOptionsRepository
                    .findById(optionId)
                    .orElse(null);

                if (questionnaireQuestion == null || option == null) {
                    continue; // Skip if entities not found
                }

                // Create new AssessmentAnswer entity
                AssessmentAnswer assessmentAnswer = new AssessmentAnswer();
                assessmentAnswer.setUserStudent(userStudent);
                assessmentAnswer.setAssessment(assessment);
                assessmentAnswer.setQuestionnaireQuestion(questionnaireQuestion);
                assessmentAnswer.setOption(option);

                // Save to database
                AssessmentAnswer saved = assessmentAnswerRepository.save(assessmentAnswer);
                savedAnswers.add(saved);

                // Capture raw score contributions for this option
                List<OptionScoreBasedOnMEasuredQualityTypes> optionScores = optionScoreRepository.findByOptionId(optionId);
                for (OptionScoreBasedOnMEasuredQualityTypes optionScore : optionScores) {
                    MeasuredQualityTypes qualityType = optionScore.getMeasuredQualityType();
                    if (qualityType == null || qualityType.getMeasuredQualityTypeId() == null) {
                        continue;
                    }

                    Long qualityTypeId = qualityType.getMeasuredQualityTypeId();
                    int optionScoreValue = optionScore.getScore() != null ? optionScore.getScore() : 0;
                    rawScoresByQualityType.merge(qualityTypeId, optionScoreValue, Integer::sum);
                    qualityTypeLookup.putIfAbsent(qualityTypeId, qualityType);
                }
            }

            // Clear any existing raw scores for this student/assessment mapping and save new ones
            assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(
                studentAssessmentMapping.getStudentAssessmentId());

            List<AssessmentRawScore> savedRawScores = new ArrayList<>();
            for (Map.Entry<Long, Integer> entry : rawScoresByQualityType.entrySet()) {
                MeasuredQualityTypes qualityType = qualityTypeLookup.get(entry.getKey());
                AssessmentRawScore rawScore = new AssessmentRawScore();
                rawScore.setStudentAssessmentMapping(studentAssessmentMapping);
                rawScore.setMeasuredQualityType(qualityType);
                rawScore.setMeasuredQuality(qualityType != null ? qualityType.getMeasuredQuality() : null);
                rawScore.setRawScore(entry.getValue());
                savedRawScores.add(assessmentRawScoreRepository.save(rawScore));
            }

            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("savedAnswers", savedAnswers);
            responseBody.put("rawScores", savedRawScores);

            return ResponseEntity.ok(responseBody);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error saving assessment answers: " + e.getMessage());
        }
    }
}
