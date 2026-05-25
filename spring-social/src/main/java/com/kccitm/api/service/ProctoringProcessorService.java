package com.kccitm.api.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentProctoringQuestionLog;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;

/**
 * Async processor for proctoring data.
 * Reads proctoring payload from Redis (saved by /assessment-proctoring/save),
 * builds AssessmentProctoringQuestionLog entities, and batch-inserts to MySQL.
 * Includes a retry scheduler for failed processing.
 */
@Service
public class ProctoringProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(ProctoringProcessorService.class);

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    @Autowired
    private AssessmentProctoringQuestionLogRepository questionLogRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Async entry point — reads proctoring data from Redis and persists to MySQL.
     */
    @Async
    public void processAsync(Long studentId, Long assessmentId) {
        try {
            logger.info("Processing proctoring data async for student={} assessment={}", studentId, assessmentId);
            persistToMySQL(studentId, assessmentId);
            assessmentSessionService.updateProctoringStatus(studentId, assessmentId, "completed");
            logger.info("Proctoring data persisted for student={} assessment={}", studentId, assessmentId);
        } catch (Exception e) {
            logger.error("Failed to process proctoring data for student={} assessment={}: {}",
                    studentId, assessmentId, e.getMessage(), e);
            try {
                // Increment retry count
                Map<String, Object> data = assessmentSessionService.getProctoringData(studentId, assessmentId);
                if (data != null) {
                    int retryCount = data.get("retryCount") != null
                            ? ((Number) data.get("retryCount")).intValue() : 0;
                    data.put("retryCount", retryCount + 1);
                }
                assessmentSessionService.updateProctoringStatus(studentId, assessmentId, "failed");
            } catch (Exception ex) {
                logger.error("Failed to update proctoring status for student={} assessment={}",
                        studentId, assessmentId, ex);
            }
        }
    }

    /**
     * Persist proctoring data from Redis to MySQL in a single batch.
     */
    @SuppressWarnings("unchecked")
    @Transactional
    public void persistToMySQL(Long studentId, Long assessmentId) throws Exception {
        Map<String, Object> payload = assessmentSessionService.getProctoringData(studentId, assessmentId);
        if (payload == null) {
            logger.warn("No proctoring data found in Redis for student={} assessment={}", studentId, assessmentId);
            return;
        }

        UserStudent userStudent = userStudentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("UserStudent not found: " + studentId));

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found: " + assessmentId));

        List<Map<String, Object>> perQuestionData =
                (List<Map<String, Object>>) payload.get("perQuestionData");

        if (perQuestionData == null || perQuestionData.isEmpty()) {
            logger.warn("No perQuestionData in proctoring payload for student={} assessment={}", studentId, assessmentId);
            return;
        }

        List<AssessmentProctoringQuestionLog> logList = new ArrayList<>();

        for (Map<String, Object> qData : perQuestionData) {
            Long qqId = ((Number) qData.get("questionnaireQuestionId")).longValue();

            QuestionnaireQuestion qq = questionnaireQuestionRepository.findById(qqId).orElse(null);
            if (qq == null) continue;

            AssessmentProctoringQuestionLog qLog = new AssessmentProctoringQuestionLog();
            qLog.setUserStudent(userStudent);
            qLog.setAssessment(assessment);
            qLog.setQuestionnaireQuestion(qq);

            qLog.setScreenWidth(((Number) qData.get("screenWidth")).intValue());
            qLog.setScreenHeight(((Number) qData.get("screenHeight")).intValue());
            qLog.setQuestionRectJson(objectMapper.writeValueAsString(qData.get("questionRect")));
            qLog.setOptionsRectJson(objectMapper.writeValueAsString(qData.get("optionsRect")));
            qLog.setGazePointsJson(objectMapper.writeValueAsString(qData.get("gazePoints")));
            qLog.setTimeSpentMs(((Number) qData.get("timeSpentMs")).longValue());
            qLog.setQuestionStartTime(((Number) qData.get("questionStartTime")).longValue());
            qLog.setQuestionEndTime(((Number) qData.get("questionEndTime")).longValue());
            qLog.setMouseClickCount(((Number) qData.get("mouseClickCount")).intValue());
            qLog.setMouseClicksJson(objectMapper.writeValueAsString(qData.get("mouseClicks")));
            qLog.setMaxFacesDetected(((Number) qData.get("maxFacesDetected")).intValue());
            qLog.setAvgFacesDetected(((Number) qData.get("avgFacesDetected")).doubleValue());
            qLog.setHeadAwayCount(((Number) qData.get("headAwayCount")).intValue());
            qLog.setTabSwitchCount(((Number) qData.get("tabSwitchCount")).intValue());

            // WebGazer eye-tracking fields (nullable for backward compat)
            Object eyeGazePoints = qData.get("eyeGazePoints");
            if (eyeGazePoints != null) {
                qLog.setEyeGazePointsJson(objectMapper.writeValueAsString(eyeGazePoints));
            }

            logList.add(qLog);
        }

        // Batch insert all rows in one go
        questionLogRepository.saveAll(logList);

        logger.info("Persisted proctoring data to MySQL: {} question logs for student={} assessment={}",
                logList.size(), studentId, assessmentId);
    }

    /**
     * Retry scheduler: every 5 minutes, scans Redis for proctoring entries
     * that are "pending" (older than 2 min) or "failed" (up to 3 retries).
     */
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void retryFailedProctoring() {
        List<Map<String, Object>> entries = assessmentSessionService.getAllProctoringEntries();
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
                    String submittedAt = (String) entry.get("submittedAt");
                    if (submittedAt != null) {
                        java.time.Instant submitted = java.time.Instant.parse(submittedAt);
                        if (java.time.Instant.now().minusSeconds(120).isAfter(submitted)) {
                            shouldRetry = true;
                        }
                    }
                }

                if (shouldRetry) {
                    assessmentSessionService.updateProctoringStatus(studentId, assessmentId, "retrying");
                    logger.info("Retrying proctoring processing for student={} assessment={} (attempt {})",
                            studentId, assessmentId, retryCount + 1);
                    processAsync(studentId, assessmentId);
                    retried++;
                } else if ("failed".equals(status) && retryCount >= 3) {
                    assessmentSessionService.updateProctoringStatus(studentId, assessmentId, "dead_letter");
                    logger.error("Proctoring processing exceeded max retries for student={} assessment={}. Marked as dead_letter.",
                            studentId, assessmentId);
                }
            } catch (Exception e) {
                logger.warn("Proctoring retry scheduler error for entry: {}", entry, e);
            }
        }

        if (retried > 0) {
            logger.info("Proctoring retry scheduler: retried {} entries", retried);
        }
    }
}
