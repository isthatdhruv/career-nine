package com.kccitm.api.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.AssessmentAdminAction;
import com.kccitm.api.model.career9.AssessmentSubmissionFailure;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.AssessmentAdminActionRepository;
import com.kccitm.api.repository.AssessmentSubmissionFailureRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Sweeps failed submissions that no admin has touched in 7 days and auto-resets
 * them to "notstarted" so they drop out of the admin queue. Writes an audit row
 * tagged with actor = "system".
 *
 * Runs every 6 hours — cheap query, no urgency.
 */
@Service
public class AssessmentFailureExpireService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentFailureExpireService.class);

    private static final Duration EXPIRE_AFTER = Duration.ofDays(7);

    @Autowired
    private AssessmentSubmissionFailureRepository failureRepository;

    @Autowired
    private StudentAssessmentMappingRepository mappingRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private AssessmentProctoringQuestionLogRepository proctoringRepository;

    @Autowired
    private AssessmentSessionService sessionService;

    @Autowired
    private AssessmentAdminActionRepository adminActionRepository;

    @Scheduled(cron = "0 17 */6 * * *")   // top of every 6th hour + 17 min to avoid clustering
    @Transactional
    public void autoExpireOldFailures() {
        Instant cutoff = Instant.now().minus(EXPIRE_AFTER);
        List<AssessmentSubmissionFailure> old = failureRepository.findUnresolvedBefore(cutoff);
        if (old.isEmpty()) return;

        logger.info("Auto-expire sweep: {} failed submissions older than {}",
                old.size(), EXPIRE_AFTER);

        for (AssessmentSubmissionFailure row : old) {
            try {
                expireOne(row);
            } catch (Exception e) {
                logger.warn("Auto-expire failed for student={} assessment={}",
                        row.getUserStudentId(), row.getAssessmentId(), e);
            }
        }
    }

    private void expireOne(AssessmentSubmissionFailure row) {
        Long studentId = row.getUserStudentId();
        Long assessmentId = row.getAssessmentId();

        StudentAssessmentMapping mapping = mappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId)
                .orElse(null);
        if (mapping == null) {
            // Mapping vanished (likely already manually deleted) — just resolve the failure row
            row.setResolved(true);
            row.setResolvedAt(Instant.now());
            row.setNextRetryAt(null);
            failureRepository.save(row);
            return;
        }

        String beforeState = String.format(
                "{\"status\":\"%s\",\"persistenceState\":\"%s\"}",
                mapping.getStatus(), mapping.getPersistenceState());

        // Delete stale answers + scores + proctoring so student can retake cleanly
        assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(
                studentId, assessmentId);
        assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(
                mapping.getStudentAssessmentId());
        proctoringRepository.deleteByUserStudentUserStudentIdAndAssessmentId(
                studentId, assessmentId);

        // Clear all Redis state
        sessionService.clearAllForMapping(studentId, assessmentId);

        // Reset mapping
        mapping.setStatus("notstarted");
        mapping.setPersistenceState(null);
        mappingRepository.save(mapping);

        // Resolve failure row
        row.setResolved(true);
        row.setResolvedAt(Instant.now());
        row.setNextRetryAt(null);
        failureRepository.save(row);

        // Audit with system actor (adminUserId = null)
        AssessmentAdminAction audit = new AssessmentAdminAction();
        audit.setActionType("auto_expire");
        audit.setUserStudentId(studentId);
        audit.setAssessmentId(assessmentId);
        audit.setAdminUserId(null);
        audit.setActionAt(Instant.now());
        audit.setReason("auto-expired after " + EXPIRE_AFTER.toDays() + " days with no admin action");
        audit.setBeforeStateJson(beforeState);
        audit.setAfterStateJson("{\"status\":\"notstarted\",\"persistenceState\":null}");
        adminActionRepository.save(audit);

        logger.info("Auto-expired failed submission: student={} assessment={} (first failed at {})",
                studentId, assessmentId, row.getFirstFailedAt());
    }
}
