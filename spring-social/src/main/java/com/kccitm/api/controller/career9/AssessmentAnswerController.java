package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
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

    @Transactional
    @PostMapping(value = "/submit", headers = "Accept=application/json")
    public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
        try {
            // 1. Basic Extraction & Validation
            Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
            Long assessmentId = ((Number) submissionData.get("assessmentId")).longValue();

            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElseThrow(() -> new RuntimeException("UserStudent not found"));

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            // 2. Extract status if provided
            String status = submissionData.containsKey("status")
                    ? (String) submissionData.get("status")
                    : null;

            // 3. Manage Mapping (Required for AssessmentRawScore)
            StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                    .orElseGet(() -> {
                        StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                        newMapping.setUserStudent(userStudent);
                        newMapping.setAssessmentId(assessmentId);
                        return studentAssessmentMappingRepository.save(newMapping);
                    });

            // Update status if provided
            if (status != null) {
                mapping.setStatus(status);
                studentAssessmentMappingRepository.save(mapping);
            }

            List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");

            // Data structures for score calculation
            Map<Long, Integer> qualityTypeScores = new HashMap<>();
            Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();

            // 3. Process Answers
            for (Map<String, Object> ansMap : answers) {
                Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
                Long oId = ((Number) ansMap.get("optionId")).longValue();
                Integer rankOrder = ansMap.containsKey("rankOrder")
                        ? ((Number) ansMap.get("rankOrder")).intValue()
                        : null;

                QuestionnaireQuestion question = questionnaireQuestionRepository.findById(qId).orElse(null);
                AssessmentQuestionOptions option = assessmentQuestionOptionsRepository.findById(oId).orElse(null);

                if (question != null && option != null) {
                    // Save AssessmentAnswer
                    AssessmentAnswer ans = new AssessmentAnswer();
                    ans.setUserStudent(userStudent);
                    ans.setAssessment(assessment);
                    ans.setQuestionnaireQuestion(question);
                    ans.setOption(option);

                    // Set rankOrder if present (for ranking questions)
                    if (rankOrder != null) {
                        ans.setRankOrder(rankOrder);
                    }

                    assessmentAnswerRepository.save(ans);

                    // Accumulate Scores for RawScore table
                    List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository.findByOptionId(oId);
                    for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                        MeasuredQualityTypes type = s.getMeasuredQualityType();
                        Long typeId = type.getMeasuredQualityTypeId();

                        qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                        qualityTypeCache.putIfAbsent(typeId, type);
                    }
                }
            }

            // 4. Update Raw Scores (Delete old, Save new)
            assessmentRawScoreRepository
                    .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

            List<AssessmentRawScore> finalScores = new ArrayList<>();
            for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());

                AssessmentRawScore ars = new AssessmentRawScore();
                ars.setStudentAssessmentMapping(mapping);
                ars.setMeasuredQualityType(mqt);
                // Crucial: Also link the parent 'MeasuredQuality' from the type
                ars.setMeasuredQuality(mqt.getMeasuredQuality());
                ars.setRawScore(entry.getValue());

                finalScores.add(assessmentRawScoreRepository.save(ars));
            }

            return ResponseEntity.ok(Map.of("status", "success", "scoresSaved", finalScores.size()));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }
}
