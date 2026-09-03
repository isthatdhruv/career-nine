package com.kccitm.api.model.mail;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static com.kccitm.api.model.mail.MailPredicate.*;
import static com.kccitm.api.model.mail.MailRecipientRole.*;

/**
 * The catalogue of facts the code reports. Code publishes an event with a
 * {@link MailEventContext}; admin-configured automations decide what, if anything, gets sent.
 *
 * <p>Each event declares: the subject kinds it identifies (used to cancel pending mail when a
 * later event arrives for the same subject), the recipient roles it can address, the
 * placeholder fields it supplies (the template palette for automations on this event), the
 * date fields an automation can schedule relative to, and the predicates that make sense as
 * conditions. Adding a mail opportunity to a flow means adding one entry here and one
 * {@code publish(...)} call at the right line; everything after that is admin territory.
 */
public enum MailEvent {

    LEAD_CAPTURED("lead.captured", "Enquiry received", "Someone submitted the enquiry form on career-9.com.",
            kinds("lead"), roles(LEAD_CONTACT, INTERNAL_LIST),
            fields("lead_name", "lead_email", "lead_phone", "lead_type", "lead_source", "lead_school", "lead_city",
                    "lead_designation", "lead_details", "lead_received_at", "lead_id", "lead_crm_link", "first_name"),
            dates(), preds()),

    ACCOUNT_CREATED("account.created", "Account created", "A dashboard user signed up.",
            kinds("student"), roles(STUDENT),
            fields("student_name", "first_name", "student_email", "dashboard_link"), dates(), preds()),

    ENTITLEMENT_GRANTED("entitlement.granted", "Assessment access granted",
            "A student was given access to an assessment, by payment, campaign or admin.",
            kinds("entitlement", "student"), roles(STUDENT, PARENT),
            fields("student_name", "first_name", "student_email", "assessment_name", "plan_name", "action_link",
                    "dashboard_link", "booking_link", "remaining_sessions", "expiry_date", "username", "password"),
            dates("expires_at"),
            preds(ASSESSMENT_NOT_STARTED, ASSESSMENT_NOT_COMPLETED, ENTITLEMENT_ACTIVE, HAS_COUNSELLING_SESSIONS,
                    COUNSELLING_NOT_BOOKED, HAS_PARENT_EMAIL)),

    ASSESSMENT_STARTED("assessment.started", "Assessment started", "The student answered the first question.",
            kinds("entitlement", "mapping", "student"), roles(STUDENT),
            fields("student_name", "first_name", "assessment_name", "action_link"), dates(), preds()),

    ASSESSMENT_COMPLETED("assessment.completed", "Assessment completed", "The student submitted the assessment.",
            kinds("entitlement", "mapping", "student"), roles(STUDENT, PARENT, SCHOOL_CONTACT),
            fields("student_name", "first_name", "student_email", "assessment_name", "dashboard_link", "report_link",
                    "school_name", "username", "password"),
            dates(), preds(HAS_COUNSELLING_SESSIONS, COUNSELLING_NOT_BOOKED, HAS_PARENT_EMAIL)),

    REPORT_READY("report.ready", "Report ready", "A report was generated for the student.",
            kinds("entitlement", "student"), roles(STUDENT, PARENT, COUNSELLOR),
            fields("student_name", "first_name", "assessment_name", "report_link", "report_pdf_link", "report_type",
                    "booking_link", "one_pager_link", "dashboard_link", "school_name"),
            dates(), preds(HAS_COUNSELLING_SESSIONS, COUNSELLING_NOT_BOOKED, HAS_PARENT_EMAIL)),

    ASSESSMENT_MAPPED("assessment.mapped", "Assessment assigned by school",
            "A school assigned an assessment to the student.",
            kinds("mapping", "student"), roles(STUDENT, PARENT),
            fields("student_name", "first_name", "assessment_name", "school_name", "action_link", "dashboard_link"),
            dates(), preds(ASSESSMENT_NOT_STARTED, ASSESSMENT_NOT_COMPLETED, HAS_PARENT_EMAIL)),

    PAYMENT_LINK_CREATED("payment.link_created", "Payment link created",
            "A payment link was issued to the student.",
            kinds("payment", "student"), roles(STUDENT),
            fields("student_name", "first_name", "amount", "assessment_name", "plan_name", "payment_link", "expiry_date"),
            dates("expires_at"), preds(PAYMENT_STILL_PENDING)),

    PAYMENT_SUCCEEDED("payment.succeeded", "Payment received", "Razorpay confirmed the payment.",
            kinds("payment", "student"), roles(STUDENT),
            fields("student_name", "first_name", "amount", "assessment_name", "plan_name", "invoice_id", "payment_date",
                    "dashboard_link", "username", "password"),
            dates(), preds()),

    PAYMENT_FAILED("payment.failed", "Payment failed or expired", "The payment failed, was cancelled, or the link expired.",
            kinds("payment", "student"), roles(STUDENT),
            fields("student_name", "first_name", "amount", "assessment_name", "payment_link", "failure_reason"),
            dates(), preds(PAYMENT_STILL_PENDING)),

    APPOINTMENT_CONFIRMED("appointment.confirmed", "Counselling session confirmed",
            "A counselling appointment was booked and confirmed.",
            kinds("appointment", "entitlement", "student"), roles(STUDENT, PARENT, COUNSELLOR),
            fields("student_name", "first_name", "student_email", "counsellor_name", "counsellor_email", "session_date",
                    "session_time", "session_datetime", "session_end_time", "meeting_link", "venue", "duration_minutes",
                    "reschedule_link", "calendar_link", "booking_link"),
            dates("session_start", "session_end"),
            preds(APPOINTMENT_STILL_SCHEDULED, HAS_MEETING_LINK, IS_OFFLINE_SESSION, HAS_PARENT_EMAIL)),

    APPOINTMENT_RESCHEDULED("appointment.rescheduled", "Counselling session rescheduled",
            "An appointment moved to a new time.",
            kinds("appointment", "entitlement", "student"), roles(STUDENT, PARENT, COUNSELLOR),
            fields("student_name", "first_name", "counsellor_name", "counsellor_email", "session_date", "session_time",
                    "session_datetime", "old_session_date", "old_session_time", "meeting_link", "venue",
                    "duration_minutes", "reschedule_link", "reschedule_reason"),
            dates("session_start", "session_end"),
            preds(APPOINTMENT_STILL_SCHEDULED, HAS_MEETING_LINK, IS_OFFLINE_SESSION, HAS_PARENT_EMAIL)),

    APPOINTMENT_CANCELLED("appointment.cancelled", "Counselling session cancelled", "An appointment was cancelled.",
            kinds("appointment", "entitlement", "student"), roles(STUDENT, PARENT, COUNSELLOR),
            fields("student_name", "first_name", "counsellor_name", "session_date", "session_time", "session_datetime",
                    "cancellation_reason", "cancelled_by_name", "booking_link", "remaining_sessions"),
            dates(), preds(HAS_COUNSELLING_SESSIONS, HAS_PARENT_EMAIL)),

    SESSION_COMPLETED("session.completed", "Counselling session completed", "The counsellor marked the session done.",
            kinds("appointment", "entitlement", "student"), roles(STUDENT, PARENT, COUNSELLOR),
            fields("student_name", "first_name", "counsellor_name", "session_date", "session_time", "session_datetime",
                    "session_notes_html", "remaining_sessions", "booking_link", "report_link"),
            dates(), preds(HAS_COUNSELLING_SESSIONS, COUNSELLING_NOT_BOOKED, HAS_PARENT_EMAIL)),

    REPORT_RELEASED("report.released", "Report released by counsellor",
            "The counsellor released the report to the student.",
            kinds("appointment", "entitlement", "student"), roles(STUDENT, PARENT),
            fields("student_name", "first_name", "counsellor_name", "report_link", "dashboard_link"),
            dates(), preds(HAS_PARENT_EMAIL)),

    DASHBOARD_RELEASED("dashboard.released", "School dashboard released",
            "An admin released the principal dashboard for a school.",
            kinds("release", "institute"), roles(SCHOOL_CONTACT),
            fields("contact_person_name", "school_name", "dashboard_link", "assessment_name"), dates(), preds()),

    COUNSELLOR_DEACTIVATED("counsellor.deactivated", "Counsellor deactivated",
            "A counsellor was deactivated and their sessions need re-homing.",
            kinds("counsellor"), roles(COUNSELLOR, INTERNAL_LIST),
            fields("counsellor_name", "counsellor_email", "sessions_affected", "affected_students_html", "admin_name"),
            dates(), preds()),

    /** Not published by code: the trigger a scheduled (cron + audience) automation runs under. */
    SCHEDULED("schedule.tick", "Scheduled run", "A cron schedule fired for an audience.",
            kinds("audience"), roles(STUDENT, PARENT, COUNSELLOR, SCHOOL_CONTACT, INTERNAL_LIST),
            fields(new String[0]), dates(), preds());

    private final String key;
    private final String label;
    private final String description;
    private final List<String> subjectKinds;
    private final List<MailRecipientRole> roles;
    private final List<String> fields;
    private final List<String> dateFields;
    private final List<MailPredicate> predicates;

    MailEvent(String key, String label, String description, List<String> subjectKinds,
              List<MailRecipientRole> roles, List<String> fields, List<String> dateFields,
              List<MailPredicate> predicates) {
        this.key = key;
        this.label = label;
        this.description = description;
        this.subjectKinds = subjectKinds;
        this.roles = roles;
        this.fields = fields;
        this.dateFields = dateFields;
        this.predicates = predicates;
    }

    public String key() { return key; }
    public String label() { return label; }
    public String description() { return description; }
    /** Subject kinds, primary first; a job is indexed under the primary subject. */
    public List<String> subjectKinds() { return subjectKinds; }
    public List<MailRecipientRole> roles() { return roles; }
    public List<String> fields() { return fields; }
    public List<String> dateFields() { return dateFields; }
    public List<MailPredicate> predicates() { return predicates; }

    public static MailEvent fromKey(String key) {
        if (key == null) return null;
        for (MailEvent e : values()) {
            if (e.key.equals(key.trim())) return e;
        }
        return null;
    }

    private static List<String> kinds(String... k) { return Collections.unmodifiableList(Arrays.asList(k)); }
    private static List<MailRecipientRole> roles(MailRecipientRole... r) { return Collections.unmodifiableList(Arrays.asList(r)); }
    private static List<String> fields(String... f) { return Collections.unmodifiableList(Arrays.asList(f)); }
    private static List<String> dates(String... d) { return Collections.unmodifiableList(Arrays.asList(d)); }
    private static List<MailPredicate> preds(MailPredicate... p) { return Collections.unmodifiableList(Arrays.asList(p)); }
}
