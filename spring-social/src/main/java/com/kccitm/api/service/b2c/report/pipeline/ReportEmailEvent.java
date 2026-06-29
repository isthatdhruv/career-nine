package com.kccitm.api.service.b2c.report.pipeline;

/**
 * Kafka payload for the <b>report.email</b> topic. Produced by the generate
 * consumer for whitelabel students only (with a recipient address), after the
 * report (HTML + PDF) is rendered and stored in Spaces; consumed by the email
 * consumer which sends the co-branded email.
 *
 * <p>{@code linkOnly=true} means the PDF render failed after retries — send the
 * HTML report link without the attachment (degraded, but the student still gets
 * their report). Plain public fields + no-arg ctor = Jackson-friendly.
 */
public class ReportEmailEvent {

    public Long userStudentId;
    public Long assessmentId;
    public String recipientEmail;
    public boolean whitelabel;
    public String schoolName;
    public String logoUrl;
    public String reportUrl;   // Spaces HTML report URL (always present)
    public String pdfUrl;      // Spaces PDF URL (null when linkOnly)
    public boolean linkOnly;   // true → PDF unavailable, send link without attachment

    public ReportEmailEvent() {
    }

    public ReportEmailEvent(ReportGenerateEvent src, String reportUrl, String pdfUrl, boolean linkOnly) {
        this.userStudentId = src.userStudentId;
        this.assessmentId = src.assessmentId;
        this.recipientEmail = src.recipientEmail;
        this.whitelabel = src.whitelabel;
        this.schoolName = src.schoolName;
        this.logoUrl = src.logoUrl;
        this.reportUrl = reportUrl;
        this.pdfUrl = pdfUrl;
        this.linkOnly = linkOnly;
    }

    public String key() {
        return userStudentId + ":" + assessmentId;
    }
}
