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
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse.*;
import com.kccitm.api.model.career9.MeasuredQualities;

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

    /**
     * Comprehensive endpoint to fetch all assessment data for a student dashboard
     *
     * Returns:
     * - Student basic information
     * - All assessments taken by the student
     * - All answers with selected options and their MQT scores
     * - Aggregated raw scores by MQT for each assessment
     *
     * Request body should contain:
     * {
     *   "userStudentId": 123
     * }
     *
     * @param requestData - JSON containing userStudentId
     * @return StudentDashboardResponse with complete assessment data
     */
    @PostMapping(value = "/dashboard", headers = "Accept=application/json")
    public ResponseEntity<?> getStudentDashboard(@RequestBody Map<String, Object> requestData) {
        try {
            // 1. Extract and validate userStudentId from request body
            if (!requestData.containsKey("userStudentId")) {
                return ResponseEntity.status(400).body(Map.of(
                    "error", "Missing required field",
                    "message", "userStudentId is required in request body"
                ));
            }

            Long userStudentId = ((Number) requestData.get("userStudentId")).longValue();

            // 2. Fetch and validate student
            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElseThrow(() -> new RuntimeException("UserStudent not found with ID: " + userStudentId));

            // 3. Build student basic info
            StudentBasicInfo studentInfo = new StudentBasicInfo();
            studentInfo.setUserStudentId(userStudent.getUserStudentId());
            studentInfo.setUserId(userStudent.getUserId());

            if (userStudent.getInstitute() != null) {
                studentInfo.setInstituteName(userStudent.getInstitute().getInstituteName());
                studentInfo.setInstituteCode(userStudent.getInstitute().getInstituteCode());
            }

            // 4. Fetch all assessments for this student
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findByUserStudentUserStudentId(userStudentId);

            List<AssessmentData> assessmentDataList = new ArrayList<>();

            // 5. Process each assessment
            for (StudentAssessmentMapping mapping : mappings) {
                AssessmentData assessmentData = new AssessmentData();

                // 5.1 Set assessment basic info
                Long assessmentId = mapping.getAssessmentId();
                AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);

                if (assessment == null) {
                    continue; // Skip if assessment not found
                }

                assessmentData.setAssessmentId(assessmentId);
                assessmentData.setAssessmentName(assessment.getAssessmentName());
                assessmentData.setStatus(mapping.getStatus());
                assessmentData.setIsActive(assessment.getIsActive());
                assessmentData.setStartDate(assessment.getStarDate());
                assessmentData.setEndDate(assessment.getEndDate());
                assessmentData.setStudentAssessmentMappingId(mapping.getStudentAssessmentId());

                // 5.1.1 Set questionnaire type (true = bet-assessment, false/null = general)
                if (assessment.getQuestionnaire() != null) {
                    assessmentData.setQuestionnaireType(assessment.getQuestionnaire().getType());
                }

                // 5.2 Fetch all answers for this assessment using optimized query
                ArrayList<AssessmentAnswer> answers = assessmentAnswerRepository
                        .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

                List<AnswerDetail> answerDetails = new ArrayList<>();

                for (AssessmentAnswer answer : answers) {
                    AnswerDetail answerDetail = new AnswerDetail();
                    answerDetail.setAssessmentAnswerId(answer.getAssessmentAnswerId());

                    if (answer.getQuestionnaireQuestion() != null) {
                        answerDetail.setQuestionnaireQuestionId(
                                answer.getQuestionnaireQuestion().getQuestionnaireQuestionId());
                    }

                    answerDetail.setRankOrder(answer.getRankOrder());

                    // 5.3 Build option data with MQT scores
                    if (answer.getOption() != null) {
                        AssessmentQuestionOptions option = answer.getOption();
                        OptionData optionData = new OptionData();
                        optionData.setOptionId(option.getOptionId());
                        optionData.setOptionText(option.getOptionText());
                        optionData.setOptionDescription(option.getOptionDescription());
                        optionData.setIsCorrect(option.isCorrect());

                        // 5.4 Fetch MQT scores for this option
                        List<OptionScoreBasedOnMEasuredQualityTypes> optionScores = option.getOptionScores();
                        List<MQTScore> mqtScores = new ArrayList<>();

                        if (optionScores != null) {
                            for (OptionScoreBasedOnMEasuredQualityTypes optionScore : optionScores) {
                                MQTScore mqtScore = new MQTScore();
                                mqtScore.setScoreId(optionScore.getScoreId());
                                mqtScore.setScore(optionScore.getScore());

                                // Build MQT data
                                if (optionScore.getMeasuredQualityType() != null) {
                                    MeasuredQualityTypes mqt = optionScore.getMeasuredQualityType();
                                    MQTData mqtData = new MQTData();
                                    mqtData.setMeasuredQualityTypeId(mqt.getMeasuredQualityTypeId());
                                    mqtData.setName(mqt.getMeasuredQualityTypeName());
                                    mqtData.setDescription(mqt.getMeasuredQualityTypeDescription());
                                    mqtData.setDisplayName(mqt.getMeasuredQualityTypeDisplayName());

                                    // Build MQ data (parent quality)
                                    if (mqt.getMeasuredQuality() != null) {
                                        MeasuredQualities mq = mqt.getMeasuredQuality();
                                        MQData mqData = new MQData();
                                        mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                                        mqData.setName(mq.getMeasuredQualityName());
                                        mqData.setDescription(mq.getMeasuredQualityDescription());
                                        mqData.setDisplayName(mq.getQualityDisplayName());

                                        mqtData.setMeasuredQuality(mqData);
                                    }

                                    mqtScore.setMeasuredQualityType(mqtData);
                                }

                                mqtScores.add(mqtScore);
                            }
                        }

                        optionData.setMqtScores(mqtScores);
                        answerDetail.setSelectedOption(optionData);
                    }

                    answerDetails.add(answerDetail);
                }

                assessmentData.setAnswers(answerDetails);

                // 5.5 Fetch raw scores for this assessment
                List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                List<RawScoreData> rawScoreDataList = new ArrayList<>();

                for (AssessmentRawScore rawScore : rawScores) {
                    RawScoreData rawScoreData = new RawScoreData();
                    rawScoreData.setAssessmentRawScoreId(rawScore.getAssessmentRawScoreId());
                    rawScoreData.setRawScore(rawScore.getRawScore());

                    // Build MQT data for raw score
                    if (rawScore.getMeasuredQualityType() != null) {
                        MeasuredQualityTypes mqt = rawScore.getMeasuredQualityType();
                        MQTData mqtData = new MQTData();
                        mqtData.setMeasuredQualityTypeId(mqt.getMeasuredQualityTypeId());
                        mqtData.setName(mqt.getMeasuredQualityTypeName());
                        mqtData.setDescription(mqt.getMeasuredQualityTypeDescription());
                        mqtData.setDisplayName(mqt.getMeasuredQualityTypeDisplayName());

                        // Build MQ data
                        if (mqt.getMeasuredQuality() != null) {
                            MeasuredQualities mq = mqt.getMeasuredQuality();
                            MQData mqData = new MQData();
                            mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                            mqData.setName(mq.getMeasuredQualityName());
                            mqData.setDescription(mq.getMeasuredQualityDescription());
                            mqData.setDisplayName(mq.getQualityDisplayName());

                            mqtData.setMeasuredQuality(mqData);
                        }

                        rawScoreData.setMeasuredQualityType(mqtData);
                    }

                    // Build MQ data for raw score (direct reference)
                    if (rawScore.getMeasuredQuality() != null) {
                        MeasuredQualities mq = rawScore.getMeasuredQuality();
                        MQData mqData = new MQData();
                        mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                        mqData.setName(mq.getMeasuredQualityName());
                        mqData.setDescription(mq.getMeasuredQualityDescription());
                        mqData.setDisplayName(mq.getQualityDisplayName());

                        rawScoreData.setMeasuredQuality(mqData);
                    }

                    rawScoreDataList.add(rawScoreData);
                }

                assessmentData.setRawScores(rawScoreDataList);
                assessmentDataList.add(assessmentData);
            }

            // 6. Build and return final response
            StudentDashboardResponse response = new StudentDashboardResponse();
            response.setStudentInfo(studentInfo);
            response.setAssessments(assessmentDataList);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch student dashboard data",
                "message", e.getMessage()
            ));
        }
    }
}
