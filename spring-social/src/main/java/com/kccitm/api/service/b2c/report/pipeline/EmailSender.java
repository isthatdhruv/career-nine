package com.kccitm.api.service.b2c.report.pipeline;

/**
 * Swappable transport for report emails. Default impl = {@link OdooEmailSender}.
 * Swapping to a Workspace SMTP relay / SES / Mandrill later is a new impl + a
 * config switch — no consumer change.
 *
 * <p>Contract: <b>synchronous</b> and <b>throws on failure</b>, so the email
 * consumer only marks the job sent (and commits the Kafka offset) on a real
 * success — the basis of the delivery guarantee.
 */
public interface EmailSender {

    /**
     * @param event    the email job (recipient, branding, report link).
     * @param pdfBytes the PDF to attach, or {@code null} for a link-only email.
     */
    void sendReportEmail(ReportEmailEvent event, byte[] pdfBytes) throws Exception;
}
