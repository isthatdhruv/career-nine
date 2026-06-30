package com.kccitm.api.model.email;

import java.util.Arrays;
import java.util.List;

/**
 * Catalog of every send-scenario in the system. Each value is a configurable "slot": the
 * admin picks a default template, the editor reads {@link #placeholders()} for its variable
 * palette, and the dispatcher logs sends under this key. {@link #defaultDeliveryMode()} is
 * used until a resolved template's own per-template mode applies.
 *
 * <p>Phase 3 fills the auth/credentials/assessment/payment/report/B2C/B2B scenarios.
 * Counselling + legacy KCCITM scenarios are added in Phase 5 as those call sites migrate.
 */
public enum EmailType {

    // ── Auth / account ──────────────────────────────────────────────────────
    PASSWORD_RESET("Password reset link", "Auth", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.RESET_LINK,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.SCHOOL_NAME,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    PASSWORD_RESET_CONFIRM("Password reset confirmation", "Auth", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    ACCOUNT_WELCOME("Account welcome / under review", "Auth", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.SCHOOL_NAME,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    ACCOUNT_ACTIVATED("Account activated", "Auth", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    ADMIN_PASSWORD_RESET("Admin-issued password reset", "Auth", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.USERNAME,
            EmailPlaceholder.PASSWORD, EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.SCHOOL_NAME,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── Credentials / provisioning ──────────────────────────────────────────
    LOGIN_CREDENTIALS("Login credentials", "Credentials", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.USERNAME,
            EmailPlaceholder.PASSWORD, EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.SCHOOL_NAME,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    LEAD_WELCOME("Lead welcome / nurture", "Credentials", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    STUDENT_ID_EMAIL("Student ID / details", "Credentials", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.USERNAME,
            EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    EMAIL_VERIFICATION_OTP("Email verification OTP", "Verification", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.OTP_CODE,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── Assessment / B2C ────────────────────────────────────────────────────
    ASSESSMENT_COMPLETION("Assessment completion", "Assessment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.REPORT_LINK, EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.SCHOOL_NAME,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    ENTITLEMENT_GRANTED("Assessment access granted", "B2C", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.PLAN_NAME,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.ACTION_LINK, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    ENTITLEMENT_REMINDER("Assessment access reminder", "B2C", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    COUNSELLING_REQUEST("Counselling request received", "B2C", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.STUDENT_EMAIL, EmailPlaceholder.ACTION_LINK),

    // ── Payments ────────────────────────────────────────────────────────────
    PAYMENT_SUCCESS("Payment success / receipt", "Payment", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT,
            EmailPlaceholder.PLAN_NAME, EmailPlaceholder.INVOICE_ID, EmailPlaceholder.PAYMENT_DATE,
            EmailPlaceholder.USERNAME, EmailPlaceholder.PASSWORD, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    PAYMENT_FAILED("Payment failed / cancelled / expired", "Payment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    PAYMENT_REMINDER("Payment pending reminder", "Payment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    PAYMENT_LINK("Payment link", "Payment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── Reports ─────────────────────────────────────────────────────────────
    REPORT_READY("Report ready (automatic)", "Report", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.REPORT_LINK,
            EmailPlaceholder.REPORT_PDF_LINK, EmailPlaceholder.REPORT_TYPE, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    CONTACT_PERSON_REPORT("Report email to contact person", "Report", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.REPORT_LINK, EmailPlaceholder.REPORT_PDF_LINK, EmailPlaceholder.REPORT_TYPE,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── B2B / school registration ───────────────────────────────────────────
    SCHOOL_REGISTRATION("School registration", "B2B", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    ASSESSMENT_INSTITUTE_MAPPING("Assessment assigned to institute", "B2B", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── Reminders ─────────────────────────────────────────────────────────────
    REMINDER("Reminder (assessment / counselling)", "Reminder", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.FIRST_NAME, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── Counselling (Phase 5) ───────────────────────────────────────────────
    COUNSELLING_NOTIFICATION("Counselling lifecycle notification", "Counselling", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.FIRST_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    COUNSELLING_BOOKING("Counselling booking confirmation (.ics)", "Counselling", EmailDeliveryMode.SYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.FIRST_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    // ── Legacy KCCITM (Phase 5) ─────────────────────────────────────────────
    KCCITM_NOTIFICATION("Legacy KCCITM email", "KCCITM", EmailDeliveryMode.ASYNC),

    // ── System ──────────────────────────────────────────────────────────────
    ACCOUNT_TEST("Email-account test message", "System", EmailDeliveryMode.SYNC),
    GENERIC("Generic / ad-hoc email", "System", EmailDeliveryMode.ASYNC);

    private final String label;
    private final String category;
    private final EmailDeliveryMode defaultDeliveryMode;
    private final List<EmailPlaceholder> placeholders;

    EmailType(String label, String category, EmailDeliveryMode defaultDeliveryMode,
              EmailPlaceholder... placeholders) {
        this.label = label;
        this.category = category;
        this.defaultDeliveryMode = defaultDeliveryMode;
        this.placeholders = Arrays.asList(placeholders);
    }

    public String label() {
        return label;
    }

    public String category() {
        return category;
    }

    public EmailDeliveryMode defaultDeliveryMode() {
        return defaultDeliveryMode;
    }

    public List<EmailPlaceholder> placeholders() {
        return placeholders;
    }

    /** Null-safe lookup by name; returns null for unknown keys. */
    public static EmailType from(String name) {
        if (name == null) return null;
        try {
            return EmailType.valueOf(name.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
