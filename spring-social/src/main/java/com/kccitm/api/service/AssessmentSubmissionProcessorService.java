package com.kccitm.api.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import javax.persistence.EntityNotFoundException;
import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.NonTransientDataAccessException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentSubmissionFailure;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.AssessmentSubmissionFailureRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Async processor for assessment submissions.
 *
 * Pipeline:
 *   /submit endpoint -> Redis submitted: key -> this processor -> MySQL
 *
 * Responsibilities:
 *   - Dedupe duplicate questionIds and skip unknown questionIds (defensive).
 *   - Persist answers + raw scores in a single transaction (delete-before-save).
 *   - Flip mapping.persistenceState to "persisted" | "persisted_with_warnings" on success,
 *     "failed" after 3 consecutive non-transient failures.
 *   - Track failures in assessment_submission_failure for retry + admin visibility.
 *
 * Retry scheduler runs every minute, picking up entries whose nextRetryAt is due.
 * Backoff schedule: 1m → 5m → 15m → 1h → 1h (hourly forever, until resolved or
 * classified as non-transient 3 times in a row).
 */
@Service
public class AssessmentSubmissionProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentSubmissionProcessorService.class);

    /** Max consecutive non-transient failures before we stop auto-retrying. */
    private static final int MAX_CONSECUTIVE_NON_TRANSIENT = 3;

    /** Backoff schedule in seconds, last step repeats. */
    private static final long[] BACKOFF_SECONDS = {
            60L,        // 1m
            300L,       // 5m
            900L,       // 15m
            3600L,      // 1h
            3600L       // subsequent attempts: 1h
    };

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

    @Autowired
    private AssessmentCompletionEmailService assessmentCompletionEmailService;

    @Autowired
    private AssessmentCompletionService completionService;

    @Autowired
    private AssessmentSubmissionFailureRepository failureRepository;

    /**
     * Self-reference for @Async proxy invocation (so scheduled retries actually
     * run off the scheduler thread).
     */
    @Lazy
    @Autowired
    private AssessmentSubmissionProcessorService self;

    // ── Entry points ─────────────────────────────────────────────────────────

    /**
     * Async entry point — called by /submit after the payload is in Redis.
     * Wraps the synchronous body with error classification + failure tracking.
     */
    @Async
    public void processSubmissionAsync(Long studentId, Long assessmentId) {
        processSubmissionInternal(studentId, assessmentId);
    }

    /**
     * Synchronous body. Pulled out so the retry scheduler can invoke it
     * directly without going through @Async (it's already off the HTTP thread).
     */
    void processSubmissionInternal(Long studentId, Long assessmentId) {
        logger.info("Processing submission: student={} assessment={}", studentId, assessmentId);

        try {
            doProcessSubmission(studentId, assessmentId);
            resolveFailure(studentId, assessmentId);
        } catch (Throwable t) {
            boolean transientErr = classifyTransient(t);
            logger.error("Processing failed for student={} assessment={} (transient={}): {}",
                    studentId, assessmentId, transientErr, t.toString(), t);
            recordFailure(studentId, assessmentId, t, transientErr);
        } finally {
            assessmentSessionService.clearSubmissionLock(studentId, assessmentId);
        }
    }

    // ── Main processing ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void doProcessSubmission(Long studentId, Long assessmentId) {
        Map<String, Object> submissionData = assessmentSessionService.getSubmittedAnswers(studentId, assessmentId);
        if (submissionData == null) {
            // No payload in Redis — happens if:
            //   (a) the key expired (7-day safety cap exceeded)
            //   (b) admin deleted it via reset
            // In either case, nothing to persist; leave mapping state alone.
            logger.warn("No submitted payload in Redis for student={} assessment={} — skipping", studentId, assessmentId);
            return;
        }

        List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");
        if (answers == null || answers.isEmpty()) {
            logger.warn("Empty answers payload for student={} assessment={}", studentId, assessmentId);
            // Treat as a completed but empty submission: mark persisted (nothing to do).
            StudentAssessmentMapping mapping = loadMapping(studentId, assessmentId);
            mapping.setPersistenceState("persisted");
            studentAssessmentMappingRepository.save(mapping);
            assessmentSessionService.deleteSubmittedAnswers(studentId, assessmentId);
            return;
        }

        UserStudent userStudent = userStudentRepository.findById(studentId)
                .orElseThrow(() -> new EntityNotFoundException("UserStudent " + studentId));
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new EntityNotFoundException("Assessment " + assessmentId));
        StudentAssessmentMapping mapping = loadMapping(studentId, assessmentId);

        // 1. Defensive dedupe — on composite key, not questionId alone.
        //
        // Multi-select / ranking / text questions legitimately have multiple
        // entries per questionnaireQuestionId (one per selected option / rank /
        // text response). Dedupe is only meaningful for:
        //   - option answers: same (questionId, optionId) appearing twice
        //   - text answers:   same (questionId, textResponse) appearing twice
        Set<String> seenKeys = new HashSet<>();
        List<Map<String, Object>> uniqueAnswers = new ArrayList<>();
        int duplicateCount = 0;
        for (Map<String, Object> ansMap : answers) {
            Object qRaw = ansMap.get("questionnaireQuestionId");
            if (qRaw == null) {
                duplicateCount++;
                logger.warn("Answer entry missing questionnaireQuestionId — skipping. student={} assessment={}",
                        studentId, assessmentId);
                continue;
            }
            Long qId = ((Number) qRaw).longValue();

            String compositeKey;
            Object optId = ansMap.get("optionId");
            Object textResp = ansMap.get("textResponse");
            if (optId instanceof Number) {
                compositeKey = "q:" + qId + "|o:" + ((Number) optId).longValue();
            } else if (textResp instanceof String) {
                compositeKey = "q:" + qId + "|t:" + ((String) textResp).trim();
            } else {
                // Neither option nor text → skip as malformed
                duplicateCount++;
                logger.warn("Answer entry has no optionId or textResponse — skipping. student={} qId={}",
                        studentId, qId);
                continue;
            }

            if (!seenKeys.add(compositeKey)) {
                duplicateCount++;
                logger.warn("Duplicate answer {} in submission for student={} assessment={} — keeping last occurrence",
                        compositeKey, studentId, assessmentId);
                // overwrite earlier entry with same key
                for (int i = uniqueAnswers.size() - 1; i >= 0; i--) {
                    Map<String, Object> prev = uniqueAnswers.get(i);
                    if (keyOf(prev).equals(compositeKey)) {
                        uniqueAnswers.set(i, ansMap);
                        break;
                    }
                }
                continue;
            }
            uniqueAnswers.add(ansMap);
        }

        // 2. Pre-fetch questions + options + scores in bulk
        List<Long> questionIds = new ArrayList<>();
        List<Long> optionIds = new ArrayList<>();
        for (Map<String, Object> ansMap : uniqueAnswers) {
            questionIds.add(((Number) ansMap.get("questionnaireQuestionId")).longValue());
            if (ansMap.containsKey("optionId") && ansMap.get("optionId") != null) {
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

        // 3. Process answers — text matching, option scoring, rank multipliers, MQT dedup
        Map<Long, Integer> qualityTypeScores = new HashMap<>();
        Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();
        List<AssessmentAnswer> answersToSave = new ArrayList<>();
        int skippedUnknownCount = 0;

        for (Map<String, Object> ansMap : uniqueAnswers) {
            Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
            QuestionnaireQuestion question = questionCache.get(qId);

            if (question == null) {
                skippedUnknownCount++;
                logger.warn("Unknown questionId={} in submission for student={} assessment={} — skipping",
                        qId, studentId, assessmentId);
                continue;
            }

            String textResponse = ansMap.containsKey("textResponse")
                    ? (String) ansMap.get("textResponse")
                    : null;

            if (textResponse != null) {
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

                    Long mappedOptId = mappedOpt.getOptionId();
                    if (!scoresByOptionId.containsKey(mappedOptId)) {
                        List<OptionScoreBasedOnMEasuredQualityTypes> mappedScores =
                                optionScoreRepository.findByOptionId(mappedOptId);
                        scoresByOptionId.put(mappedOptId, mappedScores);
                    }
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
            } else if (ansMap.containsKey("optionId") && ansMap.get("optionId") != null) {
                Long oId = ((Number) ansMap.get("optionId")).longValue();
                Integer rankOrder = ansMap.containsKey("rankOrder") && ansMap.get("rankOrder") != null
                        ? ((Number) ansMap.get("rankOrder")).intValue()
                        : null;

                AssessmentQuestionOptions option = optionCache.get(oId);
                if (option == null) {
                    skippedUnknownCount++;
                    logger.warn("Unknown optionId={} for questionId={} student={} — skipping",
                            oId, qId, studentId);
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

        // 4. Build raw scores list
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

        // 5. Persist to MySQL (transactional, delete-before-save)
        persistToMySQL(studentId, assessmentId, mapping, answersToSave, rawScoresToSave);

        // 6. Flip persistenceState based on whether we saw warnings
        boolean hadWarnings = (duplicateCount > 0) || (skippedUnknownCount > 0);
        mapping.setPersistenceState(hadWarnings ? "persisted_with_warnings" : "persisted");
        studentAssessmentMappingRepository.save(mapping);

        // 7. Clean up Redis — the submission is safely in MySQL
        assessmentSessionService.deleteSubmittedAnswers(studentId, assessmentId);
        assessmentSessionService.deletePartialAnswers(studentId, assessmentId);

        // 8. Cache a short-lived result for any duplicate-submit that races us
        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("answersSaved", answersToSave.size());
        result.put("scoresSaved", rawScoresToSave.size());
        result.put("duplicatesDeduped", duplicateCount);
        result.put("skippedUnknown", skippedUnknownCount);
        assessmentSessionService.markSubmissionComplete(studentId, assessmentId, result);

        // 9. Fire completion email (non-critical; log but don't fail on errors)
        try {
            assessmentCompletionEmailService.sendCompletionEmail(
                    userStudent, assessment, answersToSave.size(), rawScoresToSave.size());
        } catch (Exception emailErr) {
            logger.warn("Completion email failed for student={} assessment={} (non-fatal)",
                    studentId, assessmentId, emailErr);
        }

        logger.info("Processing succeeded: student={} assessment={} answers={} scores={} warnings={}/{}",
                studentId, assessmentId, answersToSave.size(), rawScoresToSave.size(),
                duplicateCount, skippedUnknownCount);
    }

    private StudentAssessmentMapping loadMapping(Long studentId, Long assessmentId) {
        return studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "StudentAssessmentMapping for student=" + studentId + " assessment=" + assessmentId));
    }

    /**
     * Composite dedupe key for an answer map — same shape as what the dedupe
     * loop produces. Returns empty string if the map is malformed; callers
     * should have already filtered those out.
     */
    private static String keyOf(Map<String, Object> ansMap) {
        Object qRaw = ansMap.get("questionnaireQuestionId");
        if (qRaw == null) return "";
        Long qId = ((Number) qRaw).longValue();
        Object optId = ansMap.get("optionId");
        Object textResp = ansMap.get("textResponse");
        if (optId instanceof Number) {
            return "q:" + qId + "|o:" + ((Number) optId).longValue();
        }
        if (textResp instanceof String) {
            return "q:" + qId + "|t:" + ((String) textResp).trim();
        }
        return "";
    }

    /**
     * Transactional MySQL write: delete-before-save pattern.
     * Under the same @Transactional, stale rows are removed first; if the save
     * fails the whole thing rolls back and the old rows remain intact. This
     * avoids the previous brief-window of both old + new rows co-existing.
     *
     * markCompletedIfFullyAnswered is called here only as a double-check — the
     * submit endpoint has already set status=completed. If the student somehow
     * landed fewer answers than expected, this logs the mismatch but does not
     * revert status (that policy is enforced at the submit endpoint via the
     * excess-payload guard, and by future answer-count validation).
     */
    @Transactional
    public void persistToMySQL(Long studentId, Long assessmentId,
                               StudentAssessmentMapping mapping,
                               List<AssessmentAnswer> answersToSave,
                               List<AssessmentRawScore> rawScoresToSave) {

        // Delete existing answers for this (student, assessment)
        List<Long> existingAnswerIds = assessmentAnswerRepository
                .findByUserStudent_UserStudentIdAndAssessment_Id(studentId, assessmentId)
                .stream()
                .map(AssessmentAnswer::getAssessmentAnswerId)
                .collect(Collectors.toList());
        if (!existingAnswerIds.isEmpty()) {
            assessmentAnswerRepository.deleteAllById(existingAnswerIds);
        }

        // Delete existing raw scores for this mapping
        List<Long> existingScoreIds = assessmentRawScoreRepository
                .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
                .stream()
                .map(AssessmentRawScore::getAssessmentRawScoreId)
                .collect(Collectors.toList());
        if (!existingScoreIds.isEmpty()) {
            assessmentRawScoreRepository.deleteAllById(existingScoreIds);
        }

        // Flush pending deletes so saves don't conflict with stale rows (esp. if
        // there were unique constraints).
        assessmentAnswerRepository.flush();
        assessmentRawScoreRepository.flush();

        // Save new rows
        assessmentAnswerRepository.saveAll(answersToSave);
        assessmentRawScoreRepository.saveAll(rawScoresToSave);

        // Double-check completion against actual answer count (informational only).
        // The submit endpoint has already set status=completed synchronously.
        int total = completionService.getTotalQuestions(assessmentId);
        int answered = completionService.getAnsweredCount(studentId, assessmentId);
        if (total > 0 && answered < total) {
            logger.warn("Student {} submitted for assessment {} with {}/{} answered (processor)",
                    studentId, assessmentId, answered, total);
        }

        logger.info("Persisted to MySQL: {} answers, {} scores for student={} assessment={}",
                answersToSave.size(), rawScoresToSave.size(), studentId, assessmentId);
    }

    // ── Error classification + failure tracking ──────────────────────────────

    /**
     * Classify a throwable as transient (retry) vs non-transient (investigate).
     * - Spring's TransientDataAccessException hierarchy → transient
     *   (timeouts, deadlocks, connection drops)
     * - Spring's NonTransientDataAccessException hierarchy → non-transient
     *   (integrity violations, bad SQL)
     * - EntityNotFoundException, IllegalArgumentException, NPE → non-transient
     *   (data/code problem — retrying won't help)
     * - Anything else → transient by default (generous; gives flaky infra
     *   room to heal; poison pills still die after 3 consecutive such hits).
     */
    private static boolean classifyTransient(Throwable t) {
        Throwable cur = t;
        while (cur != null) {
            if (cur instanceof TransientDataAccessException) return true;
            if (cur instanceof NonTransientDataAccessException) return false;
            if (cur instanceof DataIntegrityViolationException) return false;
            if (cur instanceof EntityNotFoundException) return false;
            if (cur instanceof IllegalArgumentException) return false;
            if (cur instanceof NullPointerException) return false;
            cur = cur.getCause();
        }
        return true;
    }

    private static Instant nextRetryAt(int attemptCount) {
        int idx = Math.min(Math.max(attemptCount - 1, 0), BACKOFF_SECONDS.length - 1);
        return Instant.now().plusSeconds(BACKOFF_SECONDS[idx]);
    }

    @Transactional
    void recordFailure(Long studentId, Long assessmentId, Throwable error, boolean transientErr) {
        AssessmentSubmissionFailure row = failureRepository
                .findByUserStudentIdAndAssessmentId(studentId, assessmentId)
                .orElseGet(() -> {
                    AssessmentSubmissionFailure f = new AssessmentSubmissionFailure();
                    f.setUserStudentId(studentId);
                    f.setAssessmentId(assessmentId);
                    f.setFirstFailedAt(Instant.now());
                    f.setAttemptCount(0);
                    f.setConsecutiveNonTransientCount(0);
                    f.setResolved(false);
                    return f;
                });

        row.setLastAttemptAt(Instant.now());
        row.setAttemptCount(row.getAttemptCount() + 1);
        row.setLastErrorClass(error.getClass().getName());
        row.setLastErrorMessage(truncate(error.getMessage(), 4000));
        row.setLastErrorKind(transientErr ? "transient" : "non_transient");
        row.setResolved(false);
        row.setResolvedAt(null);

        if (transientErr) {
            row.setConsecutiveNonTransientCount(0);
            row.setNextRetryAt(nextRetryAt(row.getAttemptCount()));
        } else {
            int nonTransientCount = row.getConsecutiveNonTransientCount() + 1;
            row.setConsecutiveNonTransientCount(nonTransientCount);
            if (nonTransientCount >= MAX_CONSECUTIVE_NON_TRANSIENT) {
                // Give up auto-retry. Admin must intervene.
                row.setNextRetryAt(null);
                try {
                    StudentAssessmentMapping mapping = loadMapping(studentId, assessmentId);
                    mapping.setPersistenceState("failed");
                    studentAssessmentMappingRepository.save(mapping);
                } catch (Exception flagErr) {
                    logger.error("Could not flip mapping to failed for student={} assessment={}",
                            studentId, assessmentId, flagErr);
                }
                logger.error("Submission processing gave up for student={} assessment={} after {} consecutive non-transient failures",
                        studentId, assessmentId, nonTransientCount);
            } else {
                row.setNextRetryAt(nextRetryAt(row.getAttemptCount()));
            }
        }

        failureRepository.save(row);
    }

    @Transactional
    void resolveFailure(Long studentId, Long assessmentId) {
        failureRepository.findByUserStudentIdAndAssessmentId(studentId, assessmentId)
                .ifPresent(row -> {
                    if (!Boolean.TRUE.equals(row.getResolved())) {
                        row.setResolved(true);
                        row.setResolvedAt(Instant.now());
                        row.setNextRetryAt(null);
                        failureRepository.save(row);
                    }
                });
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    // ── Retry scheduler ──────────────────────────────────────────────────────

    /**
     * Every minute, pick up failures that are due for retry (nextRetryAt ≤ now)
     * and resubmit them through the async processor.
     */
    @Scheduled(fixedRate = 60_000L)
    public void runRetryScheduler() {
        List<AssessmentSubmissionFailure> due;
        try {
            due = failureRepository.findDueForRetry(Instant.now());
        } catch (Exception e) {
            logger.warn("Retry scheduler query failed", e);
            return;
        }
        if (due.isEmpty()) return;

        logger.info("Retry scheduler: {} submissions due for retry", due.size());
        for (AssessmentSubmissionFailure row : due) {
            try {
                // Mark nextRetryAt forward immediately so concurrent scheduler
                // runs don't double-dispatch.
                row.setNextRetryAt(nextRetryAt(row.getAttemptCount() + 1));
                failureRepository.save(row);

                // Call through self-proxy so @Async actually dispatches
                // to the background executor.
                self.processSubmissionAsync(row.getUserStudentId(), row.getAssessmentId());
            } catch (Exception e) {
                logger.warn("Retry scheduler failed to dispatch student={} assessment={}",
                        row.getUserStudentId(), row.getAssessmentId(), e);
            }
        }
    }
}
