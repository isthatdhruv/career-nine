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
    LEAD_CRM_LINK("lead_crm_link", "Link to the lead in Odoo CRM (blank until synced)", "Lead");

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
