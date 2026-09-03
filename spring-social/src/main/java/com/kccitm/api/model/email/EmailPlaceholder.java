package com.kccitm.api.model.email;

/**
 * Catalog of {{placeholders}} a template may reference. Each {@link EmailType} declares the
 * subset it supports; the editor's "insert variable" palette reads that subset, and
 * {@code PlaceholderResolver} fills the values per send. Branding placeholders
 * ({@link #EMAIL_HEADER}, {@link #EMAIL_FOOTER}, {@link #SCHOOL_NAME}, {@link #LOGO_URL}) are
 * derived from the institute/student context; the rest come from the caller's context map.
 */
public enum EmailPlaceholder {

    // — Student —
    STUDENT_NAME("student_name", "Student full name", "Student"),
    FIRST_NAME("first_name", "Student first name", "Student"),
    STUDENT_EMAIL("student_email", "Student email address", "Student"),

    // — Credentials —
    USERNAME("username", "Login username", "Credentials"),
    PASSWORD("password", "Login password / DOB", "Credentials"),

    // — Links —
    DASHBOARD_LINK("dashboard_link", "Student dashboard / login URL", "Links"),
    ACTION_LINK("action_link", "Primary call-to-action URL", "Links"),
    RESET_LINK("reset_link", "Password-reset URL", "Links"),

    // — Branding (derived from the institute/student) —
    SCHOOL_NAME("school_name", "School name (or 'Career-9')", "Branding"),
    LOGO_URL("logo_url", "School logo URL (whitelabel)", "Branding"),
    EMAIL_HEADER("email_header", "Branded header block (HTML)", "Branding"),
    EMAIL_FOOTER("email_footer", "Branded footer block (HTML)", "Branding"),

    // — Report —
    REPORT_LINK("report_link", "Hosted report URL", "Report"),
    REPORT_PDF_LINK("report_pdf_link", "Report PDF download URL", "Report"),
    REPORT_TYPE("report_type", "Report type / name", "Report"),

    // — Assessment —
    ASSESSMENT_NAME("assessment_name", "Assessment name", "Assessment"),

    // — Payment —
    AMOUNT("amount", "Payment amount", "Payment"),
    PLAN_NAME("plan_name", "Plan / product name", "Payment"),
    INVOICE_ID("invoice_id", "Invoice / order id", "Payment"),
    PAYMENT_DATE("payment_date", "Payment date", "Payment"),

    // — One-time codes —
    OTP_CODE("otp_code", "One-time verification code", "Verification"),

    // — Lead (public capture form on career-9.com) —
    // Named apart from the student placeholders on purpose: a lead is not a student yet,
    // and a template that said {{student_name}} above a form submission would be wrong
    // for the two thirds of leads (SCHOOL, PARENT) that never become one.
    LEAD_NAME("lead_name", "Name on the enquiry form", "Lead"),
    LEAD_EMAIL("lead_email", "Email on the enquiry form", "Lead"),
    LEAD_PHONE("lead_phone", "Phone on the enquiry form", "Lead"),
    LEAD_TYPE("lead_type", "SCHOOL / PARENT / STUDENT", "Lead"),
    LEAD_SOURCE("lead_source", "Where the enquiry came from", "Lead"),
    LEAD_SCHOOL("lead_school", "School named on the enquiry", "Lead"),
    LEAD_CITY("lead_city", "City on the enquiry", "Lead"),
    LEAD_DESIGNATION("lead_designation", "Designation on the enquiry", "Lead"),
    LEAD_DETAILS("lead_details", "Every submitted field, as an HTML table", "Lead"),
    LEAD_RECEIVED_AT("lead_received_at", "When the enquiry arrived", "Lead"),
    LEAD_ID("lead_id", "Career-9 lead id", "Lead"),
    LEAD_CRM_LINK("lead_crm_link", "Link to the lead in Odoo CRM (blank until synced)", "Lead"),

    // — Ported from inline senders (mail catalogue, Sep 2026) —
    ACCOUNT_NAME("account_name", "Email account name", "System"),
    BOOKING_LINK("booking_link", "Booking Link", "Counselling"),
    CONTACT_PERSON_NAME("contact_person_name", "Contact Person Name", "School"),
    COUNSELLOR_NAME("counsellor_name", "Counsellor Name", "Counselling"),
    FAILED_STUDENTS("failed_students", "Students whose report download failed", "School"),
    LMS_LINK("lms_link", "LMS Link", "Links"),
    MEETING_LINK("meeting_link", "Meeting Link", "Counselling"),
    MISSING_REPORT_COUNT("missing_report_count", "Students without a generated report", "Report"),
    ONE_PAGER_LINK("one_pager_link", "One-pager report URL", "Report"),
    PAYMENT_LINK("payment_link", "Payment Link", "Payment"),
    REMINDER_PERIOD("reminder_period", "Reminder lead time (e.g. 24 hours)", "Counselling"),
    REPORT_COUNT("report_count", "Report Count", "Report"),
    SESSION_COUNT("session_count", "Session Count", "Counselling"),
    SESSION_DATE("session_date", "Session Date", "Counselling"),
    SESSION_DATETIME("session_datetime", "Session date and time", "Counselling"),
    SESSION_TIME("session_time", "Session Time", "Counselling"),
    SESSIONS_AFFECTED("sessions_affected", "Number of sessions affected", "Counselling"),
    STUDENT_COUNT("student_count", "Student Count", "School"),
    STUDENTS_HTML("students_html", "Students list (HTML block)", "School"),
    ACCOUNT_MODE("account_mode", "Email account mode (API / SMTP)", "System"),
    ACCOUNT_PROVIDER("account_provider", "Email account provider", "System"),
    ADMIN_NAME("admin_name", "Admin Name", "System"),
    AFFECTED_STUDENTS_HTML("affected_students_html", "Affected students list (HTML block)", "Counselling"),
    CALENDAR_LINK("calendar_link", "Add-to-calendar link", "Counselling"),
    CANCELLATION_REASON("cancellation_reason", "Cancellation Reason", "Counselling"),
    CANCELLED_BY_NAME("cancelled_by_name", "Who cancelled", "Counselling"),
    CHECKIN_CODE("checkin_code", "Check-in code", "Counselling"),
    COUNSELLOR_EMAIL("counsellor_email", "Counsellor Email", "Counselling"),
    DISPUTE_NOTE("dispute_note", "Dispute Note", "Counselling"),
    DURATION_MINUTES("duration_minutes", "Session duration (minutes)", "Counselling"),
    OLD_SESSION_DATE("old_session_date", "Previous session date", "Counselling"),
    OLD_SESSION_TIME("old_session_time", "Previous session time", "Counselling"),
    RECIPIENT_NAME("recipient_name", "Recipient name", "Counselling"),
    REFERRAL_LINK("referral_link", "Referral Link", "Counselling"),
    REMAINING_CHANGES("remaining_changes", "Free changes remaining", "Counselling"),
    REMAINING_SESSIONS("remaining_sessions", "Remaining Sessions", "Counselling"),
    RESCHEDULE_LINK("reschedule_link", "Reschedule Link", "Counselling"),
    RESCHEDULE_REASON("reschedule_reason", "Reschedule Reason", "Counselling"),
    SESSION_DETAILS_HTML("session_details_html", "Session details (HTML block)", "Counselling"),
    SESSION_DETAILS_TEXT("session_details_text", "Session details (plain text)", "Counselling"),
    SESSION_END_TIME("session_end_time", "Session end time", "Counselling"),
    SESSIONS_HTML("sessions_html", "Sessions list (HTML block)", "Counselling"),
    STUDENT_PHONE("student_phone", "Student phone", "Student"),
    STUDENT_REASON("student_reason", "Reason given by the student", "Counselling"),
    VENUE("venue", "Venue", "Counselling");

    private final String key;
    private final String label;
    private final String group;

    EmailPlaceholder(String key, String label, String group) {
        this.key = key;
        this.label = label;
        this.group = group;
    }

    /** The token name used in templates as {@code {{key}}}. */
    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    public String group() {
        return group;
    }
}
