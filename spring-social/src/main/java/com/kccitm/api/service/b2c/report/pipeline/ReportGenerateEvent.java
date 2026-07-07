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

    // ── Admin-enqueue extensions (2026-07). Legacy events omit these; the field
    // initializers ARE the backward-compat defaults (Jackson only overwrites
    // fields present in the JSON), so on-submission events behave exactly as
    // before: force=false, default template, whitelabel-gated ("auto") email.
    /** true = recompute intermediary scores + placeholders; false = reuse cached. */
    public boolean force = false;
    /** Explicit template; null = the assessment's default template. */
    public Long reportTemplateId = null;
    /** "auto" = whitelabel-gated (legacy) · "none" = never email · "all" = email anyone with an address. */
    public String emailMode = "auto";
    /** Set per admin enqueue action; folded into the email idempotency key. */
    public String batchId = null;

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
