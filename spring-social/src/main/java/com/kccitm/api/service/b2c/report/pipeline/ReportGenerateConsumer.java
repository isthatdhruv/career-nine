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
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

/**
 * Generate stage (report-worker only). Consumes {@code report.generate}, renders
 * the default-template (pager) report via {@link ReportService#generate}, and
 * produces a {@link ReportEmailEvent}. Concurrency is bounded (Gotenberg is the
 * CPU bottleneck). Retries ONLY transient {@link RetryablePipelineException};
 * terminal errors (no template) go straight to the DLT.
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
            String pdfUrl = "ready".equals(r.pdfStatus) ? r.pdfUrl : retryPdf(r.reportUrl);
            boolean linkOnly = (pdfUrl == null);
            if (linkOnly) {
                logger.warn("PDF unavailable after {} attempts; sending link-only student={} assessment={}",
                        pdfAttempts, ev.userStudentId, ev.assessmentId);
            }
            ReportEmailEvent out = new ReportEmailEvent(ev, r.reportUrl, pdfUrl, linkOnly);
            kafkaTemplate.send(ReportPipelineConfig.TOPIC_EMAIL, out.key(),
                    objectMapper.writeValueAsString(out));
            logger.info("Report generated student={} assessment={} pdf={}",
                    ev.userStudentId, ev.assessmentId, (pdfUrl != null));
        } catch (ScoresNotReadyException e) {
            throw new RetryablePipelineException("scores not ready student=" + ev.userStudentId
                    + " assessment=" + ev.assessmentId, e);
        } catch (SanityFailedException e) {
            if ("NOT_COMPLETED".equals(e.getCode())) {
                throw new RetryablePipelineException("mapping not yet visible as completed", e);
            }
            // Other sanity failures are terminal → not retried → DLT.
            throw new IllegalStateException("sanity terminal " + e.getCode() + ": " + e.getMessage(), e);
        } catch (ReportRoutingException e) {
            // No template / no default → nothing to generate → terminal → DLT.
            throw new IllegalStateException("routing terminal: " + e.getMessage(), e);
        } catch (Exception e) {
            // Unknown → treat as transient so flaky infra gets a chance to heal.
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
    public void dlt(String json) {
        logger.error("REPORT-GENERATE DLT (needs ops attention — no report produced): {}", json);
    }
}
