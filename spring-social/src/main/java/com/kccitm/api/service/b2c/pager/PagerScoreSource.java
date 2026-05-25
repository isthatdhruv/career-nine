package com.kccitm.api.service.b2c.pager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.service.AssessmentSessionService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService.IntermediaryScores;

/**
 * Score-source wrapper around
 * {@link NavigatorReportGenerationService#computeIntermediaryScores} that
 * handles the narrow race window between {@code /assessment-answer/submit}
 * (which returns HTTP 202 immediately) and
 * {@link com.kccitm.api.service.AssessmentSubmissionProcessorService}
 * flipping {@code mapping.status} to {@code "completed"}.
 *
 * <p>The MySQL path is the source of truth and is preferred. When the SPA
 * lands on ThankYouPage and immediately calls {@code prepareReport}, the
 * async processor may not have completed yet — the existing scorer returns
 * {@code null} because the {@code status == "completed"} gate fails.
 *
 * <p>This service inserts a small retry loop (default 5 attempts, ~200ms
 * apart = 1s total) which empirically covers the common case in <2s. If
 * MySQL still doesn't have the row after the retry budget, we also probe
 * Redis as a defensive secondary signal — when Redis has the
 * {@code submitted:} payload but MySQL hasn't caught up, callers can decide
 * whether to fail-soft (show a "report still preparing" UI) or surface a
 * transient 500 for the SPA to retry.
 *
 * <p>True per-answer Redis fallback (synthesising scores directly from the
 * Redis payload without ever touching MySQL) requires a refactor of
 * {@code computeIntermediaryScores} to take a pre-fetched
 * {@code List<AssessmentAnswer>}; this is tracked for a future enhancement.
 * The retry path is the pragmatic fix for the observed race window.
 */
@Service
public class PagerScoreSource {

    private static final Logger logger = LoggerFactory.getLogger(PagerScoreSource.class);

    private static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 200L;

    @Autowired private NavigatorReportGenerationService navigatorReportGenerationService;
    @Autowired private AssessmentSessionService assessmentSessionService;

    /**
     * Returns the intermediary scores for (userStudentId, assessmentId), with a
     * short retry budget to cover the submit→persist race window. Returns
     * {@code null} only if no scores are available after the budget expires
     * AND Redis has no in-flight submission payload (caller should treat that
     * as "not yet submitted").
     */
    public IntermediaryScores getIntermediaryScores(Long userStudentId, Long assessmentId) {
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            IntermediaryScores scores =
                    navigatorReportGenerationService.computeIntermediaryScores(userStudentId, assessmentId);
            if (scores != null) {
                if (attempt > 1) {
                    logger.info("Intermediary scores resolved on attempt {} for student={} assessment={}",
                            attempt, userStudentId, assessmentId);
                }
                return scores;
            }
            // Probe Redis on the FINAL attempt only — if there's no submitted
            // payload either, the student genuinely hasn't submitted yet.
            if (attempt == MAX_RETRIES) {
                boolean redisHasSubmission = redisHasSubmittedPayload(userStudentId, assessmentId);
                if (redisHasSubmission) {
                    logger.warn("MySQL scoring unavailable for student={} assessment={} after {} attempts; "
                                    + "Redis has submitted payload but processor hasn't flipped status yet. "
                                    + "Falling through to null — caller should surface as transient retry.",
                            userStudentId, assessmentId, attempt);
                } else {
                    logger.info("No scores AND no Redis payload for student={} assessment={}; "
                                    + "treating as genuinely not-yet-submitted.",
                            userStudentId, assessmentId);
                }
                return null;
            }
            try {
                Thread.sleep(RETRY_DELAY_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return null;
            }
        }
        return null;
    }

    private boolean redisHasSubmittedPayload(Long userStudentId, Long assessmentId) {
        try {
            return assessmentSessionService.getSubmittedAnswers(userStudentId, assessmentId) != null;
        } catch (Exception e) {
            logger.warn("Redis probe failed for student={} assessment={}: {}",
                    userStudentId, assessmentId, e.getMessage());
            return false;
        }
    }
}
