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
    /**
     * Acknowledgement to the person who filled the enquiry form on career-9.com. Sent from
     * {@code LeadNotificationService} on every capture, whatever the lead type — a school
     * or a parent gets an acknowledgement too, they simply never get credentials.
     */
    LEAD_WELCOME("Lead welcome / acknowledgement", "Lead", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.LEAD_NAME, EmailPlaceholder.LEAD_EMAIL, EmailPlaceholder.LEAD_PHONE,
            EmailPlaceholder.LEAD_TYPE, EmailPlaceholder.LEAD_SCHOOL, EmailPlaceholder.LEAD_CITY,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),

    /**
     * Internal alert: a new enquiry has arrived. Recipients are not passed by the caller —
     * they come from {@code email_notification_recipient}, which is what makes this the one
     * scenario an admin can re-address without a deploy.
     */
    LEAD_NOTIFICATION("New lead alert (internal)", "Lead", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.LEAD_NAME, EmailPlaceholder.LEAD_EMAIL, EmailPlaceholder.LEAD_PHONE,
            EmailPlaceholder.LEAD_TYPE, EmailPlaceholder.LEAD_SOURCE, EmailPlaceholder.LEAD_SCHOOL,
            EmailPlaceholder.LEAD_CITY, EmailPlaceholder.LEAD_DESIGNATION,
            EmailPlaceholder.LEAD_DETAILS, EmailPlaceholder.LEAD_RECEIVED_AT,
            EmailPlaceholder.LEAD_ID, EmailPlaceholder.LEAD_CRM_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
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
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.PASSWORD, EmailPlaceholder.USERNAME),
    ENTITLEMENT_GRANTED("Assessment access granted", "B2C", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.PLAN_NAME,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.ACTION_LINK, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.PASSWORD, EmailPlaceholder.USERNAME),
    ENTITLEMENT_REMINDER("Assessment access reminder", "B2C", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    COUNSELLING_REQUEST("Counselling request received", "B2C", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.STUDENT_EMAIL, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.STUDENT_PHONE),

    // ── Payments ────────────────────────────────────────────────────────────
    PAYMENT_SUCCESS("Payment success / receipt", "Payment", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT,
            EmailPlaceholder.PLAN_NAME, EmailPlaceholder.INVOICE_ID, EmailPlaceholder.PAYMENT_DATE,
            EmailPlaceholder.USERNAME, EmailPlaceholder.PASSWORD, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER),
    PAYMENT_FAILED("Payment failed / cancelled / expired", "Payment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.PAYMENT_LINK),
    PAYMENT_REMINDER("Payment pending reminder", "Payment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.PAYMENT_LINK),
    PAYMENT_LINK("Payment link", "Payment", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.AMOUNT, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.PAYMENT_LINK),

    // ── Reports ─────────────────────────────────────────────────────────────
    REPORT_READY("Report ready (automatic)", "Report", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.REPORT_LINK,
            EmailPlaceholder.REPORT_PDF_LINK, EmailPlaceholder.REPORT_TYPE, EmailPlaceholder.DASHBOARD_LINK,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.BOOKING_LINK, EmailPlaceholder.ONE_PAGER_LINK,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.COUNSELLOR_NAME, EmailPlaceholder.SESSION_DATETIME),
    CONTACT_PERSON_REPORT("Report email to contact person", "Report", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.REPORT_LINK, EmailPlaceholder.REPORT_PDF_LINK, EmailPlaceholder.REPORT_TYPE,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.CONTACT_PERSON_NAME, EmailPlaceholder.FAILED_STUDENTS, EmailPlaceholder.MISSING_REPORT_COUNT, EmailPlaceholder.REPORT_COUNT, EmailPlaceholder.STUDENTS_HTML),

    /**
     * Sent by an admin after releasing a school's principal dashboard: tells the contact
     * person the dashboard is live, how to open it, and who to contact if it misbehaves.
     * SYNC because it is sent from a button and the admin is told whether it went.
     */
    SCHOOL_DASHBOARD_READY("School dashboard released", "Report", EmailDeliveryMode.SYNC,
            EmailPlaceholder.FIRST_NAME, EmailPlaceholder.SCHOOL_NAME,
            EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.CONTACT_PERSON_NAME),

    // ── B2B / school registration ───────────────────────────────────────────
    SCHOOL_REGISTRATION("School registration", "B2B", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.PASSWORD, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.USERNAME),
    ASSESSMENT_INSTITUTE_MAPPING("Assessment assigned to institute", "B2B", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.PASSWORD, EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.USERNAME),

    // ── Reminders ─────────────────────────────────────────────────────────────
    REMINDER("Reminder (assessment / counselling)", "Reminder", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.FIRST_NAME, EmailPlaceholder.ASSESSMENT_NAME,
            EmailPlaceholder.ACTION_LINK, EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.SCHOOL_NAME),

    // ── Counselling (Phase 5) ───────────────────────────────────────────────
    COUNSELLING_NOTIFICATION("Counselling lifecycle notification", "Counselling", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.FIRST_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.COUNSELLOR_NAME, EmailPlaceholder.MEETING_LINK, EmailPlaceholder.REMINDER_PERIOD, EmailPlaceholder.SESSION_COUNT, EmailPlaceholder.SESSION_DATE, EmailPlaceholder.SESSION_DATETIME, EmailPlaceholder.SESSION_TIME,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.BOOKING_LINK, EmailPlaceholder.CANCELLATION_REASON, EmailPlaceholder.CANCELLED_BY_NAME, EmailPlaceholder.CHECKIN_CODE, EmailPlaceholder.DISPUTE_NOTE, EmailPlaceholder.DURATION_MINUTES, EmailPlaceholder.OLD_SESSION_DATE, EmailPlaceholder.OLD_SESSION_TIME, EmailPlaceholder.RECIPIENT_NAME, EmailPlaceholder.REFERRAL_LINK, EmailPlaceholder.REMAINING_CHANGES, EmailPlaceholder.REMAINING_SESSIONS, EmailPlaceholder.REPORT_LINK, EmailPlaceholder.RESCHEDULE_LINK, EmailPlaceholder.RESCHEDULE_REASON, EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.SESSION_DETAILS_HTML, EmailPlaceholder.SESSION_DETAILS_TEXT, EmailPlaceholder.SESSIONS_AFFECTED, EmailPlaceholder.SESSIONS_HTML, EmailPlaceholder.STUDENT_REASON, EmailPlaceholder.VENUE),
    COUNSELLING_BOOKING("Counselling booking confirmation (.ics)", "Counselling", EmailDeliveryMode.SYNC,
            EmailPlaceholder.STUDENT_NAME, EmailPlaceholder.FIRST_NAME, EmailPlaceholder.ACTION_LINK,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.ASSESSMENT_NAME, EmailPlaceholder.CALENDAR_LINK, EmailPlaceholder.COUNSELLOR_NAME, EmailPlaceholder.DURATION_MINUTES, EmailPlaceholder.MEETING_LINK, EmailPlaceholder.REPORT_LINK, EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.SESSION_DATE, EmailPlaceholder.SESSION_END_TIME, EmailPlaceholder.SESSION_TIME, EmailPlaceholder.VENUE),

    /**
     * Internal alert: a counsellor has been deactivated and these students lost a session.
     * Like LEAD_NOTIFICATION, the recipients are not passed by the caller — they come from
     * {@code email_notification_recipient}, so the ops list is changed without a deploy.
     */
    COUNSELLOR_DEACTIVATED_ALERT("Counsellor deactivated — affected students (internal)", "Counselling",
            EmailDeliveryMode.ASYNC,
            EmailPlaceholder.EMAIL_HEADER, EmailPlaceholder.EMAIL_FOOTER,
            EmailPlaceholder.COUNSELLOR_NAME, EmailPlaceholder.SESSIONS_AFFECTED,
            EmailPlaceholder.ADMIN_NAME, EmailPlaceholder.AFFECTED_STUDENTS_HTML, EmailPlaceholder.COUNSELLOR_EMAIL),

    // ── Legacy KCCITM (Phase 5) ─────────────────────────────────────────────
    KCCITM_NOTIFICATION("Legacy KCCITM email", "KCCITM", EmailDeliveryMode.ASYNC),

    // ── System ──────────────────────────────────────────────────────────────
    ACCOUNT_TEST("Email-account test message", "System", EmailDeliveryMode.SYNC,
            EmailPlaceholder.ACCOUNT_NAME,
            EmailPlaceholder.ACCOUNT_MODE, EmailPlaceholder.ACCOUNT_PROVIDER),
    GENERIC("Generic / ad-hoc email", "System", EmailDeliveryMode.ASYNC,
            EmailPlaceholder.BOOKING_LINK, EmailPlaceholder.CONTACT_PERSON_NAME, EmailPlaceholder.DASHBOARD_LINK, EmailPlaceholder.LMS_LINK, EmailPlaceholder.SCHOOL_NAME, EmailPlaceholder.STUDENT_COUNT, EmailPlaceholder.STUDENTS_HTML);

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
