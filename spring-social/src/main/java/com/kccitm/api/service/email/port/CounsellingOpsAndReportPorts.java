package com.kccitm.api.service.email.port;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;

/**
 * Counselling operations mails (booking confirmation, cancellations, shifts, check-in, absence,
 * disputes, counsellor deactivation) and the report-ready mails, lifted verbatim from
 * {@code CounsellingNotificationService}, {@code CounsellorReportNotificationService} and
 * {@code CounsellorReportReleaseService} so they appear in the admin catalogue.
 *
 * <p>Fidelity: copy is the ORIGINAL text. Dynamic Java expressions became
 * {@code {{placeholders}}}, branches became {@code {{#flag}}…{{/flag}}} /
 * {@code {{^flag}}…{{/flag}}} sections (nested where the Java nests them), and lists built in
 * a loop became one pre-rendered {@code *_html} block. Mails whose original was plain text
 * ({@code sendText}) carry the same text in both {@code body} and {@code text}.
 *
 * <p>Two shells are ported once and reused so every stored body is the complete HTML the
 * recipient receives: the branded {@code CounsellingEmailHtml.page} shell
 * ({@code service/counselling/CounsellingEmailHtml.java:67-120}, with its blocks) and the
 * green campaign-suite shell {@code CounsellingNotificationService#greenPage}
 * ({@code service/counselling/CounsellingNotificationService.java:2392-2432}).
 */
@Component
public class CounsellingOpsAndReportPorts implements PortedTemplateSource {

    private static final String SVC = "service/counselling/CounsellingNotificationService.java";
    private static final String REPORT_SVC = "service/counselling/CounsellorReportNotificationService.java";
    private static final String RELEASE_SVC = "service/counselling/CounsellorReportReleaseService.java";

    @Override
    public List<PortedTemplate> templates() {
        List<PortedTemplate> out = new ArrayList<>();
        out.add(bookingConfirmation());
        out.add(counsellorDailyDigest());
        out.add(bookingNudge());
        out.add(studentCancellationConfirmation());
        out.add(adminCancellationStudent());
        out.add(adminCancellationCounsellor());
        out.add(counsellorSwapped());
        out.add(sessionShifted());
        out.add(checkinCode());
        out.add(checkinPromptStudent());
        out.add(checkinPromptCounsellor());
        out.add(markedAbsent());
        out.add(disputeOutcome());
        out.add(counsellorDeactivated());
        out.add(counsellorDeactivatedStudent());
        out.add(counsellorDeactivatedAdminAlert());
        out.add(counsellorReportReady());
        out.add(bookedSessionReportReady());
        out.add(counsellorReportRelease());
        return out;
    }

    // ── Shared copy fragments (ported helpers of CounsellingNotificationService) ─────

    private static final String SIGN_OFF = "Regards,\nCareer-9 Team";

    /** #attendanceLine (SVC:1323-1334): "Venue: …" / "Join online: …" with the fallbacks. */
    private static final String ATTENDANCE_LINE =
            "{{#is_offline}}Venue: {{#has_venue}}{{venue}}{{/has_venue}}"
            + "{{^has_venue}}your counsellor will share the address shortly{{/has_venue}}{{/is_offline}}"
            + "{{^is_offline}}Join online: {{#has_meeting_link}}{{meeting_link}}{{/has_meeting_link}}"
            + "{{^has_meeting_link}}the meeting link will be shared before the session{{/has_meeting_link}}{{/is_offline}}";

    private static final String MODE_LABEL =
            "{{#is_offline}}In-person{{/is_offline}}{{^is_offline}}Online{{/is_offline}}";

    /** The "Assessment report" row value when there is no link (sessionDetailRows, SVC:922-930). */
    private static final String REPORT_PENDING_TEXT =
            "{{#is_report_held}}will be shared by your counsellor after the session{{/is_report_held}}"
            + "{{^is_report_held}}being prepared — we will email it as soon as it is ready{{/is_report_held}}";

    /** #nextStepLead (SVC:1990-1998). */
    private static final String NEXT_STEP_LEAD =
            "{{#has_free_changes}}Reschedule it yourself at no extra cost — open Counselling, go to "
            + "Past Sessions and press Reschedule to pick a new slot{{/has_free_changes}}"
            + "{{^has_free_changes}}You have no free changes left, so this session can no longer be moved. "
            + "You can book a new session here{{/has_free_changes}}";

    /** #nextStepCta (SVC:2000-2002). */
    private static final String NEXT_STEP_CTA =
            "{{#has_free_changes}}Reschedule my session{{/has_free_changes}}"
            + "{{^has_free_changes}}Book a session{{/has_free_changes}}";

    /** #nextStepLine (SVC:1980-1982): the lead plus the portal counselling URL. */
    private static final String NEXT_STEP_LINE = NEXT_STEP_LEAD + ":\n{{booking_link}}";

    /** "You have N free change(s) remaining." — the positive branch of the allowance line. */
    private static final String FREE_CHANGES_LEFT =
            "You have {{remaining_changes}} free change{{^is_single_change}}s{{/is_single_change}} remaining.";

    /**
     * #sessionDetailsBlock(appointment, true, false) → detailsText(sessionDetailRows(includeStudent,
     * mayShowReport=false, includeAttendance=true)) (SVC:842-935). Student line is always printed
     * here; the Java drops it only when the name resolved to the bare "Student" fallback.
     */
    private static final String BOOKING_DETAILS_TEXT =
            "  Student: {{student_name}}\n"
            + "{{#has_school}}  School: {{school_name}}\n{{/has_school}}"
            + "{{#has_assessment_name}}  Assessment: {{assessment_name}}\n{{/has_assessment_name}}"
            + "  Date: {{session_date}}\n"
            + "  Time: {{session_time}}\n"
            + "{{#has_duration}}  Duration: {{duration_minutes}} minutes\n{{/has_duration}}"
            + "  Mode: " + MODE_LABEL + "\n"
            + "  " + ATTENDANCE_LINE + "\n"
            + "  Assessment report: {{#has_report_link}}{{report_link}}{{/has_report_link}}"
            + "{{^has_report_link}}" + REPORT_PENDING_TEXT + "{{/has_report_link}}\n";

    /** #reportGuidance(appointment, forCounsellor=false) (SVC:741-757). */
    private static final String REPORT_GUIDANCE_STUDENT =
            "{{#is_report_held}}Your assessment report will be shared with you by your counsellor after "
            + "the session, so the results can be talked through rather than simply read.\n\n{{/is_report_held}}"
            + "{{^is_report_held}}{{#has_report_link}}Your assessment report is linked above. Please read it "
            + "before the session so you can bring any questions with you.\n\n{{/has_report_link}}"
            + "{{^has_report_link}}Your assessment report is not available yet. We will send it to you as "
            + "soon as it is ready.\n\n{{/has_report_link}}{{/is_report_held}}";

    // ── CounsellingNotificationService ─────────────────────────────────────────────

    /**
     * #sendConfirmationWithCalendar → bookingConfirmationHtml (green suite). One mail to the
     * student, the parent/guardian and the counsellor, with the .ics attached; the same
     * HTML + text is re-sent per address on the retry rounds.
     */
    private PortedTemplate bookingConfirmation() {
        String rows = greenDetailRow("Date", "{{session_date}}")
                + greenDetailRow("Time",
                        "{{session_time}}{{#has_end_time}} &ndash; {{session_end_time}}{{/has_end_time}}")
                + "{{#has_counsellor}}" + greenDetailRow("Counsellor", "{{counsellor_name}}") + "{{/has_counsellor}}"
                + greenDetailRow("Mode", MODE_LABEL)
                + "{{#is_offline}}" + greenDetailRow("Venue",
                        "{{#has_venue}}{{venue}}{{/has_venue}}"
                        + "{{^has_venue}}Your counsellor will share the address shortly.{{/has_venue}}")
                + "{{/is_offline}}";

        String joinPart = "{{^is_offline}}{{#has_meeting_link}}"
                + "<div style=\"text-align:center;margin:14px 0 4px;\">"
                + "<a href=\"{{meeting_link}}\" style=\"display:inline-block;padding:12px 32px;"
                +     "background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;"
                +     "font-weight:700;font-size:14.5px;\">Join your session</a>"
                + "</div>"
                + "<p style=\"text-align:center;margin:6px 0 0;font-size:12px;color:#8a978f;"
                +     "word-break:break-all;\">{{meeting_link}}</p>"
                + "{{/has_meeting_link}}{{^has_meeting_link}}"
                + "<p style=\"margin:12px 0 0;font-size:12.5px;line-height:1.6;color:#8a978f;\">"
                + "The meeting link will be shared with you before the session.</p>"
                + "{{/has_meeting_link}}{{/is_offline}}";

        String gcalPart = "{{#has_calendar_link}}"
                + "<div style=\"text-align:center;margin:0 0 8px;\">"
                + "<a href=\"{{calendar_link}}\" style=\"display:inline-block;padding:11px 28px;"
                +     "background:#ffffff;color:#059669;border:2px solid #059669;text-decoration:none;"
                +     "border-radius:8px;font-weight:700;font-size:13.5px;\">Add to Google Calendar</a>"
                + "</div>"
                + "{{/has_calendar_link}}";

        String html = greenPage("It&rsquo;s official! &#127881; Your counselling session is booked",

                "<p style=\"margin:0 0 6px;font-size:15px;line-height:1.6;color:#0f1f18;\">"
                +     "Hi {{student_name}} &#128075;</p>"
                + "<p style=\"margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#5f6f67;\">"
                +     "You&rsquo;ve taken an important step towards understanding your strengths, "
                +     "exploring possibilities, and getting clarity about your future. &#128640;</p>"

                + "<div style=\"background:#f6f8f7;border:1px solid #e3e8e5;border-radius:10px;"
                +     "padding:18px 20px;margin:0 0 18px;\">"
                + "<div style=\"font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;"
                +     "margin:0 0 10px;\">&#128197; YOUR SESSION DETAILS</div>"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;font-size:13.5px;\">"
                +     rows
                + "</table>"
                + joinPart
                + "</div>"

                + gcalPart
                + "<p style=\"text-align:center;margin:0 0 24px;font-size:12.5px;color:#8a978f;\">"
                +     "A calendar invite is also attached so you can add this to any calendar.</p>"

                + greenDivider("&#128161; COME CURIOUS. LEAVE CLEAR.")
                + "<p style=\"margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                +     "This is <strong>your</strong> session, so bring all your questions!</p>"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\""
                +     " style=\"margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4a44;\">"
                + "<tr><td style=\"width:28px;vertical-align:top;\">&#129300;</td>"
                +     "<td>&ldquo;Which career is right for me?&rdquo;</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#127919;</td>"
                +     "<td>&ldquo;What am I really good at?&rdquo;</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#128218;</td>"
                +     "<td>&ldquo;Which subjects should I choose?&rdquo;</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#128640;</td>"
                +     "<td>&ldquo;What options do I have after school or college?&rdquo;</td></tr>"
                + "</table>"
                + "<p style=\"margin:0 0 16px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                +     "Ask. Explore. Challenge. Discover.</p>"
                + "<p style=\"margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                +     "Your Career&#8209;9 report has the insights. Now, let&rsquo;s turn those insights "
                +     "into possibilities. &#128153;</p>"

                + "<p style=\"margin:0 0 4px;font-size:15px;line-height:1.6;color:#0f1f18;\">See you soon!</p>"
                + "<p style=\"margin:0 0 24px;font-size:15px;line-height:1.6;font-weight:700;color:#059669;\">"
                +     "Team Career&#8209;9</p>"
                + "<p style=\"margin:0 0 28px;font-size:12.5px;line-height:1.6;color:#8a978f;\">"
                +     "Need to make a change? Write to us before the session so we can put it right.</p>");

        String text = "Hi {{student_name}},\n\n"
                + "It's official! Your Career-9 counselling session is booked.\n\n"
                + "You've taken an important step towards understanding your strengths, exploring "
                + "possibilities, and getting clarity about your future.\n\n"
                + "Your Session Details:\n"
                + BOOKING_DETAILS_TEXT
                + "\n"
                + REPORT_GUIDANCE_STUDENT
                + "{{#has_calendar_link}}Add to Google Calendar: {{calendar_link}}\n\n{{/has_calendar_link}}"
                + "A calendar invite is also attached so you can add this to any calendar.\n\n"
                + "Come curious. Leave clear. This is your session, so bring all your questions:\n"
                + "  - \"Which career is right for me?\"\n"
                + "  - \"What am I really good at?\"\n"
                + "  - \"Which subjects should I choose?\"\n"
                + "  - \"What options do I have after school or college?\"\n\n"
                + "Ask. Explore. Challenge. Discover. Your Career-9 report has the insights - "
                + "now let's turn those insights into possibilities.\n\n"
                + "Need to make a change? Write to us before the session so we can put it right.\n\n"
                + "See you soon!\nTeam Career-9";

        return PortedTemplate.of("counselling.booking_confirmation", EmailType.COUNSELLING_BOOKING)
                .name("Counselling booking confirmation with calendar invite (from code)")
                .source("CounsellingNotificationService#sendConfirmationWithCalendar / bookingConfirmationHtml",
                        SVC + ":1088-1230, 2249-2432, 842-935, 741-757")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Counselling Session Confirmed")
                .body(html)
                .text(text)
                .variants("is_offline", "has_venue", "has_meeting_link", "has_counsellor", "has_end_time",
                        "has_calendar_link", "has_school", "has_assessment_name", "has_duration",
                        "has_report_link", "is_report_held")
                .build();
    }

    /** #sendCounsellorDailyDigest — plain text, 8pm day-before list to the counsellor. */
    private PortedTemplate counsellorDailyDigest() {
        String head = "Dear {{counsellor_name}},\n\n"
                + "Here are your counselling sessions scheduled for {{session_date}}:\n\n";
        String tail = "\nPlease be available on time.\n\n" + SIGN_OFF;
        String body = head
                + "<!-- one line per session: \"  1. 10:00 AM — Student Name (Online|In-person)\", newline-terminated -->"
                + "{{sessions_html}}" + tail;
        String text = head + "{{sessions_html}}" + tail;
        return PortedTemplate.of("counselling.counsellor_daily_digest", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counsellor daily digest (from code)")
                .source("CounsellingNotificationService#sendCounsellorDailyDigest", SVC + ":1341-1359")
                .mailClass(MailClass.INTERNAL)
                .subject("Your counselling sessions for {{session_date}} ({{session_count}})")
                .body(body)
                .text(text)
                .build();
    }

    /** #sendCounsellingBookingNudge — email fallback when the WhatsApp nudge is not sent. */
    private PortedTemplate bookingNudge() {
        String text = "Dear {{#has_name}}{{student_name}}{{/has_name}}{{^has_name}}there{{/has_name}},\n\n"
                + "You have {{remaining_sessions}} counselling session"
                + "{{^is_single_session}}s{{/is_single_session}}"
                + " included in your plan that "
                + "{{#is_single_session}}hasn't{{/is_single_session}}{{^is_single_session}}haven't{{/is_single_session}}"
                + " been booked yet.\n\n"
                + "Log in to Career-9 and pick a time that works for you to speak with a counsellor.\n\n"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.booking_nudge", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counselling booking nudge (from code)")
                .source("CounsellingNotificationService#sendCounsellingBookingNudge", SVC + ":1366-1396")
                .mailClass(MailClass.SUBSCRIBED)
                .subject("You have a counselling session waiting to be booked")
                .body(text)
                .text(text)
                .variants("has_name", "is_single_session")
                .build();
    }

    /** #sendStudentCancellationConfirmation — branded HTML + text, to student and parent with a cancelled .ics. */
    private PortedTemplate studentCancellationConfirmation() {
        String cancelled = "Your counselling session on {{session_date}} at {{session_time}}"
                + " has been cancelled as you requested.";
        String consequence = "{{#is_credited_back}}Your session has been returned to your account, so it costs "
                + "you nothing.{{/is_credited_back}}"
                + "{{^is_credited_back}}This was your last free change.{{/is_credited_back}}";
        String allowance = "{{#has_free_changes}}" + FREE_CHANGES_LEFT + "{{/has_free_changes}}"
                + "{{^has_free_changes}}You have no free changes remaining.{{/has_free_changes}}";

        String html = page(
                "Your session was cancelled — here is where you stand.",
                "Your counselling session has been cancelled",
                p("Dear {{student_name}},")
                + p(cancelled)
                + p(consequence + " " + allowance)
                + p(NEXT_STEP_LEAD + ".")
                + actionBlock("{{booking_link}}", "Your next step", NEXT_STEP_CTA, null)
                + signature());

        String text = "Dear {{student_name}},\n\n"
                + cancelled + "\n\n"
                + consequence + "\n"
                + allowance + "\n\n"
                + NEXT_STEP_LINE + "\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("counselling.student_cancellation_confirmation", EmailType.COUNSELLING_NOTIFICATION)
                .name("Student cancellation confirmation (from code)")
                .source("CounsellingNotificationService#sendStudentCancellationConfirmation",
                        SVC + ":1472-1512, 1965-2002")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session has been cancelled")
                .body(html)
                .text(text)
                .variants("is_credited_back", "has_free_changes", "is_single_change")
                .build();
    }

    /**
     * #sendAdminCancellationEmail — student/parent copy. Plain text, but sent through
     * sendWithCancelledInvite which wraps it in {@code <pre>} for the HTML part.
     */
    private PortedTemplate adminCancellationStudent() {
        String text = "Dear {{student_name}},\n\n"
                + "Your counselling session scheduled on {{session_date}} at {{session_time}}"
                + " has been cancelled by the Career-9 team.\n\n"
                + "This does not affect your counselling entitlement in any way — our team will "
                + "be in touch shortly to arrange a new time.\n\n"
                + "We apologise for the inconvenience.\n\n"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.admin_cancellation_student", EmailType.COUNSELLING_NOTIFICATION)
                .name("Admin cancellation — student/parent copy (from code)")
                .source("CounsellingNotificationService#sendAdminCancellationEmail", SVC + ":1533-1546, 2033-2036")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session has been cancelled")
                .body("<pre style=\"font-family:inherit\">" + text + "</pre>")
                .text(text)
                .build();
    }

    /** #sendAdminCancellationEmail — counsellor copy (withheld when a whole diary is cancelled). */
    private PortedTemplate adminCancellationCounsellor() {
        String text = "Dear {{counsellor_name}},\n\n"
                + "The counselling session with {{student_name}} on "
                + "{{session_date}} at {{session_time}} has been cancelled by the Career-9 team.\n\n"
                + "Nothing is recorded against you and your slot has been reopened. "
                + "The team will be in touch with the student to arrange a new time.\n\n"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.admin_cancellation_counsellor", EmailType.COUNSELLING_NOTIFICATION)
                .name("Admin cancellation — counsellor copy (from code)")
                .source("CounsellingNotificationService#sendAdminCancellationEmail", SVC + ":1548-1558")
                .mailClass(MailClass.INTERNAL)
                .subject("Your counselling session has been cancelled")
                .body(text)
                .text(text)
                .build();
    }

    /** #sendCounsellorSwappedEmail — plain text to student and parent. */
    private PortedTemplate counsellorSwapped() {
        String text = "Dear {{student_name}},\n\n"
                + "Your counselling session on {{session_date}} at {{session_time}}"
                + " is going ahead exactly as planned — the time has not changed.\n\n"
                + "A different counsellor will now be taking it, so please use the updated "
                + "{{#is_offline}}venue{{/is_offline}}{{^is_offline}}joining link{{/is_offline}}" + " below:\n"
                + "  " + ATTENDANCE_LINE + "\n\n"
                + "{{#is_offline}}Please note the venue has changed — do check it before you set out.\n\n{{/is_offline}}"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.counsellor_swapped", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counsellor swapped — updated details (from code)")
                .source("CounsellingNotificationService#sendCounsellorSwappedEmail", SVC + ":1571-1594, 1323-1334")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session is confirmed — updated details")
                .body(text)
                .text(text)
                .variants("is_offline", "has_venue", "has_meeting_link")
                .build();
    }

    /** #sendSessionShiftedEmail — branded HTML + text to student and parent. */
    private PortedTemplate sessionShifted() {
        String moved = "Your counsellor is no longer available at {{old_session_time}}"
                + ", so we have moved your session to {{session_time}} on {{session_date}}.";

        String html = page(
                "Your session has moved to {{session_time}} on {{session_date}}.",
                "Your counselling session has moved",
                p("Dear {{student_name}},")
                + p(moved)
                + attendanceBlockStudent()
                + p("If that new time does not suit you, you can pick another one.")
                + actionBlock("{{reschedule_link}}", "Prefer a different time?",
                        "Choose another time",
                        "Choosing your own time uses one of your free changes.")
                + small("We are sorry for the disruption.")
                + signature());

        String text = "Dear {{student_name}},\n\n"
                + moved + "\n\n"
                + "  " + ATTENDANCE_LINE + "\n\n"
                + "If that new time does not suit you, you can pick another one here — "
                + "choosing your own time uses one of your free changes:\n{{reschedule_link}}\n\n"
                + "We are sorry for the disruption.\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("counselling.session_shifted", EmailType.COUNSELLING_NOTIFICATION)
                .name("Session shifted to a later time (from code)")
                .source("CounsellingNotificationService#sendSessionShiftedEmail", SVC + ":1601-1640, 974-991")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session has moved to {{session_time}}")
                .body(html)
                .text(text)
                .variants("is_offline", "has_venue", "has_meeting_link")
                .build();
    }

    /** #sendCheckinCodeToStudent — the OTP block above the session details table. */
    private PortedTemplate checkinCode() {
        String html = page(
                "Your check-in code is {{checkin_code}}",
                "Your check-in code",
                p("Dear {{student_name}},")
                + p("Please read the code below out to your counsellor to start your "
                        + "counselling session.")
                + otpBlock("{{checkin_code}}", "Check-in code")
                + checkinDetailsTable()
                + small("This is the same 4-digit code printed on your Career-9 report. "
                        + "Please do not share it with anyone else — it is what records you "
                        + "as present for your sessions.")
                + signature());

        String text = "Dear {{student_name}},\n\n"
                + "Your check-in code for the counselling session is:\n\n"
                + "    {{checkin_code}}\n\n"
                + "Read this out to your counsellor to start the session. It is the same "
                + "4-digit code printed on your Career-9 report.\n\n"
                + "Please do not share it with anyone else — it is what records you as "
                + "present for your sessions.\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("counselling.checkin_code", EmailType.COUNSELLING_NOTIFICATION)
                .name("Check-in code to student (from code)")
                .source("CounsellingNotificationService#sendCheckinCodeToStudent", SVC + ":1690-1757, 870-935")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling check-in code")
                .body(html)
                .text(text)
                .variants("has_school", "has_assessment_name", "has_duration", "has_counsellor",
                        "is_offline", "has_report_link", "is_report_held")
                .build();
    }

    /** #sendCheckinPromptToStudent — ten minutes in with no check-in. */
    private PortedTemplate checkinPromptStudent() {
        String text = "Dear {{student_name}},\n\n"
                + "Your session has not been started yet. Please read out the 4-digit check-in "
                + "code from your Career-9 report so your counsellor can begin.\n\n"
                + "If nobody has joined, you do not need to do anything else — your session will "
                + "be preserved and we will send you a link to pick a new time.\n\n"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.checkin_prompt_student", EmailType.COUNSELLING_NOTIFICATION)
                .name("Check-in prompt to student (from code)")
                .source("CounsellingNotificationService#sendCheckinPromptToStudent", SVC + ":1768-1786")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session is waiting to start")
                .body(text)
                .text(text)
                .build();
    }

    /** #sendCheckinPromptToCounsellor — the matching warning to the counsellor. */
    private PortedTemplate checkinPromptCounsellor() {
        String text = "Dear {{counsellor_name}},\n\n"
                + "Your {{session_time}} session with {{student_name}}"
                + " has not been checked in.\n\n"
                + "Please either enter the student's check-in code, or mark the student absent "
                + "if they have not appeared.\n\n"
                + "If neither is recorded before the session ends, it will be logged as YOUR "
                + "no-show rather than the student's.\n\n"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.checkin_prompt_counsellor", EmailType.COUNSELLING_NOTIFICATION)
                .name("Check-in prompt to counsellor (from code)")
                .source("CounsellingNotificationService#sendCheckinPromptToCounsellor", SVC + ":1794-1826")
                .mailClass(MailClass.INTERNAL)
                .subject("Action needed: session with {{student_name}} not started")
                .body(text)
                .text(text)
                .build();
    }

    /** #sendMarkedAbsentEmail — branded HTML + text; the allowance line is omitted at zero. */
    private PortedTemplate markedAbsent() {
        String recorded = "Your counsellor has recorded that you did not attend your session on "
                + "{{session_date}} at {{session_time}}.";
        String dispute = "If you were present and believe this is a mistake, reply to this email or "
                + "raise it from your Career-9 dashboard — the session will be reviewed and "
                + "nothing will count against you until it is settled.";

        String html = page(
                "You were marked absent — here is what you can do next.",
                "You were marked absent",
                p("Dear {{student_name}},")
                + p(recorded)
                + "{{#has_free_changes}}" + p(FREE_CHANGES_LEFT) + "{{/has_free_changes}}"
                + p(NEXT_STEP_LEAD + ".")
                + actionBlock("{{booking_link}}", "Your next step", NEXT_STEP_CTA, null)
                + small(dispute)
                + signature());

        String text = "Dear {{student_name}},\n\n"
                + recorded + "\n\n"
                + "{{#has_free_changes}}" + FREE_CHANGES_LEFT + "\n\n{{/has_free_changes}}"
                + NEXT_STEP_LINE + "\n\n"
                + dispute + "\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("counselling.marked_absent", EmailType.COUNSELLING_NOTIFICATION)
                .name("Marked absent (from code)")
                .source("CounsellingNotificationService#sendMarkedAbsentEmail", SVC + ":1832-1895, 1965-2002")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("You were marked absent from your counselling session")
                .body(html)
                .text(text)
                .variants("has_free_changes", "is_single_change")
                .build();
    }

    /** #sendDisputeOutcomeEmail — subject and body both branch on whether the absence was upheld. */
    private PortedTemplate disputeOutcome() {
        String text = "Dear {{student_name}},\n\n"
                + "{{#is_upheld}}We have reviewed your session on {{session_date}} and the record that you did "
                + "not attend stands. It counts as one of your changes.{{/is_upheld}}"
                + "{{^is_upheld}}We have reviewed your session on {{session_date}} and corrected it — it is now "
                + "recorded as attended, and nothing has been counted against you.{{/is_upheld}}"
                + "{{#has_note}}\n\nNote from our team: {{dispute_note}}{{/has_note}}"
                + "\n\n" + SIGN_OFF;
        return PortedTemplate.of("counselling.dispute_outcome", EmailType.COUNSELLING_NOTIFICATION)
                .name("Attendance dispute outcome (from code)")
                .source("CounsellingNotificationService#sendDisputeOutcomeEmail", SVC + ":1938-1960")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("{{#is_upheld}}Your counselling attendance review — outcome{{/is_upheld}}"
                        + "{{^is_upheld}}Good news — your counselling session has been corrected{{/is_upheld}}")
                .body(text)
                .text(text)
                .variants("is_upheld", "has_note")
                .build();
    }

    /** #sendCounsellorDeactivatedEmail — the counsellor's single suspension notice. */
    private PortedTemplate counsellorDeactivated() {
        String text = "Dear {{counsellor_name}},\n\n"
                + "Your Career-9 counsellor account has been deactivated by the team. "
                + "You will not be able to sign in to the counsellor portal, and no new "
                + "sessions can be booked with you.\n\n"
                + "{{#has_affected_sessions}}Your {{sessions_affected}}"
                + "{{#is_single_session}} upcoming session has{{/is_single_session}}"
                + "{{^is_single_session}} upcoming sessions have{{/is_single_session}}"
                + " been taken off your calendar and the students have been contacted "
                + "directly. Nothing is recorded against you and no action is needed "
                + "from your side.\n\n{{/has_affected_sessions}}"
                + "{{^has_affected_sessions}}You had no upcoming sessions booked, so no student has been affected.\n\n{{/has_affected_sessions}}"
                + "If you believe this is a mistake, please contact the Career-9 team.\n\n"
                + SIGN_OFF;
        return PortedTemplate.of("counselling.counsellor_deactivated", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counsellor account deactivated (from code)")
                .source("CounsellingNotificationService#sendCounsellorDeactivatedEmail", SVC + ":2098-2122")
                .mailClass(MailClass.INTERNAL)
                .subject("Your Career-9 counsellor account has been deactivated")
                .body(text)
                .text(text)
                .variants("has_affected_sessions", "is_single_session")
                .build();
    }

    /** #sendCounsellorDeactivatedStudentEmail — branded HTML + text with a no-login rebooking link. */
    private PortedTemplate counsellorDeactivatedStudent() {
        String cancelled = "Your counselling session scheduled on {{session_date}} at {{session_time}}"
                + " has been cancelled by the Career-9 team, as your counsellor is no longer "
                + "available.";
        String reassurance = "This does not affect your counselling entitlement in any way. Another "
                + "counsellor is available, so you can choose a new time right away";
        String closing = "No login is needed — the link opens your booking page directly. If you "
                + "would rather we arranged it for you, simply reply to this email.";

        String html = page(
                "Your session was cancelled — choose a new time right away.",
                "Your counselling session has been cancelled",
                p("Dear {{student_name}},")
                + p(cancelled)
                + p(reassurance + ".")
                + actionBlock("{{reschedule_link}}", "Choose a new time", "Pick a new slot", "No login needed.")
                + small(closing)
                + small("We apologise for the inconvenience.")
                + signature());

        String text = "Dear {{student_name}},\n\n"
                + cancelled + "\n\n"
                + reassurance + ":\n\n"
                + "  {{reschedule_link}}\n\n"
                + closing + "\n\n"
                + "We apologise for the inconvenience.\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("counselling.counsellor_deactivated_student", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counsellor deactivated — student rebooking (from code)")
                .source("CounsellingNotificationService#sendCounsellorDeactivatedStudentEmail", SVC + ":2131-2172")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your counselling session has been cancelled — please pick a new time")
                .body(html)
                .text(text)
                .build();
    }

    /**
     * #sendCounsellorDeactivatedAdminAlert — the internal summary. Recipients are resolved under
     * COUNSELLOR_DEACTIVATED_ALERT (the send itself goes through the service's sendEmail helper).
     */
    private PortedTemplate counsellorDeactivatedAdminAlert() {
        String head = "A counsellor has been deactivated.\n\n"
                + "Counsellor: {{counsellor_name}}\n"
                + "Email: {{counsellor_email}}\n"
                + "Deactivated by: {{#has_admin_name}}{{admin_name}}{{/has_admin_name}}"
                + "{{^has_admin_name}}Career-9 admin{{/has_admin_name}}\n"
                + "Sessions affected: {{sessions_affected}}\n\n"
                + "{{#has_affected_sessions}}"
                + "The students below have had their session taken off the calendar.\n"
                + "Those marked REBOOKING LINK SENT can pick a new time themselves; those\n"
                + "marked NEEDS FOLLOW-UP have no other counsellor covering their assessment\n"
                + "and were told the team would be in touch — they need contacting.\n\n";
        String tail = "{{/has_affected_sessions}}"
                + "{{^has_affected_sessions}}No upcoming sessions were booked with this counsellor.\n\n{{/has_affected_sessions}}"
                + "Regards,\nCareer-9 System";
        String comment = "<!-- one block per affected student, each ending in a blank line: "
                + "\"  • Name\" / \"      When:    date time\" / \"      Contact: email · phone\" / "
                + "\"      Outcome: REBOOKING LINK SENT | NEEDS FOLLOW-UP | COULD NOT BE SETTLED — CHECK MANUALLY\" -->";
        String body = head + comment + "{{affected_students_html}}" + tail;
        String text = head + "{{affected_students_html}}" + tail;

        return PortedTemplate.of("counselling.counsellor_deactivated_admin_alert", EmailType.COUNSELLOR_DEACTIVATED_ALERT)
                .name("Counsellor deactivated — admin alert (from code)")
                .source("CounsellingNotificationService#sendCounsellorDeactivatedAdminAlert", SVC + ":2180-2241")
                .mailClass(MailClass.INTERNAL)
                .subject("Counsellor deactivated: {{counsellor_name}} — {{sessions_affected}}"
                        + "{{#is_single_session}} session affected{{/is_single_session}}"
                        + "{{^is_single_session}} sessions affected{{/is_single_session}}")
                .body(body)
                .text(text)
                .variants("has_admin_name", "has_affected_sessions", "is_single_session")
                .build();
    }

    // ── CounsellorReportNotificationService / CounsellorReportReleaseService ────────

    /** #notifyAppointedCounsellors — "a student you counsel for has finished". */
    private PortedTemplate counsellorReportReady() {
        String lead = "{{student_name}} has completed {{assessment_name}}, and the report is ready.";
        String closing = "Please look through it before your session so you can go straight to "
                + "what matters.";

        String html = page(
                "{{student_name}}'s report is ready to read before the session.",
                "Report ready — {{student_name}}",
                p("Hello,")
                + p(lead)
                + actionBlock("{{report_link}}", "Assessment report", "Open report", null)
                + small(closing)
                + signature());

        String text = "Hello,\n\n"
                + lead + "\n\n"
                + "  Report: {{report_link}}\n\n"
                + closing + "\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("report.counsellor_report_ready", EmailType.REPORT_READY)
                .name("Report ready — counsellor copy (from code)")
                .source("CounsellorReportNotificationService#notifyAppointedCounsellors", REPORT_SVC + ":197-244")
                .mailClass(MailClass.INTERNAL)
                .subject("Report ready — {{student_name}}")
                .body(html)
                .text(text)
                .build();
    }

    /** #notifyBookedSessions — same mail to the student, parent and counsellor of a booked session. */
    private PortedTemplate bookedSessionReportReady() {
        String lead = "The assessment report for {{student_name}}"
                + " is now ready, ahead of the counselling session"
                + "{{#has_session_datetime}} on {{session_datetime}}{{/has_session_datetime}}.";
        String closing = "Please read it before the session so the time can be spent on "
                + "what matters most.";

        String html = page(
                "The report is ready ahead of the counselling session.",
                "Assessment report ready",
                p("Hello,")
                + p(lead)
                + actionBlock("{{report_link}}", "Assessment report", "Open report", null)
                + small(closing)
                + signature());

        String text = "Hello,\n\n"
                + lead + "\n\n"
                + "  Report: {{report_link}}\n\n"
                + closing + "\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("report.booked_session_report_ready", EmailType.REPORT_READY)
                .name("Report ready for booked session (from code)")
                .source("CounsellorReportNotificationService#notifyBookedSessions", REPORT_SVC + ":254-307, 336-346")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Assessment report ready for your counselling session")
                .body(html)
                .text(text)
                .variants("has_session_datetime")
                .build();
    }

    /** CounsellorReportReleaseService#releaseToStudent — the counsellor's "Send report" button. */
    private PortedTemplate counsellorReportRelease() {
        String lead = "Your assessment report has been released"
                + "{{#has_counsellor_name}} by {{counsellor_name}}{{/has_counsellor_name}}"
                + " following your counselling session.";
        String closing = "Take your time with it, and do come back to your counsellor with anything "
                + "you would like explained further.";

        String html = page(
                "Your assessment report has been released.",
                "Your assessment report is ready",
                p("Dear {{student_name}},")
                + p(lead)
                + actionBlock("{{report_link}}", "Your report", "Open my report", null)
                + small(closing)
                + signature());

        String text = "Dear {{student_name}},\n\n"
                + lead + "\n\n"
                + "  Report: {{report_link}}\n\n"
                + closing + "\n\n"
                + SIGN_OFF;

        return PortedTemplate.of("report.counsellor_release", EmailType.REPORT_READY)
                .name("Report released by counsellor (from code)")
                .source("CounsellorReportReleaseService#releaseToStudent", RELEASE_SVC + ":89-122")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your assessment report is ready")
                .body(html)
                .text(text)
                .variants("has_counsellor_name")
                .build();
    }

    // ── Composite blocks built from the ported helpers ──────────────────────────────

    /** #attendanceBlock(appointment, forCounsellor=false) (SVC:974-991). */
    private static String attendanceBlockStudent() {
        return "{{#is_offline}}{{#has_venue}}" + venueBlock("{{venue}}") + "{{/has_venue}}"
             + "{{^has_venue}}" + pendingBlock("Venue", "Your counsellor will share the address shortly.") + "{{/has_venue}}"
             + "{{/is_offline}}"
             + "{{^is_offline}}{{#has_meeting_link}}"
             + joinBlock("{{meeting_link}}", "Online session — meeting link",
                     "Please join a few minutes before the start time.")
             + "{{/has_meeting_link}}"
             + "{{^has_meeting_link}}"
             + pendingBlock("Meeting link", "The meeting link will be shared with you before the session.")
             + "{{/has_meeting_link}}{{/is_offline}}";
    }

    /**
     * CounsellingEmailHtml.detailsTable(sessionDetailRows(appointment, false, false, false))
     * (SVC:870-935, CounsellingEmailHtml.java:293-327). The first rendered row carries no top
     * border, and which row is first depends on the optional School / Assessment rows.
     */
    private static String checkinDetailsTable() {
        String afterSchool = "{{#has_school}}" + ROW_TOP + "{{/has_school}}";
        String afterSchoolOrAssessment = "{{#has_school}}" + ROW_TOP + "{{/has_school}}"
                + "{{^has_school}}{{#has_assessment_name}}" + ROW_TOP + "{{/has_assessment_name}}{{/has_school}}";
        return detailsTableOpen()
             + "{{#has_school}}" + detailRow("", "School", "{{school_name}}") + "{{/has_school}}"
             + "{{#has_assessment_name}}" + detailRow(afterSchool, "Assessment", "{{assessment_name}}") + "{{/has_assessment_name}}"
             + detailRow(afterSchoolOrAssessment, "Date", "{{session_date}}")
             + detailRow(ROW_TOP, "Time", "{{session_time}}")
             + "{{#has_duration}}" + detailRow(ROW_TOP, "Duration", "{{duration_minutes}} minutes") + "{{/has_duration}}"
             + "{{#has_counsellor}}" + detailRow(ROW_TOP, "Counsellor", "{{counsellor_name}}") + "{{/has_counsellor}}"
             + detailRow(ROW_TOP, "Mode", MODE_LABEL)
             + detailRow(ROW_TOP, "Assessment report",
                     "{{#has_report_link}}" + detailLink("{{report_link}}", "Open report") + "{{/has_report_link}}"
                     + "{{^has_report_link}}" + REPORT_PENDING_TEXT + "{{/has_report_link}}")
             + detailsTableClose();
    }

    // ── Shell 1: CounsellingEmailHtml (service/counselling/CounsellingEmailHtml.java) ─

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
    private static final String ROW_TOP = "border-top:1px solid " + BORDER + ";";

    /** CounsellingEmailHtml#page: masthead, white card, footer. */
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

    /** CounsellingEmailHtml#p. */
    private static String p(String text) {
        return "<p style=\"margin:0 0 14px 0;font-family:" + FONT + ";font-size:15px;"
             + "line-height:1.65;color:" + INK + ";\">" + esc(text) + "</p>";
    }

    /** CounsellingEmailHtml#small. */
    private static String small(String text) {
        return "<p style=\"margin:0 0 14px 0;font-family:" + FONT + ";font-size:13px;"
             + "line-height:1.6;color:" + MUTED + ";\">" + esc(text) + "</p>";
    }

    /** CounsellingEmailHtml#button. */
    private static String button(String url, String label) {
        return "<a href=\"" + escAttr(url) + "\" style=\"display:inline-block;"
             + "background:" + BRAND + ";"
             + "background-image:linear-gradient(135deg," + BRAND_LIT + " 0%," + BRAND + " 100%);"
             + "color:#ffffff;font-family:" + FONT + ";font-size:15px;font-weight:700;"
             + "text-decoration:none;padding:14px 32px;border-radius:8px;\">" + esc(label) + "</a>";
    }

    /** CounsellingEmailHtml#signature. */
    private static String signature() {
        return "<p style=\"margin:22px 0 0 0;font-family:" + FONT + ";font-size:15px;"
             + "line-height:1.6;color:" + INK + ";\">Regards,<br>"
             + "<strong style=\"color:" + BRAND + ";\">Career-9 Team</strong></p>";
    }

    /** CounsellingEmailHtml#otpBlock. */
    private static String otpBlock(String code, String caption) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td align=\"center\" style=\"background:" + TINT + ";border:1px dashed " + TINT_EDGE + ";"
             + "border-radius:12px;padding:24px 16px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";\">"
             + esc(caption) + "</div>"
             + "<div style=\"font-family:'SFMono-Regular',Consolas,'Courier New',monospace;"
             + "font-size:40px;line-height:1.2;font-weight:700;letter-spacing:12px;"
             + "color:" + BRAND + ";padding:12px 0 4px 12px;\">" + esc(code) + "</div>"
             + "</td></tr></table>";
    }

    /** CounsellingEmailHtml#joinBlock. */
    private static String joinBlock(String url, String label, String note) {
        return actionBlock(url, label, "Join the session", note);
    }

    /** CounsellingEmailHtml#actionBlock: button, "Or open this link", optional note. */
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

    /** CounsellingEmailHtml#venueBlock. */
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

    /** CounsellingEmailHtml#pendingBlock. */
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

    /** CounsellingEmailHtml#detailsTable — the opening tag. */
    private static String detailsTableOpen() {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:4px 0 18px 0;border:1px solid " + BORDER + ";border-radius:10px;\">";
    }

    private static String detailsTableClose() {
        return "</table>";
    }

    /**
     * One row of CounsellingEmailHtml#detailsTable. {@code top} is the border-top style of every
     * row but the first; {@code valueHtml} is the cell content, already markup-safe.
     */
    private static String detailRow(String top, String label, String valueHtml) {
        return "<tr>"
             + "<td width=\"34%\" style=\"" + top
             + "padding:11px 14px;font-family:" + FONT
             + ";font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;"
             + "color:" + MUTED + ";vertical-align:top;\">"
             + esc(label) + "</td>"
             + "<td style=\"" + top
             + "padding:11px 14px;font-family:" + FONT
             + ";font-size:14px;line-height:1.55;color:" + INK
             + ";vertical-align:top;word-break:break-word;\">"
             + valueHtml
             + "</td></tr>";
    }

    /** The linked value of a detailsTable row (a Row with an href and display text). */
    private static String detailLink(String href, String text) {
        return "<a href=\"" + escAttr(href) + "\" style=\"color:" + BRAND
             + ";text-decoration:underline;\">" + esc(text) + "</a>";
    }

    /** CounsellingEmailHtml#esc — a no-op on the literal copy here; kept so the shell reads as the original. */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    /** CounsellingEmailHtml#escAttr. */
    private static String escAttr(String s) {
        return esc(s).replace("'", "&#39;");
    }

    // ── Shell 2: the green campaign suite (CounsellingNotificationService:2392-2432) ──

    /** CounsellingNotificationService#greenPage: neutral ground, wordmark, accent-lined card, footer. */
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

    /** CounsellingNotificationService#greenDivider. */
    private static String greenDivider(String labelHtml) {
        return "<div style=\"border-top:1px solid #e3e8e5;text-align:center;margin:0 0 20px;\">"
                + "<span style=\"position:relative;top:-9px;background:#ffffff;padding:0 12px;"
                +     "font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;\">"
                +     labelHtml + "</span>"
                + "</div>";
    }

    /** CounsellingNotificationService#greenDetailRow (value is pre-escaped HTML). */
    private static String greenDetailRow(String label, String valueHtml) {
        return "<tr><td style=\"padding:4px 0;color:#5f6f67;width:110px;vertical-align:top;\">" + label + "</td>"
                + "<td style=\"padding:4px 0;color:#0f1f18;font-weight:700;\">" + valueHtml + "</td></tr>";
    }
}
