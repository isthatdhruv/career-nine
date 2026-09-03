package com.kccitm.api.service.email.port;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;

/**
 * Counselling appointment lifecycle mails lifted verbatim from
 * {@code CounsellingNotificationService} so they appear in the admin catalogue exactly as
 * they are sent today.
 *
 * <p>Fidelity: copy is the ORIGINAL text. Dynamic Java expressions became
 * {@code {{placeholders}}}; conditional lines became {@code {{#flag}}…{{/flag}}} /
 * {@code {{^flag}}…{{/flag}}} sections, nested where the Java nests (mode → venue/link).
 * The two Java-built lists — the session facts as an HTML table and as indented text
 * lines — are single pre-rendered blocks, {@code {{session_details_html}}} and
 * {@code {{session_details_text}}}.
 *
 * <p>Every branded mail is poured into the {@code CounsellingEmailHtml.page} shell (or the
 * green shell inside the service for the post-session mail). The shell is ported once into
 * the private helpers at the bottom of this file, and each template's body is the FULL
 * rendered HTML — preheader, wordmark, card, CTA panel, footer — so the catalogue shows
 * what the recipient receives.
 *
 * <p>Mails whose original was plain text ({@code sendEmail} → {@code sendText}) carry the
 * same text in both {@code body} and {@code text}. Every send here goes out under
 * {@link EmailType#COUNSELLING_NOTIFICATION}.
 */
@Component
public class CounsellingLifecyclePorts implements PortedTemplateSource {

    private static final String SRC = "service/counselling/CounsellingNotificationService.java";

    @Override
    public List<PortedTemplate> templates() {
        List<PortedTemplate> out = new ArrayList<>();
        out.add(assignedToCounsellor());
        out.add(sessionConfirmed());
        out.add(sessionCancelled());
        out.add(selfReschedule());
        out.add(selfRescheduleInvite());
        out.add(bookingInvite());
        out.add(rescheduledStudent());
        out.add(rescheduledCounsellor());
        out.add(reminderStudent());
        out.add(reminderCounsellor());
        out.add(sessionComplete());
        out.add(sessionSummaryStudent());
        out.add(sessionSummaryCounsellor());
        return out;
    }

    // ── Plain-text lifecycle mails (sendEmail → sendText) ───────────────────

    /**
     * CounsellingNotificationService#sendAssignedToCounsellorEmail — plain text to the
     * counsellor. The "Reason:" line is emitted only when the student gave one.
     */
    private PortedTemplate assignedToCounsellor() {
        final String text = "Dear {{counsellor_name}},\n\n"
                + "A new counselling session has been assigned to you.\n\n"
                + "Session Details:\n"
                + "{{#has_student_reason}}  Reason: {{student_reason}}\n{{/has_student_reason}}"
                + "{{session_details_text}}"
                + "\nPlease review and confirm the appointment.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.assigned_to_counsellor", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session assigned to counsellor (from code)")
                .source("CounsellingNotificationService#sendAssignedToCounsellorEmail", SRC + ":153-174")
                .mailClass(MailClass.INTERNAL)
                .subject("New Counselling Session Assigned to You")
                .body(text)
                .text(text)
                .variants("has_student_reason")
                .build();
    }

    /**
     * CounsellingNotificationService#sendConfirmedToStudentEmail — plain text to the student.
     * OFFLINE sessions carry the venue (or a "will share shortly" line); ONLINE sessions carry
     * the meeting link only when one is set.
     */
    private PortedTemplate sessionConfirmed() {
        final String text = "Dear {{student_name}},\n\n"
                + "Your counselling session has been confirmed.\n\n"
                + "Session Details:\n"
                + "  Date: {{session_date}}\n"
                + "  Time: {{session_time}}\n"
                + "  Duration: {{duration_minutes}} minutes\n"
                + "{{#is_offline}}  Mode: In-person (Offline)\n"
                + "{{#has_venue}}  Venue: {{venue}}\n{{/has_venue}}"
                + "{{^has_venue}}  Venue: Your counsellor will share the address shortly.\n{{/has_venue}}"
                + "{{/is_offline}}"
                + "{{^is_offline}}  Mode: Online\n"
                + "{{#has_meeting_link}}  Meeting Link: {{meeting_link}}\n{{/has_meeting_link}}"
                + "{{/is_offline}}"
                + "\nPlease be on time for your session.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.session_confirmed", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session confirmed — student (from code)")
                .source("CounsellingNotificationService#sendConfirmedToStudentEmail", SRC + ":176-221")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Counselling Session Confirmed")
                .body(text)
                .text(text)
                .variants("is_offline", "has_venue", "has_meeting_link")
                .build();
    }

    /**
     * CounsellingNotificationService#sendCancellationEmail (both overloads) — plain text to
     * the party who did NOT cancel: the counsellor when the student cancels, the student when
     * the counsellor cancels (AppointmentService#notifyOnCancellation). One body serves both;
     * only {@code recipient_name} / {@code cancelled_by_name} differ.
     */
    private PortedTemplate sessionCancelled() {
        final String text = "Dear {{recipient_name}},\n\n"
                + "Your counselling session scheduled on {{session_date}} at {{session_time}}"
                + " has been cancelled by {{cancelled_by_name}}.\n\n"
                + "{{#has_reason}}Reason given: {{cancellation_reason}}\n\n{{/has_reason}}"
                + "If you have any questions, please contact us.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.session_cancelled", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session cancelled — notice to the other party (from code)")
                .source("CounsellingNotificationService#sendCancellationEmail", SRC + ":223-259")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Counselling Session Cancelled")
                .body(text)
                .text(text)
                .variants("has_reason")
                .build();
    }

    /**
     * CounsellingNotificationService#sendRescheduleEmail — student copy, plain text. The new
     * schedule is the full session block (student view: no Student row, report may be held).
     */
    private PortedTemplate rescheduledStudent() {
        final String text = "Dear {{student_name}},\n\n"
                + "Your counselling session has been rescheduled.\n\n"
                + "Previous Schedule:\n"
                + "  Date: {{old_session_date}}\n"
                + "  Time: {{old_session_time}}\n\n"
                + "New Schedule:\n"
                + "{{session_details_text}}"
                + "\nPlease update your calendar accordingly.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.rescheduled_student", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session rescheduled — student (from code)")
                .source("CounsellingNotificationService#sendRescheduleEmail", SRC + ":439-462")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Counselling Session Rescheduled")
                .body(text)
                .text(text)
                .build();
    }

    /**
     * CounsellingNotificationService#sendRescheduleEmail — counsellor copy, plain text, sent
     * only when the new appointment has a counsellor with an address.
     */
    private PortedTemplate rescheduledCounsellor() {
        final String text = "Dear {{counsellor_name}},\n\n"
                + "A counselling session has been rescheduled.\n\n"
                + "Previous Schedule:\n"
                + "  Date: {{old_session_date}}\n"
                + "  Time: {{old_session_time}}\n\n"
                + "New Schedule:\n"
                + "{{session_details_text}}"
                + "\nRegards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.rescheduled_counsellor", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session rescheduled — counsellor (from code)")
                .source("CounsellingNotificationService#sendRescheduleEmail", SRC + ":463-478")
                .mailClass(MailClass.INTERNAL)
                .subject("Counselling Session Rescheduled")
                .body(text)
                .text(text)
                .build();
    }

    // ── Branded mails (sendRich: HTML + plain-text alternative) ─────────────

    /**
     * CounsellingNotificationService#sendSelfRescheduleEmail → deliverSelfRescheduleEmail with
     * adminReason == null: the counsellor is unavailable, so the student gets a tokenized
     * self-reschedule link. {@code counsellor_name} falls back to "Your counsellor" in Java.
     */
    private PortedTemplate selfReschedule() {
        final String opening = "{{counsellor_name}} is no longer available for your counselling session"
                + "{{#has_slot}} on {{session_date}} at {{session_time}}{{/has_slot}}.";
        final String closing = "Once you choose a time, your session is confirmed instantly and you'll "
                + "get a confirmation with the meeting details.";
        String html = page(
                "Your session has not been cancelled — pick a new time.",
                "Reschedule your counselling session",
                p("Dear {{student_name}},")
                + p(opening)
                + p("Your session has NOT been cancelled — please pick a new slot that suits you.")
                + actionBlock("{{reschedule_link}}", "Choose a new time", "Pick a new slot", "No login needed.")
                + small(closing)
                + small("We're sorry for the inconvenience.")
                + signature());
        String text = "Dear {{student_name}},\n\n"
                + opening + "\n\n"
                + "Your session has NOT been cancelled — please pick a new slot that suits you here:\n"
                + "{{reschedule_link}}\n\n"
                + closing + "\n\n"
                + "We're sorry for the inconvenience.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.self_reschedule", EmailType.COUNSELLING_NOTIFICATION)
                .name("Self-reschedule link — counsellor unavailable (from code)")
                .source("CounsellingNotificationService#sendSelfRescheduleEmail / deliverSelfRescheduleEmail",
                        SRC + ":317-319, 380-436")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Reschedule your counselling session")
                .body(html)
                .text(text)
                .variants("has_slot")
                .build();
    }

    /**
     * CounsellingNotificationService#sendSelfRescheduleInviteEmail → deliverSelfRescheduleEmail
     * with a (possibly empty) admin reason: same link, different opening line, and a
     * "Reason:" paragraph only when the admin wrote one.
     */
    private PortedTemplate selfRescheduleInvite() {
        final String opening = "Your counselling session"
                + "{{#has_slot}} on {{session_date}} at {{session_time}}{{/has_slot}}"
                + " needs to be moved to another time.";
        final String closing = "Once you choose a time, your session is confirmed instantly and you'll "
                + "get a confirmation with the meeting details.";
        String html = page(
                "Your session has not been cancelled — pick a new time.",
                "Reschedule your counselling session",
                p("Dear {{student_name}},")
                + p(opening)
                + "{{#has_reason}}" + p("Reason: {{reschedule_reason}}") + "{{/has_reason}}"
                + p("Your session has NOT been cancelled — please pick a new slot that suits you.")
                + actionBlock("{{reschedule_link}}", "Choose a new time", "Pick a new slot", "No login needed.")
                + small(closing)
                + small("We're sorry for the inconvenience.")
                + signature());
        String text = "Dear {{student_name}},\n\n"
                + opening + "\n\n"
                + "{{#has_reason}}Reason: {{reschedule_reason}}\n\n{{/has_reason}}"
                + "Your session has NOT been cancelled — please pick a new slot that suits you here:\n"
                + "{{reschedule_link}}\n\n"
                + closing + "\n\n"
                + "We're sorry for the inconvenience.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.self_reschedule_invite", EmailType.COUNSELLING_NOTIFICATION)
                .name("Self-reschedule invite — admin requested (from code)")
                .source("CounsellingNotificationService#sendSelfRescheduleInviteEmail / deliverSelfRescheduleEmail",
                        SRC + ":371-374, 380-436")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Reschedule your counselling session")
                .body(html)
                .text(text)
                .variants("has_slot", "has_reason")
                .build();
    }

    /**
     * CounsellingNotificationService#sendBookingInviteEmail — admin-sent, tokenized no-login
     * booking link for a student who completed an assessment but never booked.
     * {@code student_name} falls back to "there" in Java when blank.
     */
    private PortedTemplate bookingInvite() {
        final String intro = "You have completed your assessment — the next step is a one-on-one "
                + "counselling session to turn your results into a real plan.";
        final String closing = "Once you choose a slot, your session is confirmed instantly and you'll "
                + "receive a confirmation email with the meeting details.";
        String html = page(
                "Pick a time for your counselling session — no login needed.",
                "Book your counselling session",
                p("Dear {{student_name}},")
                + p(intro)
                + actionBlock("{{booking_link}}", "Pick a time that suits you", "Book my session", "No login needed.")
                + small(closing)
                + signature());
        String text = "Dear {{student_name}},\n\n"
                + intro + "\n\n"
                + "Pick a time that suits you here (no login needed):\n"
                + "{{booking_link}}\n\n"
                + closing + "\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.booking_invite", EmailType.COUNSELLING_NOTIFICATION)
                .name("Booking invite — no-login link (from code)")
                .source("CounsellingNotificationService#sendBookingInviteEmail", SRC + ":334-368")
                .mailClass(MailClass.SUBSCRIBED)
                .subject("Book your counselling session")
                .body(html)
                .text(text)
                .build();
    }

    /**
     * CounsellingNotificationService#sendReminderEmail — student copy. The identical mail
     * (same subject, HTML and text) is also sent to the parent/guardian address when one was
     * given at booking, so there is no separate parent template.
     */
    private PortedTemplate reminderStudent() {
        String html = page(
                JOIN_PREHEADER,
                "Your counselling session is in {{reminder_period}}",
                p("Dear {{student_name}},")
                + p("This is a reminder that your counselling session is scheduled in {{reminder_period}}.")
                + attendanceBlock(false)
                + detailsTable(false)
                + small("Please be prepared for your session.")
                + signature());
        String text = "Dear {{student_name}},\n\n"
                + "This is a reminder that your counselling session is scheduled in {{reminder_period}}.\n\n"
                + "Session Details:\n"
                + "{{session_details_text}}"
                + "\nPlease be prepared for your session.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.reminder_student", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session reminder — student and parent (from code)")
                .source("CounsellingNotificationService#sendReminderEmail", SRC + ":486-523")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Reminder: Counselling Session in {{reminder_period}}")
                .body(html)
                .text(text)
                .variants("has_slot", "is_offline", "has_venue", "has_meeting_link")
                .build();
    }

    /** CounsellingNotificationService#sendReminderEmail — counsellor copy. */
    private PortedTemplate reminderCounsellor() {
        String html = page(
                JOIN_PREHEADER,
                "Counselling session in {{reminder_period}}",
                p("Dear {{counsellor_name}},")
                + p("This is a reminder that you have a counselling session in {{reminder_period}}.")
                + attendanceBlock(true)
                + detailsTable(true)
                + signature());
        String text = "Dear {{counsellor_name}},\n\n"
                + "This is a reminder that you have a counselling session in {{reminder_period}}.\n\n"
                + "Session Details:\n"
                + "{{session_details_text}}"
                + "\nRegards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.reminder_counsellor", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session reminder — counsellor (from code)")
                .source("CounsellingNotificationService#sendReminderEmail", SRC + ":525-547")
                .mailClass(MailClass.INTERNAL)
                .subject("Reminder: Counselling Session in {{reminder_period}}")
                .body(html)
                .text(text)
                .variants("has_slot", "is_offline", "has_venue", "has_meeting_link")
                .build();
    }

    /**
     * CounsellingNotificationService#sendSessionCompleteEmail → postSessionThankYouHtml. The
     * green-suite shell, not CounsellingEmailHtml.page. In Java the student name is escaped
     * but the referral URL is dropped into the href unescaped.
     */
    private PortedTemplate sessionComplete() {
        String html = greenPage("Thank you for being a part of Career&#8209;9! &#127775;",

                "<p style=\"margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f1f18;\">"
                +     "Hi {{student_name}} &#128075;</p>"
                + "<p style=\"margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#5f6f67;\">"
                +     "We hope your counselling session helped you discover new possibilities, understand "
                +     "yourself better, and take a step closer to making confident career choices. &#128640;</p>"
                + "<p style=\"margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                +     "Remember, your career journey doesn&rsquo;t end with one session. Keep exploring, "
                +     "keep learning, and keep believing in yourself!</p>"

                + greenDivider("&#128153; KNOW SOMEONE WHO NEEDS CAREER CLARITY?")
                + "<p style=\"margin:0 0 10px;font-size:14.5px;line-height:1.65;color:#3d4a44;\">"
                +     "If you found your Career&#8209;9 experience valuable, share it with friends, cousins "
                +     "or family members who may also be wondering:</p>"
                + "<p style=\"margin:0 0 14px;font-size:15px;line-height:1.6;color:#0f1f18;text-align:center;\">"
                +     "<em>&ldquo;What should I choose for my future?&rdquo;</em> &#129300;</p>"
                + "<p style=\"margin:0 0 18px;font-size:14px;line-height:1.65;color:#5f6f67;\">"
                +     "Your recommendation could help someone else discover a path that&rsquo;s right for them.</p>"
                + "<div style=\"text-align:center;margin:0 0 24px;\">"
                + "<a href=\"{{referral_link}}\" style=\"display:inline-block;padding:13px 32px;"
                +     "background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;"
                +     "font-weight:700;font-size:14.5px;\">&#128073; Refer a friend or family member</a>"
                + "</div>"

                + greenDivider("&#128260; SEE YOU AGAIN IN 6 MONTHS!")
                + "<p style=\"margin:0 0 18px;font-size:14.5px;line-height:1.65;color:#5f6f67;\">"
                +     "Your interests, strengths and aspirations can evolve as you grow. That&rsquo;s why "
                +     "we&rsquo;d love to reconnect with you in 6 months and see what has changed, what "
                +     "you&rsquo;ve discovered, and where you want to go next.</p>"
                + "<p style=\"margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                +     "Your future is a journey. We&rsquo;re happy to be part of it. &#128153;</p>"

                + "<p style=\"margin:0 0 4px;font-size:15px;line-height:1.6;color:#0f1f18;\">Warm regards,</p>"
                + "<p style=\"margin:0 0 28px;font-size:15px;line-height:1.6;font-weight:700;color:#059669;\">"
                +     "Team Career&#8209;9</p>");
        String text = "Hi {{student_name}},\n\n"
                + "Thank you for being a part of Career-9!\n\n"
                + "We hope your counselling session helped you discover new possibilities, understand "
                + "yourself better, and take a step closer to making confident career choices. "
                + "Remember, your career journey doesn't end with one session. Keep exploring, keep "
                + "learning, and keep believing in yourself!\n\n"
                + "Know someone who needs career clarity? If you found your Career-9 experience "
                + "valuable, share it with friends, cousins or family members who may also be "
                + "wondering what to choose for their future: {{referral_link}}\n\n"
                + "See you again in 6 months! Your interests, strengths and aspirations can evolve "
                + "as you grow - we'd love to reconnect and see where you want to go next.\n\n"
                + "Your future is a journey. We're happy to be part of it.\n\n"
                + "Warm regards,\nTeam Career-9";
        return PortedTemplate.of("counselling.session_complete", EmailType.COUNSELLING_NOTIFICATION)
                .name("Post-session thank you (from code)")
                .source("CounsellingNotificationService#sendSessionCompleteEmail / postSessionThankYouHtml / greenPage",
                        SRC + ":555-584, 2351-2423")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Thank you for your session — Career-9")
                .body(html)
                .text(text)
                .build();
    }

    /**
     * CounsellingNotificationService#sendSessionSummaryToStudent — admin-triggered resend of
     * the session details plus report guidance, to the student and the parent/guardian
     * (same mail to each). The guidance paragraph picks one of three wordings: report held
     * for counsellor release, report linked, or report not ready.
     */
    private PortedTemplate sessionSummaryStudent() {
        final String intro = "Please find below the details of your counselling session"
                + "{{#has_counsellor}} with {{counsellor_name}}{{/has_counsellor}}.";
        String html = page(
                JOIN_PREHEADER,
                "Your counselling session",
                p("Dear {{student_name}},")
                + p(intro)
                + attendanceBlock(false)
                + detailsTable(false)
                + small(reportGuidanceStudent(""))
                + small("If any of the above is incorrect, please write to us before the session "
                        + "so we can put it right.")
                + signature());
        String text = "Dear {{student_name}},\n\n"
                + intro + "\n\n"
                + "{{session_details_text}}"
                + "\n"
                + reportGuidanceStudent("\n\n")
                + "If any of the above is incorrect, please write to us before the session so we can "
                + "put it right.\n\n"
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.session_summary_student", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session summary — student and parent (from code)")
                .source("CounsellingNotificationService#sendSessionSummaryToStudent / reportGuidance",
                        SRC + ":633-683, 741-757")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session — details and assessment report")
                .body(html)
                .text(text)
                .variants("has_slot", "is_offline", "has_venue", "has_meeting_link",
                        "has_counsellor", "is_report_held", "has_report")
                .build();
    }

    /**
     * CounsellingNotificationService#sendSessionSummaryToCounsellor — admin-triggered resend
     * of the session details plus the student's report to the counsellor. A counsellor may
     * always see the report, so the guidance only branches on whether it exists yet.
     */
    private PortedTemplate sessionSummaryCounsellor() {
        final String intro = "Please find below the details of your counselling session with {{student_name}}.";
        String html = page(
                JOIN_PREHEADER,
                "Counselling session — {{student_name}}",
                p("Dear {{counsellor_name}},")
                + p(intro)
                + attendanceBlock(true)
                + detailsTable(true)
                + small(reportGuidanceCounsellor(""))
                + signature());
        String text = "Dear {{counsellor_name}},\n\n"
                + intro + "\n\n"
                + "{{session_details_text}}"
                + "\n"
                + reportGuidanceCounsellor("\n\n")
                + "Regards,\nCareer-9 Team";
        return PortedTemplate.of("counselling.session_summary_counsellor", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session summary — counsellor (from code)")
                .source("CounsellingNotificationService#sendSessionSummaryToCounsellor / reportGuidance",
                        SRC + ":692-733, 741-757")
                .mailClass(MailClass.INTERNAL)
                .subject("Counselling session — {{student_name}}")
                .body(html)
                .text(text)
                .variants("has_slot", "is_offline", "has_venue", "has_meeting_link", "has_report")
                .build();
    }

    // ── Session blocks shared by the branded mails ──────────────────────────

    /**
     * CounsellingNotificationService#joinPreheader — the inbox preview line: when the session
     * is, then how to attend.
     */
    private static final String JOIN_PREHEADER =
            "{{#has_slot}}{{session_date}}, {{session_time}} — {{/has_slot}}"
            + "{{#is_offline}}in-person session{{/is_offline}}"
            + "{{^is_offline}}"
            + "{{#has_meeting_link}}meeting link inside{{/has_meeting_link}}"
            + "{{^has_meeting_link}}online session{{/has_meeting_link}}"
            + "{{/is_offline}}";

    /**
     * CounsellingNotificationService#attendanceBlock — the "how to attend" panel: venue (or a
     * pending note) for in-person sessions, join button (or a pending note) for online ones.
     */
    private static String attendanceBlock(boolean forCounsellor) {
        return "{{#is_offline}}"
             + "{{#has_venue}}" + venueBlock("{{venue}}") + "{{/has_venue}}"
             + "{{^has_venue}}" + pendingBlock("Venue", forCounsellor
                     ? "No venue has been set for this session yet."
                     : "Your counsellor will share the address shortly.") + "{{/has_venue}}"
             + "{{/is_offline}}"
             + "{{^is_offline}}"
             + "{{#has_meeting_link}}" + joinBlock("{{meeting_link}}", "Online session — meeting link",
                     "Please join a few minutes before the start time.") + "{{/has_meeting_link}}"
             + "{{^has_meeting_link}}" + pendingBlock("Meeting link", forCounsellor
                     ? "No meeting link has been set for this session yet."
                     : "The meeting link will be shared with you before the session.") + "{{/has_meeting_link}}"
             + "{{/is_offline}}";
    }

    /**
     * CounsellingEmailHtml.detailsTable over sessionDetailRows(…, includeAttendance=false) —
     * a Java-built list, so one pre-rendered block.
     */
    private static String detailsTable(boolean forCounsellor) {
        return "<!-- Session facts table (CounsellingEmailHtml.detailsTable): "
             + (forCounsellor
                     ? "Student, School, Assessment, Date, Time, Duration, Mode, Assessment report (Open report link or 'being prepared')"
                     : "School, Assessment, Date, Time, Duration, Counsellor, Mode, Assessment report (Open report link, 'will be shared by your counsellor after the session', or 'being prepared')")
             + "; rows with no value are omitted -->"
             + "{{session_details_html}}";
    }

    private static final String REPORT_HELD_STUDENT =
            "Your assessment report will be shared with you by your counsellor after "
            + "the session, so the results can be talked through rather than simply read.";
    private static final String REPORT_LINKED_STUDENT =
            "Your assessment report is linked above. Please read it before the session so you "
            + "can bring any questions with you.";
    private static final String REPORT_PENDING_STUDENT =
            "Your assessment report is not available yet. We will send it to you as soon as it is ready.";
    private static final String REPORT_LINKED_COUNSELLOR =
            "The assessment report is linked above. Please read it before the session so the "
            + "time can be spent on what matters most to the student.";
    private static final String REPORT_PENDING_COUNSELLOR =
            "The assessment report is not available yet. It will be sent to you as soon as it is ready.";

    /**
     * CounsellingNotificationService#reportGuidance(…, forCounsellor=false). {@code tail} is
     * "" for the HTML (Java trims it) and "\n\n" for the text alternative.
     */
    private static String reportGuidanceStudent(String tail) {
        return "{{#is_report_held}}" + REPORT_HELD_STUDENT + tail + "{{/is_report_held}}"
             + "{{^is_report_held}}"
             + "{{#has_report}}" + REPORT_LINKED_STUDENT + tail + "{{/has_report}}"
             + "{{^has_report}}" + REPORT_PENDING_STUDENT + tail + "{{/has_report}}"
             + "{{/is_report_held}}";
    }

    /** CounsellingNotificationService#reportGuidance(…, forCounsellor=true). */
    private static String reportGuidanceCounsellor(String tail) {
        return "{{#has_report}}" + REPORT_LINKED_COUNSELLOR + tail + "{{/has_report}}"
             + "{{^has_report}}" + REPORT_PENDING_COUNSELLOR + tail + "{{/has_report}}";
    }

    // ── CounsellingEmailHtml shell, ported verbatim (package-private there) ──

    private static final String PAGE_BG   = "#f1f4f9";
    private static final String CARD_BG   = "#ffffff";
    private static final String BRAND     = "#047857";
    private static final String BRAND_LIT = "#059669";
    private static final String INK       = "#101828";
    private static final String MUTED     = "#667085";
    private static final String BORDER    = "#e4e7ec";
    private static final String TINT      = "#f0fdf4";
    private static final String TINT_EDGE = "#a7f3d0";

    private static final String FONT =
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

    /** CounsellingEmailHtml.page — masthead, white card, footer. */
    private static String page(String preheader, String title, String bodyHtml) {
        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
             + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
             + "<title>" + esc(title) + "</title></head>"
             + "<body style=\"margin:0;padding:0;background:" + PAGE_BG + ";\">"
             + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">"
             + esc(preheader) + "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>"
             + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"background:" + PAGE_BG + ";padding:24px 12px;\"><tr><td align=\"center\">"
             + "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"width:100%;max-width:600px;\">"

             + "<tr><td style=\"background:" + BRAND + ";"
             + "background-image:linear-gradient(135deg," + BRAND_LIT + " 0%," + BRAND + " 100%);"
             + "border-radius:12px 12px 0 0;padding:20px 28px;\">"
             + "<span style=\"font-family:" + FONT + ";font-size:17px;font-weight:700;"
             + "letter-spacing:1.5px;color:#ffffff;\">CAREER&#8209;9</span>"
             + "<span style=\"font-family:" + FONT + ";font-size:12px;color:#d1fae5;"
             + "padding-left:10px;\">Career Counselling</span>"
             + "</td></tr>"

             + "<tr><td style=\"background:" + CARD_BG + ";border:1px solid " + BORDER + ";"
             + "border-top:none;border-radius:0 0 12px 12px;padding:32px 28px;\">"
             + "<h1 style=\"margin:0 0 18px 0;font-family:" + FONT + ";font-size:21px;"
             + "line-height:1.35;font-weight:600;color:" + INK + ";\">" + esc(title) + "</h1>"
             + bodyHtml
             + "</td></tr>"

             + "<tr><td style=\"padding:18px 8px 4px 8px;font-family:" + FONT + ";font-size:11px;"
             + "line-height:1.7;color:" + MUTED + ";\">"
             + "This is an automated message from Career-9. Please do not reply to this address &mdash; "
             + "write to us through the portal if anything above looks wrong.<br>"
             + "&copy; Career-9. All rights reserved."
             + "</td></tr>"

             + "</table></td></tr></table></body></html>";
    }

    /** CounsellingEmailHtml.p */
    private static String p(String text) {
        return "<p style=\"margin:0 0 14px 0;font-family:" + FONT + ";font-size:15px;"
             + "line-height:1.65;color:" + INK + ";\">" + esc(text) + "</p>";
    }

    /** CounsellingEmailHtml.small */
    private static String small(String text) {
        return "<p style=\"margin:0 0 14px 0;font-family:" + FONT + ";font-size:13px;"
             + "line-height:1.6;color:" + MUTED + ";\">" + esc(text) + "</p>";
    }

    /** CounsellingEmailHtml.button */
    private static String button(String url, String label) {
        return "<a href=\"" + escAttr(url) + "\" style=\"display:inline-block;"
             + "background:" + BRAND + ";"
             + "background-image:linear-gradient(135deg," + BRAND_LIT + " 0%," + BRAND + " 100%);"
             + "color:#ffffff;font-family:" + FONT + ";font-size:15px;font-weight:700;"
             + "text-decoration:none;padding:14px 32px;border-radius:8px;\">" + esc(label) + "</a>";
    }

    /** CounsellingEmailHtml.signature */
    private static String signature() {
        return "<p style=\"margin:22px 0 0 0;font-family:" + FONT + ";font-size:15px;"
             + "line-height:1.6;color:" + INK + ";\">Regards,<br>"
             + "<strong style=\"color:" + BRAND + ";\">Career-9 Team</strong></p>";
    }

    /** CounsellingEmailHtml.joinBlock */
    private static String joinBlock(String url, String label, String note) {
        return actionBlock(url, label, "Join the session", note);
    }

    /** CounsellingEmailHtml.actionBlock — button plus "Or open this link" beneath it. */
    private static String actionBlock(String url, String label, String cta, String note) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td align=\"center\" style=\"background:" + TINT + ";border:1px solid " + TINT_EDGE + ";"
             + "border-radius:12px;padding:24px 18px;\">"
             + (label == null || label.isEmpty() ? ""
                : "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
                  + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";"
                  + "padding-bottom:14px;\">" + esc(label) + "</div>")
             + button(url, cta)
             + "<div style=\"font-family:" + FONT + ";font-size:12px;line-height:1.6;"
             + "color:" + MUTED + ";padding-top:14px;word-break:break-all;\">"
             + "Or open this link:<br><a href=\"" + escAttr(url) + "\" "
             + "style=\"color:" + BRAND + ";text-decoration:underline;\">" + esc(url) + "</a></div>"
             + (note == null || note.isEmpty() ? ""
                : "<div style=\"font-family:" + FONT + ";font-size:12px;color:" + MUTED + ";"
                  + "padding-top:10px;\">" + esc(note) + "</div>")
             + "</td></tr></table>";
    }

    /** CounsellingEmailHtml.venueBlock */
    private static String venueBlock(String venue) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td style=\"background:" + TINT + ";border:1px solid " + TINT_EDGE + ";"
             + "border-radius:12px;padding:20px 18px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";\">Venue</div>"
             + "<div style=\"font-family:" + FONT + ";font-size:16px;line-height:1.55;"
             + "font-weight:600;color:" + INK + ";padding-top:8px;\">" + esc(venue) + "</div>"
             + "</td></tr></table>";
    }

    /** CounsellingEmailHtml.pendingBlock */
    private static String pendingBlock(String label, String message) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td style=\"background:#fbfbfc;border:1px dashed " + BORDER + ";"
             + "border-radius:12px;padding:20px 18px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";\">"
             + esc(label) + "</div>"
             + "<div style=\"font-family:" + FONT + ";font-size:14px;line-height:1.55;"
             + "color:" + INK + ";padding-top:8px;\">" + esc(message) + "</div>"
             + "</td></tr></table>";
    }

    // ── Green-suite shell (CounsellingNotificationService.greenPage / greenDivider) ──

    /** CounsellingNotificationService#greenPage — neutral ground, wordmark, accent-lined card, footer. */
    private static String greenPage(String titleHtml, String bodyHtml) {
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
                + "<body style=\"margin:0;background:#f3f5f4;"
                + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                + "<div style=\"background:#f3f5f4;padding:40px 16px;\">"
                + "<div style=\"max-width:560px;margin:0 auto;\">"
                + "<div style=\"padding:0 6px 12px;\">"
                + "<span style=\"font-size:14px;font-weight:800;letter-spacing:2px;color:#059669;\">CAREER&#8209;9</span>"
                + "</div>"
                + "<div style=\"background:#ffffff;border:1px solid #e3e8e5;border-radius:14px;overflow:hidden;\">"
                + "<div style=\"height:4px;background:#059669;\"></div>"
                + "<div style=\"padding:32px 32px 8px;\">"
                + "<h1 style=\"margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#0f1f18;\">"
                +     titleHtml + "</h1>"
                + bodyHtml
                + "</div>"
                + "<div style=\"background:#f6f8f7;border-top:1px solid #e3e8e5;padding:14px 32px;\">"
                + "<p style=\"margin:0;font-size:11px;line-height:1.6;color:#8a978f;\">"
                +     "This is an automated message from Career&#8209;9 &mdash; please don&rsquo;t reply "
                +     "to this address.<br>&copy; Career&#8209;9. All rights reserved.</p>"
                + "</div>"
                + "</div></div></div></body></html>";
    }

    /** CounsellingNotificationService#greenDivider — labelled section divider. */
    private static String greenDivider(String labelHtml) {
        return "<div style=\"border-top:1px solid #e3e8e5;text-align:center;margin:0 0 20px;\">"
                + "<span style=\"position:relative;top:-9px;background:#ffffff;padding:0 12px;"
                +     "font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;\">"
                +     labelHtml + "</span>"
                + "</div>";
    }

    // ── Escaping (CounsellingEmailHtml.esc / escAttr) ───────────────────────

    /**
     * Applied to the fixed copy exactly as Java applies it; {@code {{placeholders}}} pass
     * through untouched and their values are escaped by the resolver at send time.
     */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String escAttr(String s) {
        return esc(s).replace("'", "&#39;");
    }
}
