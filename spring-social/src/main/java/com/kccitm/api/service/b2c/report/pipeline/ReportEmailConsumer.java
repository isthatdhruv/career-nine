package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.service.DigitalOceanSpacesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

/**
 * Email stage (report-worker only). Consumes {@code report.email}, dedupes via
 * the Redis idempotency lock, fetches the PDF, and sends the co-branded email
 * synchronously through {@link EmailSender}. Marks "sent" only on a real success
 * (then the offset commits); on failure releases the lock and rethrows so the
 * record retries → DLT. The DLT is the "for sure" alert (student NOT emailed).
 *
 * <p>Only whitelabel students reach this stage (the generate stage gates on it);
 * a defensive whitelabel re-check guarantees the "mail whitelabel only" invariant.
 */
@Profile("report-worker")
@Component
public class ReportEmailConsumer {

    private static final Logger logger = LoggerFactory.getLogger(ReportEmailConsumer.class);

    @Autowired private EmailSender emailSender;
    @Autowired private ReportEmailIdempotency idempotency;
    @Autowired private EmailRateLimiter rateLimiter;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private ObjectMapper objectMapper;

    @RetryableTopic(
            attempts = "${report.pipeline.max-attempts:5}",
            backoff = @Backoff(delayExpression = "${report.pipeline.backoff-ms:5000}", multiplier = 2.0),
            dltStrategy = DltStrategy.FAIL_ON_ERROR)
    @KafkaListener(topics = ReportPipelineConfig.TOPIC_EMAIL, groupId = "report-email",
            concurrency = "${report.pipeline.email-concurrency:2}")
    public void onEmail(String json) throws Exception {
        ReportEmailEvent ev;
        try {
            ev = objectMapper.readValue(json, ReportEmailEvent.class);
        } catch (Exception e) {
            logger.error("Bad report.email payload (dropping): {}", json, e);
            return; // poison message
        }

        // Invariant: only whitelabel students are emailed. The generate stage already
        // gates on this, but re-check defensively so a stray or replayed non-whitelabel
        // event can never result in an email going out.
        if (!ev.whitelabel) {
            logger.warn("Report email skipped (non-whitelabel reached email stage) student={} assessment={}",
                    ev.userStudentId, ev.assessmentId);
            return;
        }

        ReportEmailIdempotency.Claim claim = idempotency.claim(ev.userStudentId, ev.assessmentId);
        if (claim == ReportEmailIdempotency.Claim.ALREADY_SENT) {
            logger.info("Dedup: report already emailed student={} assessment={}", ev.userStudentId, ev.assessmentId);
            return;
        }
        if (claim == ReportEmailIdempotency.Claim.IN_PROGRESS) {
            // Another attempt holds the lock (or a stale lock not yet expired) — retry later.
            throw new RetryablePipelineException("email in progress elsewhere student=" + ev.userStudentId);
        }

        try {
            byte[] pdf = null;
            if (!ev.linkOnly && ev.pdfUrl != null) {
                try {
                    pdf = spacesService.downloadFileByUrl(ev.pdfUrl);
                } catch (Exception ex) {
                    logger.warn("PDF fetch failed; sending link-only student={}: {}", ev.userStudentId, ex.getMessage());
                }
            }
            rateLimiter.acquire();
            emailSender.sendReportEmail(ev, pdf);
            idempotency.markSent(ev.userStudentId, ev.assessmentId);
            logger.info("Report email sent student={} assessment={} withPdf={}",
                    ev.userStudentId, ev.assessmentId, (pdf != null));
        } catch (Exception e) {
            // @RetryableTopic republishes silently — log the cause so the reason a
            // student wasn't emailed is visible without waiting for the DLT.
            logger.warn("Report email attempt failed student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
            idempotency.release(ev.userStudentId, ev.assessmentId); // let the retry re-claim
            throw e; // → @RetryableTopic retry → DLT
        }
    }

    @DltHandler
    public void dlt(String json,
                    @Header(name = KafkaHeaders.DLT_EXCEPTION_FQCN, required = false) String excClass,
                    @Header(name = KafkaHeaders.DLT_EXCEPTION_MESSAGE, required = false) String excMessage,
                    @Header(name = KafkaHeaders.DLT_EXCEPTION_STACKTRACE, required = false) String excStack) {
        logger.error("REPORT-EMAIL DLT (FOR-SURE ALERT — student NOT emailed, needs ops action): "
                + "payload={} cause={}: {}\n{}", json, excClass, excMessage, excStack);
    }
}
