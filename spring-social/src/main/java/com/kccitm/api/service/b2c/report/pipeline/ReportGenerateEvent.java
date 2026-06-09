package com.kccitm.api.service.b2c.report.pipeline;

/**
 * Kafka payload for the <b>report.generate</b> topic. Emitted (whitelabel-gated)
 * the moment a student's assessment is marked completed; consumed by the report
 * worker which renders the default-template report and produces a
 * {@link ReportEmailEvent}.
 *
 * <p>Carries the recipient + branding resolved at completion time so the worker
 * needs no extra DB lookups. Plain public fields + no-arg ctor = Jackson-friendly.
 */
public class ReportGenerateEvent {

    public Long userStudentId;
    public Long assessmentId;
    public String recipientEmail;
    public boolean whitelabel;
    public String schoolName;
    public String logoUrl;

    public ReportGenerateEvent() {
    }

    public ReportGenerateEvent(Long userStudentId, Long assessmentId, String recipientEmail,
                               boolean whitelabel, String schoolName, String logoUrl) {
        this.userStudentId = userStudentId;
        this.assessmentId = assessmentId;
        this.recipientEmail = recipientEmail;
        this.whitelabel = whitelabel;
        this.schoolName = schoolName;
        this.logoUrl = logoUrl;
    }

    /** Stable Kafka key + idempotency identity: one report per student+assessment. */
    public String key() {
        return userStudentId + ":" + assessmentId;
    }
}
