package com.kccitm.api.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

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

/**
 * Async processor for assessment submissions.
 * Reads submission data from Redis (saved by the /submit endpoint),
 * processes answers, calculates scores, and persists to MySQL in the background.
 * Includes a retry scheduler for failed submissions.
 */
@Service
public class AssessmentSubmissionProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentSubmissionProcessorService.class);

    @Autowired
    private AssessmentSessionService assessmentSessionService;

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

    /**
     * Async entry point — called by /submit controller after saving to Redis.
     * Reads submission from Redis, processes answers + scores, persists to MySQL.
     */
    @Async
    @SuppressWarnings("unchecked")
    public void processSubmissionAsync(Long studentId, Long assessmentId) {
        logger.info("Async processing started for student={} assessment={}", studentId, assessmentId);

        try {
            Map<String, Object> submissionData = assessmentSessionService.getSubmittedAnswers(studentId, assessmentId);
            if (submissionData == null) {
                logger.error("No submitted data found in Redis for student={} assessment={}", studentId, assessmentId);
                assessmentSessionService.clearSubmissionLock(studentId, assessmentId);
                return;
            }

            List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");
            if (answers == null || answers.isEmpty()) {
                logger.warn("No answers in submission for student={} assessment={}", studentId, assessmentId);
                assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "completed");
                assessmentSessionService.markSubmissionComplete(studentId, assessmentId,
                        Map.of("status", "success", "answersSaved", 0, "scoresSaved", 0));
                return;
            }

            UserStudent userStudent = userStudentRepository.findById(studentId).orElse(null);
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
            if (userStudent == null || assessment == null) {
                logger.error("UserStudent or Assessment not found for student={} assessment={}", studentId, assessmentId);
                assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "failed");
                assessmentSessionService.clearSubmissionLock(studentId, assessmentId);
                return;
            }

            StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId)
                    .orElse(null);
            if (mapping == null) {
                logger.error("StudentAssessmentMapping not found for student={} assessment={}", studentId, assessmentId);
                assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "failed");
                assessmentSessionService.clearSubmissionLock(studentId, assessmentId);
                return;
            }

            // 1. Pre-fetch all needed entities in bulk
            List<Long> questionIds = new ArrayList<>();
            List<Long> optionIds = new ArrayList<>();
            for (Map<String, Object> ansMap : answers) {
                questionIds.add(((Number) ansMap.get("questionnaireQuestionId")).longValue());
                if (ansMap.containsKey("optionId")) {
                    optionIds.add(((Number) ansMap.get("optionId")).longValue());
                }
            }

            Map<Long, QuestionnaireQuestion> questionCache = new HashMap<>();
            if (!questionIds.isEmpty()) {
                questionnaireQuestionRepository.findAllByIdIn(questionIds)
                        .forEach(qq -> questionCache.put(qq.getQuestionnaireQuestionId(), qq));
            }

            Map<Long, AssessmentQuestionOptions> optionCache = new HashMap<>();
            if (!optionIds.isEmpty()) {
                assessmentQuestionOptionsRepository.findAllById(optionIds)
                        .forEach(opt -> optionCache.put(opt.getOptionId(), opt));
            }

            Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId = new HashMap<>();
            if (!optionIds.isEmpty()) {
                List<OptionScoreBasedOnMEasuredQualityTypes> allScores = optionScoreRepository.findByOptionIdIn(optionIds);
                for (OptionScoreBasedOnMEasuredQualityTypes s : allScores) {
                    scoresByOptionId
                            .computeIfAbsent(s.getQuestion_option().getOptionId(), k -> new ArrayList<>())
                            .add(s);
                }
            }

            // 2. Process answers — text matching, option scoring, rank multipliers, MQT dedup
            Map<Long, Integer> qualityTypeScores = new HashMap<>();
            Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();
            List<AssessmentAnswer> answersToSave = new ArrayList<>();
            int skippedCount = 0;

            for (Map<String, Object> ansMap : answers) {
                Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
                QuestionnaireQuestion question = questionCache.get(qId);

                String textResponse = ansMap.containsKey("textResponse")
                        ? (String) ansMap.get("textResponse")
                        : null;

                if (textResponse != null && question != null) {
                    // Check if this exact text was previously mapped for the same question
                    var previousMapping = assessmentAnswerRepository
                            .findFirstByQuestionnaireQuestion_QuestionnaireQuestionIdAndTextResponseAndMappedOptionIsNotNull(
                                    qId, textResponse);
                    if (previousMapping.isPresent()) {
                        AssessmentQuestionOptions mappedOpt = previousMapping.get().getMappedOption();
                        AssessmentAnswer ans = new AssessmentAnswer();
                        ans.setUserStudent(userStudent);
                        ans.setAssessment(assessment);
                        ans.setQuestionnaireQuestion(question);
                        ans.setOption(mappedOpt);
                        answersToSave.add(ans);

                        // Fetch scores for mapped option if not already in cache
                        Long mappedOptId = mappedOpt.getOptionId();
                        if (!scoresByOptionId.containsKey(mappedOptId)) {
                            List<OptionScoreBasedOnMEasuredQualityTypes> mappedScores =
                                    optionScoreRepository.findByOptionId(mappedOptId);
                            scoresByOptionId.put(mappedOptId, mappedScores);
                        }
                        // Accumulate scores from the mapped option
                        List<OptionScoreBasedOnMEasuredQualityTypes> scores = scoresByOptionId
                                .getOrDefault(mappedOptId, Collections.emptyList());
                        for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                            MeasuredQualityTypes type = s.getMeasuredQualityType();
                            Long typeId = type.getMeasuredQualityTypeId();
                            qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                            qualityTypeCache.putIfAbsent(typeId, type);
                        }
                    } else {
                        AssessmentAnswer ans = new AssessmentAnswer();
                        ans.setUserStudent(userStudent);
                        ans.setAssessment(assessment);
                        ans.setQuestionnaireQuestion(question);
                        ans.setTextResponse(textResponse);
                        answersToSave.add(ans);
                    }
                } else if (ansMap.containsKey("optionId")) {
                    Long oId = ((Number) ansMap.get("optionId")).longValue();
                    Integer rankOrder = ansMap.containsKey("rankOrder")
                            ? ((Number) ansMap.get("rankOrder")).intValue()
                            : null;

                    AssessmentQuestionOptions option = optionCache.get(oId);

                    if (question == null || option == null) {
                        skippedCount++;
                        continue;
                    }

                    AssessmentAnswer ans = new AssessmentAnswer();
                    ans.setUserStudent(userStudent);
                    ans.setAssessment(assessment);
                    ans.setQuestionnaireQuestion(question);
                    ans.setOption(option);

                    if (rankOrder != null) {
                        ans.setRankOrder(rankOrder);
                    }

                    answersToSave.add(ans);

                    // Accumulate scores with MQT dedup per option
                    List<OptionScoreBasedOnMEasuredQualityTypes> scores = scoresByOptionId
                            .getOrDefault(oId, Collections.emptyList());
                    Map<Long, OptionScoreBasedOnMEasuredQualityTypes> dedupedScores = new LinkedHashMap<>();
                    for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                        dedupedScores.putIfAbsent(s.getMeasuredQualityType().getMeasuredQualityTypeId(), s);
                    }
                    for (OptionScoreBasedOnMEasuredQualityTypes s : dedupedScores.values()) {
                        MeasuredQualityTypes type = s.getMeasuredQualityType();
                        Long typeId = type.getMeasuredQualityTypeId();
                        int effectiveScore = (rankOrder != null) ? s.getScore() * rankOrder : s.getScore();
                        qualityTypeScores.merge(typeId, effectiveScore, Integer::sum);
                        qualityTypeCache.putIfAbsent(typeId, type);
                    }
                }
            }

            // 3. Build raw scores list
            List<AssessmentRawScore> rawScoresToSave = new ArrayList<>();
            for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                AssessmentRawScore ars = new AssessmentRawScore();
                ars.setStudentAssessmentMapping(mapping);
                ars.setMeasuredQualityType(mqt);
                ars.setMeasuredQuality(mqt.getMeasuredQuality());
                ars.setRawScore(entry.getValue());
                rawScoresToSave.add(ars);
            }

            // 4. Persist to MySQL (transactional)
            persistToMySQL(studentId, assessmentId, mapping, answersToSave, rawScoresToSave);

            // 5. Mark as completed (no Redis deletion — 24h/48h TTL handles cleanup)
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("scoresSaved", rawScoresToSave.size());
            result.put("answersSaved", answersToSave.size());
            result.put("skippedAnswers", skippedCount);

            assessmentSessionService.markSubmissionComplete(studentId, assessmentId, result);
            assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "completed");

            logger.info("Async processing completed for student={} assessment={}: {} answers, {} scores",
                    studentId, assessmentId, answersToSave.size(), rawScoresToSave.size());

        } catch (Exception e) {
            logger.error("Async processing failed for student={} assessment={}", studentId, assessmentId, e);
            assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "failed");
            assessmentSessionService.clearSubmissionLock(studentId, assessmentId);
        }
    }

    /**
     * Transactional MySQL write: save-before-delete pattern.
     * Saves new answers and scores first, then deletes old ones by specific IDs.
     */
    @Transactional
    public void persistToMySQL(Long studentId, Long assessmentId,
                               StudentAssessmentMapping mapping,
                               List<AssessmentAnswer> answersToSave,
                               List<AssessmentRawScore> rawScoresToSave) {

        // Collect IDs of existing records BEFORE any writes
        List<Long> existingAnswerIds = assessmentAnswerRepository
                .findByUserStudent_UserStudentIdAndAssessment_Id(studentId, assessmentId)
                .stream()
                .map(AssessmentAnswer::getAssessmentAnswerId)
                .collect(Collectors.toList());

        List<Long> existingScoreIds = assessmentRawScoreRepository
                .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
                .stream()
                .map(AssessmentRawScore::getAssessmentRawScoreId)
                .collect(Collectors.toList());

        // Save new records first (safe: auto-generated IDs, no conflict)
        assessmentAnswerRepository.saveAll(answersToSave);
        assessmentRawScoreRepository.saveAll(rawScoresToSave);

        // Delete old records by their specific IDs
        if (!existingAnswerIds.isEmpty()) {
            assessmentAnswerRepository.deleteAllById(existingAnswerIds);
        }
        if (!existingScoreIds.isEmpty()) {
            assessmentRawScoreRepository.deleteAllById(existingScoreIds);
        }

        logger.info("Persisted to MySQL: {} answers, {} scores for student={} assessment={}",
                answersToSave.size(), rawScoresToSave.size(), studentId, assessmentId);
    }

    /**
     * Retry scheduler: every 5 minutes, scans Redis for submitted entries
     * that are "pending" (older than 2 min) or "failed" (up to 3 retries).
     */
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void retryFailedSubmissions() {
        List<Map<String, Object>> entries = assessmentSessionService.getAllSubmittedEntries();
        if (entries.isEmpty()) return;

        int retried = 0;
        for (Map<String, Object> entry : entries) {
            try {
                String status = (String) entry.get("processingStatus");
                Long studentId = ((Number) entry.get("userStudentId")).longValue();
                Long assessmentId = ((Number) entry.get("assessmentId")).longValue();

                int retryCount = entry.get("retryCount") != null
                        ? ((Number) entry.get("retryCount")).intValue() : 0;

                boolean shouldRetry = false;

                if ("failed".equals(status) && retryCount < 3) {
                    shouldRetry = true;
                } else if ("pending".equals(status)) {
                    // Check if pending for more than 2 minutes
                    String submittedAt = (String) entry.get("submittedAt");
                    if (submittedAt != null) {
                        java.time.Instant submitted = java.time.Instant.parse(submittedAt);
                        if (java.time.Instant.now().minusSeconds(120).isAfter(submitted)) {
                            shouldRetry = true;
                        }
                    }
                }

                if (shouldRetry) {
                    // Increment retry count in Redis
                    Map<String, Object> submissionData = assessmentSessionService.getSubmittedAnswers(studentId, assessmentId);
                    if (submissionData != null) {
                        submissionData.put("retryCount", retryCount + 1);
                        submissionData.put("processingStatus", "retrying");
                        // Re-save with updated retry count (preserve existing TTL via updateSubmittedStatus logic)
                        assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "retrying");
                    }

                    logger.info("Retrying submission for student={} assessment={} (attempt {})",
                            studentId, assessmentId, retryCount + 1);
                    processSubmissionAsync(studentId, assessmentId);
                    retried++;
                } else if ("failed".equals(status) && retryCount >= 3) {
                    assessmentSessionService.updateSubmittedStatus(studentId, assessmentId, "dead_letter");
                    logger.error("Submission exceeded max retries for student={} assessment={}. Marked as dead_letter.",
                            studentId, assessmentId);
                }
            } catch (Exception e) {
                logger.warn("Retry scheduler error for entry: {}", entry, e);
            }
        }

        if (retried > 0) {
            logger.info("Retry scheduler: retried {} submissions", retried);
        }
    }
}
