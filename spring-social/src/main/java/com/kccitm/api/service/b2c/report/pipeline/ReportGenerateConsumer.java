package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.service.b2c.report.ReportResult;
import com.kccitm.api.service.b2c.report.ReportRoutingException;
import com.kccitm.api.service.b2c.report.ReportService;
import com.kccitm.api.service.b2c.report.SanityFailedException;
import com.kccitm.api.service.b2c.report.ScoresNotReadyException;
import com.kccitm.api.service.b2c.report.pdf.PdfRenderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

/**
 * Generate stage (report-worker only). Consumes {@code report.generate}, renders
 * the default-template (pager) report via {@link ReportService#generate} for
 * EVERY student, and — only for whitelabel students with a recipient address —
 * produces a {@link ReportEmailEvent} for the mail stage. Non-whitelabel reports
 * are generated + stored, then the record is acked with no email. Concurrency is
 * bounded (Gotenberg is the CPU bottleneck). Retries ONLY transient
 * {@link RetryablePipelineException}; "no template mapped" is a benign skip.
 */
@Profile("report-worker")
@Component
public class ReportGenerateConsumer {

    private static final Logger logger = LoggerFactory.getLogger(ReportGenerateConsumer.class);

    @Autowired private ReportService reportService;
    @Autowired private PdfRenderService pdfRenderService;
    @Autowired private KafkaTemplate<String, String> kafkaTemplate;
    @Autowired private ObjectMapper objectMapper;

    @Value("${report.pipeline.pdf-attempts:3}")
    private int pdfAttempts;

    @RetryableTopic(
            attempts = "${report.pipeline.max-attempts:5}",
            backoff = @Backoff(delayExpression = "${report.pipeline.backoff-ms:5000}", multiplier = 2.0),
            include = RetryablePipelineException.class,
            dltStrategy = DltStrategy.FAIL_ON_ERROR)
    @KafkaListener(topics = ReportPipelineConfig.TOPIC_GENERATE, groupId = "report-generate",
            concurrency = "${report.pipeline.generate-concurrency:3}")
    public void onGenerate(String json) {
        ReportGenerateEvent ev;
        try {
            ev = objectMapper.readValue(json, ReportGenerateEvent.class);
        } catch (Exception e) {
            logger.error("Bad report.generate payload (dropping): {}", json, e);
            return; // poison message — don't retry a malformed payload
        }

        try {
            ReportResult r = reportService.generate(ev.userStudentId, ev.assessmentId, null, false);

            // Reports are generated for everyone, but only whitelabel students with a
            // recipient address are emailed. For non-whitelabel (or address-less)
            // students the report is now rendered + stored — ack here without queuing
            // the mail stage, and skip the email-only PDF re-render to spare Gotenberg.
            boolean hasEmail = ev.recipientEmail != null && !ev.recipientEmail.isBlank();
            // Email whitelabel students always, plus any assessment with the "email report" toggle on.
            boolean emailEnabled = ev.whitelabel || ev.emailReportEnabled;
            if (!emailEnabled || !hasEmail) {
                logger.info("Report generated (not mailed — whitelabel={} toggle={} hasEmail={}) student={} assessment={}",
                        ev.whitelabel, ev.emailReportEnabled, hasEmail, ev.userStudentId, ev.assessmentId);
                return;
            }

            String pdfUrl = "ready".equals(r.pdfStatus) ? r.pdfUrl : retryPdf(r.reportUrl);
            boolean linkOnly = (pdfUrl == null);
            if (linkOnly) {
                logger.warn("PDF unavailable after {} attempts; sending link-only student={} assessment={}",
                        pdfAttempts, ev.userStudentId, ev.assessmentId);
            }
            ReportEmailEvent out = new ReportEmailEvent(ev, r.reportUrl, pdfUrl, linkOnly);
            kafkaTemplate.send(ReportPipelineConfig.TOPIC_EMAIL, out.key(),
                    objectMapper.writeValueAsString(out));
            logger.info("Report generated + queued for email student={} assessment={} pdf={}",
                    ev.userStudentId, ev.assessmentId, (pdfUrl != null));
        } catch (ScoresNotReadyException e) {
            // Log the cause here: @RetryableTopic republishes silently, so without
            // this the root reason never reaches the logs and the only artifact is
            // an opaque DLT entry.
            logger.warn("Report generate retrying (scores not ready) student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
            throw new RetryablePipelineException("scores not ready student=" + ev.userStudentId
                    + " assessment=" + ev.assessmentId, e);
        } catch (SanityFailedException e) {
            if ("NOT_COMPLETED".equals(e.getCode())) {
                logger.warn("Report generate retrying (mapping not completed) student={} assessment={}: {}",
                        ev.userStudentId, ev.assessmentId, e.getMessage());
                throw new RetryablePipelineException("mapping not yet visible as completed", e);
            }
            // Other sanity failures are terminal → not retried → DLT.
            logger.error("Report generate TERMINAL (sanity {}) student={} assessment={}: {}",
                    e.getCode(), ev.userStudentId, ev.assessmentId, e.getMessage());
            throw new IllegalStateException("sanity terminal " + e.getCode() + ": " + e.getMessage(), e);
        } catch (ReportRoutingException e) {
            // No template / no default mapped → nothing to generate. Now that ALL
            // students flow through this stage, treat it as a benign skip (ack, no
            // DLT) — matching the legacy auto-gen, which just logged and moved on.
            // Otherwise every template-less assessment would flood the DLT.
            logger.warn("Report generate skipped (no template) student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
            return;
        } catch (Exception e) {
            // Unknown → treat as transient so flaky infra gets a chance to heal.
            logger.error("Report generate retrying (unexpected error) student={} assessment={}",
                    ev.userStudentId, ev.assessmentId, e);
            throw new RetryablePipelineException("generate failed student=" + ev.userStudentId, e);
        }
    }

    /** Cheap PDF-only re-render (HTML already in Spaces) up to N attempts; null = give up → link-only. */
    private String retryPdf(String reportUrl) {
        for (int i = 1; i <= pdfAttempts; i++) {
            try {
                return pdfRenderService.renderAndUpload(reportUrl);
            } catch (Exception ex) {
                logger.info("PDF re-render attempt {}/{} failed: {}", i, pdfAttempts, ex.getMessage());
            }
        }
        return null;
    }

    @DltHandler
    public void dlt(String json,
                    @Header(name = KafkaHeaders.DLT_EXCEPTION_FQCN, required = false) String excClass,
                    @Header(name = KafkaHeaders.DLT_EXCEPTION_MESSAGE, required = false) String excMessage,
                    @Header(name = KafkaHeaders.DLT_EXCEPTION_STACKTRACE, required = false) String excStack) {
        // Surface the failure reason at the DLT. The exception that exhausted the
        // retries is attached by the framework as DLT_* headers — without logging
        // them here the DLT entry is just the payload with no cause.
        logger.error("REPORT-GENERATE DLT (needs ops attention — no report produced): payload={} cause={}: {}\n{}",
                json, excClass, excMessage, excStack);
    }
}
