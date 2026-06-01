package com.kccitm.api.service.b2c.report;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Fires default-template report generation in the background when a student
 * completes an assessment. Runs off the submission thread so completion is
 * never blocked, and absorbs the scores-not-ready race window (the async
 * submission processor may still be persisting answers) with a bounded retry.
 */
@Service
public class ReportAutoGenerationService {

    private static final Logger logger = LoggerFactory.getLogger(ReportAutoGenerationService.class);

    private static final int  MAX_ATTEMPTS  = 6;
    private static final long RETRY_DELAY_MS = 2000L;

    @Autowired private ReportService reportService;

    /**
     * Generate the questionnaire's default-template report for this student.
     * {@code reportTemplateId=null} → ReportService resolves the default.
     */
    @Async
    public void generateDefaultReportAsync(Long userStudentId, Long assessmentId) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                ReportResult r = reportService.generate(userStudentId, assessmentId, null, false);
                logger.info("Auto-generated default report: student={} assessment={} template={} url={}",
                        userStudentId, assessmentId, r.subtypeCode, r.reportUrl);
                return;
            } catch (ScoresNotReadyException ex) {
                // Async persistence still in flight — wait and retry.
                logger.info("Auto-gen scores not ready (attempt {}/{}) student={} assessment={}",
                        attempt, MAX_ATTEMPTS, userStudentId, assessmentId);
                sleep();
            } catch (SanityFailedException ex) {
                if ("NOT_COMPLETED".equals(ex.getCode())) {
                    logger.info("Auto-gen mapping not yet visible as completed (attempt {}/{}) student={} assessment={}",
                            attempt, MAX_ATTEMPTS, userStudentId, assessmentId);
                    sleep();
                } else {
                    logger.warn("Auto-gen aborted (sanity {}) student={} assessment={}: {}",
                            ex.getCode(), userStudentId, assessmentId, ex.getMessage());
                    return;
                }
            } catch (ReportRoutingException ex) {
                // No template mapped / no default — nothing to auto-generate. Don't retry.
                logger.info("Auto-gen skipped (routing) student={} assessment={}: {}",
                        userStudentId, assessmentId, ex.getMessage());
                return;
            } catch (Exception ex) {
                logger.error("Auto-gen failed student={} assessment={}", userStudentId, assessmentId, ex);
                return;
            }
        }
        logger.warn("Auto-gen gave up after {} attempts student={} assessment={}",
                MAX_ATTEMPTS, userStudentId, assessmentId);
    }

    private static void sleep() {
        try {
            Thread.sleep(RETRY_DELAY_MS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
