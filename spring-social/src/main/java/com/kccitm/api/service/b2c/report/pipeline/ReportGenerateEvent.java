package com.kccitm.api.service.b2c.report.pipeline;

/**
 * Kafka payload for the <b>report.generate</b> topic. Emitted for EVERY student
 * the moment their assessment is marked completed; consumed by the report worker
 * which renders the default-template report. For whitelabel students (with an
 * address) it then produces a {@link ReportEmailEvent}; for everyone else the
 * report is generated + stored and no email is queued.
 *
 * <p>{@code whitelabel} carries the email-gating decision; {@code recipientEmail}
 * + branding are resolved at completion time so the worker needs no extra DB
 * lookups. Plain public fields + no-arg ctor = Jackson-friendly.
 */
public class ReportGenerateEvent {

    public Long userStudentId;
    public Long assessmentId;
    public String recipientEmail;
    public boolean whitelabel;
    public String schoolName;
    public String logoUrl;
    /** Assessment toggle: when true, mail the report to non-whitelabel students too (Phase 4). */
    public boolean emailReportEnabled;
    /** Resolved sending account (institute default → global). Null → worker's classpath default sender. */
    public Long emailAccountId;
    /** Resolved REPORT_READY template id. Null → the built-in composer HTML. */
    public Long emailTemplateId;
    /** Student display name (for {{student_name}} in a REPORT_READY template). */
    public String studentName;

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
