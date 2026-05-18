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
     * B2C entitlement hook — fires post-completion notifications (1-pager /
     * final report email) when a paid-attempt submission successfully
     * persists. Optional bean: not present in environments without B2C
     * features wired up.
     */
    @Autowired(required = false)
    private com.kccitm.api.service.b2c.EntitlementService entitlementService;

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
            // Call through self so @Transactional activates.
            self.resolveFailure(studentId, assessmentId);
        } catch (Throwable t) {
            boolean transientErr = classifyTransient(t);
            logger.error("Processing failed for student={} assessment={} (transient={}): {}",
                    studentId, assessmentId, transientErr, t.toString(), t);
            self.recordFailure(studentId, assessmentId, t, transientErr);
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

        // Idempotency guard: if a prior processor pass already persisted this
        // submission, do NOT re-run dedupe/scoring/delete-and-reinsert. Without
        // this, a transient Redis failure in steps 7-8 below would propagate to
        // the catch handler → recordFailure → retry scheduler, which would then
        // re-fire the completion email and B2C entitlement hook from steps 9-10.
        // Best-effort Redis cleanup + return; the side-effect hooks fired on the
        // first pass and must not fire again.
        if ("completed".equals(mapping.getStatus())
                && ("persisted".equals(mapping.getPersistenceState())
                    || "persisted_with_warnings".equals(mapping.getPersistenceState()))) {
            logger.info("Submission already persisted on a prior pass; skipping re-processing. student={} assessment={}",
                    studentId, assessmentId);
            try { assessmentSessionService.deletePartialAnswers(studentId, assessmentId); } catch (Exception ignored) {}
            try {
                assessmentSessionService.markSubmittedArchived(studentId, assessmentId,
                        mapping.getPersistenceState(), 0, 0);
            } catch (Exception ignored) {}
            return;
        }

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

        // 5. Persist to MySQL (transactional: delete-before-save + atomic mapping flip).
        // Call via `self` so Spring's proxy wraps the call with @Transactional —
        // direct this-invocation would bypass AOP and lose rollback semantics.
        //
        // status flips ongoing → completed ONLY here, inside the same transaction
        // as the answer/score writes. Crash after answer-save but before mapping
        // commit ⇒ the whole transaction rolls back, and the next retry sees
        // status="ongoing" + persistence_state="pending" as before. No zombie
        // "pending" mappings with answers already in the DB.
        boolean hadWarnings = (duplicateCount > 0) || (skippedUnknownCount > 0);
        self.persistToMySQL(studentId, assessmentId, mapping,
                answersToSave, rawScoresToSave, hadWarnings);

        // 7. Clean up partial: key (no longer needed — student submitted).
        // CRITICAL: we do NOT delete the submitted: key on success. It stays as
        // an archive (7-day TTL from original submit) so that if any answers
        // were orphaned (unknown optionId / questionId skipped), the admin can
        // inspect the raw payload, manually map orphans, or acknowledge. The
        // student is never forced to retake due to data loss.
        assessmentSessionService.deletePartialAnswers(studentId, assessmentId);
        assessmentSessionService.markSubmittedArchived(studentId, assessmentId,
                hadWarnings ? "persisted_with_warnings" : "persisted",
                duplicateCount, skippedUnknownCount);

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

        // 10. B2C entitlement post-completion hook (non-critical).
        // Fires only after MySQL confirms the write — previously was wired
        // into the /submit endpoint, which meant it would fire even for
        // submissions that later 3-strike failed. Now: success-only.
        try {
            if (entitlementService != null) {
                String studentEmail = userStudent.getStudentInfo() != null
                        ? userStudent.getStudentInfo().getEmail()
                        : null;
                entitlementService.onAssessmentCompleted(studentId, assessmentId, studentEmail);
            }
        } catch (Exception entitlementErr) {
            logger.warn("B2C entitlement post-completion hook failed for student={} assessment={} (non-fatal)",
                    studentId, assessmentId, entitlementErr);
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
     * Transactional MySQL write: delete-before-save + atomic mapping flip.
     *
     * Single transaction wraps:
     *   (a) delete stale answers + scores
     *   (b) save new answers + scores
     *   (c) flip mapping.status="completed" + persistence_state
     *
     * Crash anywhere inside ⇒ the whole transaction rolls back; the mapping
     * keeps its prior status="ongoing" + persistence_state="pending" and the
     * retry scheduler can pick it up cleanly. There is no window where answers
     * exist in the DB but the mapping reports otherwise.
     */
    @Transactional
    public void persistToMySQL(Long studentId, Long assessmentId,
                               StudentAssessmentMapping mapping,
                               List<AssessmentAnswer> answersToSave,
                               List<AssessmentRawScore> rawScoresToSave,
                               boolean hadWarnings) {

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

        // Atomic mapping flip — only commits if the answer/score saves above
        // succeed. status moves to "completed" ONLY here, inside the DB
        // transaction. /submit no longer pre-flips status.
        mapping.setStatus("completed");
        mapping.setPersistenceState(hadWarnings ? "persisted_with_warnings" : "persisted");
        studentAssessmentMappingRepository.save(mapping);

        // Double-check completion against actual answer count (informational only).
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
     * - EntityNotFoundException, IllegalArgumentException → non-transient
     *   (data/code problem — retrying won't help)
     * - NullPointerException → transient (often LazyInit, race conditions,
     *   incidental missing-state bugs that resolve on the next attempt;
     *   3 consecutive NPEs still trips the non-transient cap defensively).
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
            cur = cur.getCause();
        }
        return true;
    }

    private static Instant nextRetryAt(int attemptCount) {
        int idx = Math.min(Math.max(attemptCount - 1, 0), BACKOFF_SECONDS.length - 1);
        return Instant.now().plusSeconds(BACKOFF_SECONDS[idx]);
    }

    @Transactional
    public void recordFailure(Long studentId, Long assessmentId, Throwable error, boolean transientErr) {
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
                    // Flip BOTH columns: status="failed" excludes this row from
                    // teacher dashboards / report generators / exports that key
                    // off status; persistence_state="failed" tells admin tools
                    // the technical reason.
                    mapping.setStatus("failed");
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
    public void resolveFailure(Long studentId, Long assessmentId) {
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
