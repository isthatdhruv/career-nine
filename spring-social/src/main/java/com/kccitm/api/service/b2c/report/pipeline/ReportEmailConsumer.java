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
    @Autowired private ReportBatchLifecycle batchLifecycle;
    @Autowired private ReportEmailIdempotency idempotency;
    @Autowired private EmailRateLimiter rateLimiter;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ReportEmailComposer composer;
    @Autowired private com.kccitm.api.repository.Career9.b2c.ServiceDeliveryLogRepository
            serviceDeliveryLogRepository;
    /** Optional: "Your Next Step" counselling CTA; absent where counselling isn't wired. */
    @Autowired(required = false)
    private com.kccitm.api.service.counselling.CounsellingBookingLinkService bookingLinkService;

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

        // Admin batch stopped → the admin cancelled mid-batch; don't email a
        // report they no longer want sent. (Null batchId = automatic path.)
        if (batchLifecycle.isStopped(ev.batchId)) {
            logger.info("Report email skipped (batch {} stopped) student={} assessment={}",
                    ev.batchId, ev.userStudentId, ev.assessmentId);
            return;
        }

        // Invariant: a report is emailed only when the student is whitelabel, the
        // assessment's "email report" toggle is on (Phase 4), the student holds a
        // final-report entitlement (B2C), or an admin enqueued with emailMode="all".
        // The generate stage already gates on this; re-check defensively so a
        // stray/replayed event can never email someone who shouldn't be.
        if (!ev.whitelabel && !ev.emailReportEnabled && ev.entitlementId == null
                && !"all".equals(ev.emailMode)) {
            logger.warn("Report email skipped (neither whitelabel, toggle, entitlement, nor admin-all; mode={}) student={} assessment={}",
                    ev.emailMode, ev.userStudentId, ev.assessmentId);
            return;
        }

        ReportEmailIdempotency.Claim claim = idempotency.claim(ev.userStudentId, ev.assessmentId, ev.batchId);
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
            // "Your Next Step" CTA: offer counselling booking when it's available to this
            // student and they haven't booked yet. Best-effort at send time — the booking
            // page itself is the authoritative already-booked check on every open.
            if (bookingLinkService != null) {
                ev.bookingUrl = bookingLinkService.bookingUrlIfEligible(
                        ev.userStudentId, ev.assessmentId, ev.entitlementId);
            }
            rateLimiter.acquire();
            emailSender.sendReportEmail(ev, pdf);
            idempotency.markSent(ev.userStudentId, ev.assessmentId, ev.batchId);
            logEntitlementDelivery(ev);
            logger.info("Report email sent student={} assessment={} withPdf={}",
                    ev.userStudentId, ev.assessmentId, (pdf != null));
        } catch (Exception e) {
            // @RetryableTopic republishes silently — log the cause so the reason a
            // student wasn't emailed is visible without waiting for the DLT.
            logger.warn("Report email attempt failed student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
            idempotency.release(ev.userStudentId, ev.assessmentId, ev.batchId); // let the retry re-claim
            throw e; // → @RetryableTopic retry → DLT
        }
    }

    /**
     * B2C audit continuity: entitlement emails used to be sent by EntitlementService
     * through NotificationDispatcher, which wrote the "final_report" ServiceDeliveryLog
     * row the admin Tracker's communications view and resend flow read. Now that the
     * pipeline delivers that email, write the same row here. Best-effort — the email
     * IS sent at this point, so a logging failure must not trigger a retry (which
     * would double-send).
     */
    private void logEntitlementDelivery(ReportEmailEvent ev) {
        if (ev.entitlementId == null) return;
        try {
            com.kccitm.api.model.career9.b2c.ServiceDeliveryLog log =
                    new com.kccitm.api.model.career9.b2c.ServiceDeliveryLog();
            log.setEntitlementId(ev.entitlementId);
            log.setUserStudentId(ev.userStudentId);
            log.setServiceType("final_report");
            log.setChannel("email");
            log.setRecipient(ev.recipientEmail);
            log.setSubject(composer.subject(ev));
            // CDN links carry no access token — safe to store unredacted.
            log.setLinkUrl(ev.pdfUrl != null ? ev.pdfUrl : ev.reportUrl);
            log.setTemplateKey("final_report");
            log.setDeliveryStatus("sent");
            log.setSentAt(new java.util.Date());
            serviceDeliveryLogRepository.save(log);
        } catch (Exception e) {
            logger.warn("Could not write final_report ServiceDeliveryLog entitlement={} student={}: {}",
                    ev.entitlementId, ev.userStudentId, e.getMessage());
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
