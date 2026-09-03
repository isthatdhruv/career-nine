package com.kccitm.api.service.email.port;

import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;
import com.kccitm.api.model.email.SeedOrigin;

/**
 * Ports of the school-facing, report and reminder mails that were built inline in Java
 * (ContactPersonController, PrincipalDashboardNotificationService, ReportEmailComposer)
 * plus the four legacy {@code reminder_config} seed rows.
 *
 * <p>Copy is verbatim. Dynamic values are {@code {{placeholders}}}, Java branches are
 * {@code {{#flag}}…{{/flag}}} / {@code {{^flag}}…{{/flag}}} sections, and Java loops are a
 * single pre-rendered {@code *_html} block described by the HTML comment just before it.
 *
 * <p>Not ported on purpose: {@code ContactPersonController#sendReportEmail}
 * (controller/ContactPersonController.java:548-598) — the admin types the subject and HTML
 * into the request body, so there is no fixed copy to lift.
 */
@Component
public class SchoolReportAndReminderPorts implements PortedTemplateSource {

    @Override
    public List<PortedTemplate> templates() {
        return Arrays.asList(
                studentsAssigned(),
                contactPersonReportZip(),
                schoolDashboardReady(),
                reportReady(),
                reminderAssessmentInviteB2c(),
                reminderCounselling24h(),
                reminderCounselling1h(),
                reminderAssessmentMapping());
    }

    // ── ContactPersonController ───────────────────────────────────────────────

    /**
     * Sent to a contact person when an admin assigns students to them. The Java defaults
     * contact_person_name to "Contact Person" and school_name to "your school" when missing.
     */
    private static PortedTemplate studentsAssigned() {
        return PortedTemplate.of("school.students_assigned", EmailType.GENERIC)
                .name("Students assigned to contact person (from code)")
                .source("ContactPersonController#assignStudents",
                        "controller/ContactPersonController.java:359-386")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Students Assigned to You – {{school_name}}")
                .body("<p>Dear {{contact_person_name}},</p>"
                        + "<p>The following {{student_count}} student(s) from <strong>{{school_name}}</strong>"
                        + " have been assigned to you as their admin:</p>"
                        + "<!-- students_html: a <ul> with one <li>student name</li> per assigned student"
                        + " (\"Student #<id>\" when the name is unknown) -->"
                        + "{{students_html}}"
                        + "<p>You can now contact these students and send them emails through the Odoo service.</p>"
                        + "<p>This is an automated notification from Career-9.</p>")
                .build();
    }

    /**
     * The report-ZIP mail. Both {@code #sendReportsToContactPerson} (lines 741-757) and
     * {@code #sendReportsByInstitute} (lines 1058-1072) build the same subject and render
     * through {@code #buildReportEmailHtml}, so this is one template. The ZIP attachment is
     * added by the caller. report_type is "Navigator" or "BET"; report_count is the number
     * of reports actually downloaded into the ZIP.
     */
    private static PortedTemplate contactPersonReportZip() {
        return PortedTemplate.of("report.contact_person_zip", EmailType.CONTACT_PERSON_REPORT)
                .name("Student reports ZIP to contact person (from code)")
                .source("ContactPersonController#buildReportEmailHtml",
                        "controller/ContactPersonController.java:1095-1207")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("{{report_type}} Reports | {{assessment_name}} | {{school_name}} – Career-9")
                .body("<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
                        + "<body style='margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;'>"
                        + "<table width='100%' cellpadding='0' cellspacing='0' style='background-color:#f4f6f9;padding:32px 0;'>"
                        + "<tr><td align='center'>"
                        + "<table width='600' cellpadding='0' cellspacing='0' style='background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);'>"
                        + "<tr><td style='background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px 40px;text-align:center;'>"
                        + "<h1 style='margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;'>Career-9</h1>"
                        + "<p style='margin:6px 0 0;color:#a8b5cc;font-size:13px;'>Ensuring Career Success</p>"
                        + "</td></tr>"
                        + "<tr><td style='padding:36px 40px;'>"
                        + "<p style='margin:0 0 20px;font-size:16px;color:#1a1a2e;'>Dear <strong>{{contact_person_name}}</strong>,</p>"
                        + "<p style='margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;'>Greetings from Career-9!</p>"
                        + "<div style='background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px;'>"
                        + "<p style='margin:0 0 12px;font-size:14px;color:#6b7280;'>Report Details</p>"
                        + "<table cellpadding='4' cellspacing='0' style='font-size:14px;color:#1a1a2e;'>"
                        + "<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>School / Institute:</td><td style='font-weight:600;'>{{school_name}}</td></tr>"
                        + "<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>Assessment:</td><td style='font-weight:600;'>{{assessment_name}}</td></tr>"
                        + "<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>Report Type:</td><td style='font-weight:600;'>{{report_type}}</td></tr>"
                        + "<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>Reports Included:</td><td style='font-weight:600;'>{{report_count}} student(s)</td></tr>"
                        + "</table>"
                        + "</div>"
                        + "<p style='margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;'>"
                        + "Please find the <strong>{{report_type}}</strong> assessment reports attached as a ZIP file. "
                        + "You can download and extract the ZIP to access individual student reports."
                        + "</p>"
                        + "<div style='margin-bottom:24px;'>"
                        + "<p style='margin:0 0 8px;font-size:14px;font-weight:700;color:#1a1a2e;'>Students Included:</p>"
                        + "<table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;'>"
                        + "<tr style='background:#f1f5f9;'><th style='padding:8px 14px;text-align:left;color:#374151;border-bottom:1px solid #e5e7eb;'>#</th>"
                        + "<th style='padding:8px 14px;text-align:left;color:#374151;border-bottom:1px solid #e5e7eb;'>Student Name</th></tr>"
                        + "<!-- students_html: one row per student whose report is in the ZIP, numbered from 1, rows alternating"
                        + " background #ffffff / #f9fafb: <tr style='background:#ffffff;'>"
                        + "<td style='padding:6px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;'>1</td>"
                        + "<td style='padding:6px 14px;border-bottom:1px solid #f0f0f0;color:#1a1a2e;font-weight:500;'>Student Name</td></tr> -->"
                        + "{{students_html}}"
                        + "</table>"
                        + "</div>"
                        + "{{#has_failed_downloads}}"
                        + "<p style='margin:0 0 8px;font-size:13px;color:#d97706;background:#fffbeb;padding:10px 14px;border-radius:6px;border:1px solid #fde68a;'>"
                        + "Note: Could not download reports for: {{failed_students}}"
                        + "</p>"
                        + "{{/has_failed_downloads}}"
                        + "{{#has_missing_reports}}"
                        + "<p style='margin:0 0 8px;font-size:13px;color:#6b7280;background:#f9fafb;padding:10px 14px;border-radius:6px;border:1px solid #e5e7eb;'>"
                        + "{{missing_report_count}} student(s) do not have a generated report yet and are not included."
                        + "</p>"
                        + "{{/has_missing_reports}}"
                        + "<hr style='border:none;border-top:1px solid #e5e7eb;margin:28px 0;'>"
                        + "<p style='margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;'>"
                        + "For any queries or assistance, feel free to reach us:"
                        + "</p>"
                        + "<table cellpadding='2' cellspacing='0' style='font-size:14px;color:#374151;'>"
                        + "<tr><td style='padding:2px 12px 2px 0;color:#6b7280;'>Email:</td>"
                        + "<td><a href='mailto:support@career-9.com' style='color:#4361ee;text-decoration:none;font-weight:500;'>support@career-9.com</a></td></tr>"
                        + "<tr><td style='padding:2px 12px 2px 0;color:#6b7280;'>Phone:</td>"
                        + "<td style='font-weight:500;'>+91 70000 70256</td></tr>"
                        + "</table>"
                        + "<div style='margin-top:28px;'>"
                        + "<p style='margin:0 0 4px;font-size:14px;color:#374151;'>Warm Regards,</p>"
                        + "<p style='margin:0 0 2px;font-size:15px;font-weight:700;color:#1a1a2e;'>Career-9 Team</p>"
                        + "<p style='margin:0;font-size:13px;color:#6b7280;font-style:italic;'>Ensuring Career Success</p>"
                        + "</div>"
                        + "</td></tr>"
                        + "<tr><td style='background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;'>"
                        + "<p style='margin:0 0 4px;font-size:12px;color:#9ca3af;'>This is an automated email from Career-9.</p>"
                        + "<p style='margin:0;font-size:12px;color:#9ca3af;'>Please do not reply directly to this email.</p>"
                        + "</td></tr>"
                        + "</table>"
                        + "</td></tr></table>"
                        + "</body></html>")
                .variants("has_failed_downloads", "has_missing_reports")
                .build();
    }

    // ── PrincipalDashboardNotificationService ────────────────────────────────

    /**
     * Sent by hand after a school's principal dashboard is released. dashboard_link is
     * {@code ${app.frontend.url}/school-dashboard}. Names are HTML-escaped in the Java.
     */
    private static PortedTemplate schoolDashboardReady() {
        return PortedTemplate.of("school.dashboard_ready", EmailType.SCHOOL_DASHBOARD_READY)
                .name("School dashboard released (from code)")
                .source("PrincipalDashboardNotificationService#body (subject in #notify)",
                        "service/dashboard/principal/PrincipalDashboardNotificationService.java:115-211")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 school dashboard is ready — {{school_name}}")
                .body("<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;"
                        + "line-height:1.6;color:#0d1b2e;max-width:600px\">"
                        + "<p>{{#has_contact_person_name}}Dear {{contact_person_name}},{{/has_contact_person_name}}"
                        + "{{^has_contact_person_name}}Hello,{{/has_contact_person_name}}</p>"
                        + "<p>The Career-9 school dashboard for <b>{{school_name}}</b> is now live. It summarises what "
                        + "{{#has_assessment_name}}{{assessment_name}}{{/has_assessment_name}}"
                        + "{{^has_assessment_name}}the assessment{{/has_assessment_name}}"
                        + " found across your students — where they are heading, where they will "
                        + "need support, and what the school can do about it.</p>"
                        + "<p style=\"margin:24px 0\">"
                        + "<a href=\"{{dashboard_link}}\" "
                        + "style=\"background:#1c5cab;color:#ffffff;text-decoration:none;"
                        + "padding:12px 22px;border-radius:8px;display:inline-block;font-weight:bold\">"
                        + "Open your dashboard</a></p>"
                        + "<h3 style=\"font-size:15px;margin:22px 0 6px\">How to use it</h3>"
                        + "<ol style=\"padding-left:20px;margin:0\">"
                        + "<li style=\"margin-bottom:6px\">Sign in to Career-9 with the account we set "
                        + "up for you, then choose <b>Reports &rarr; School Dashboard</b> from the menu "
                        + "on the left.</li>"
                        + "<li style=\"margin-bottom:6px\">The page opens on the whole school. The "
                        + "filters at the top narrow it to a single grade, section or group — figures "
                        + "and written analysis both change to match.</li>"
                        + "<li style=\"margin-bottom:6px\">Start with the statement at the top and the "
                        + "three cards under it: those are the findings we think need action first.</li>"
                        + "<li style=\"margin-bottom:6px\">Below them, <b>the full analysis</b> explains "
                        + "each finding in detail, with the figures it is based on.</li>"
                        + "</ol>"
                        + "<h3 style=\"font-size:15px;margin:22px 0 6px\">A note on the numbers</h3>"
                        + "<p style=\"margin:0\">Every figure is drawn from students who completed and "
                        + "were scored on the assessment, and each section states the group it is "
                        + "counting. Cohorts too small to describe safely are left without written "
                        + "analysis on purpose &mdash; percentages over a handful of students say more "
                        + "about the handful than about the group.</p>"
                        + "<h3 style=\"font-size:15px;margin:22px 0 6px\">If something looks wrong</h3>"
                        + "<p style=\"margin:0\">If a figure looks off, a class is missing, or the page "
                        + "will not open, reply to this email and the Career-9 team will look into it. "
                        + "Please mention the school name and which grade or section you were "
                        + "viewing.</p>"
                        + "<p style=\"margin-top:26px\">Warm regards,<br><b>The Career-9 Team</b></p>"
                        + "</div>")
                .variants("has_contact_person_name", "has_assessment_name")
                .build();
    }

    // ── ReportEmailComposer (report worker) ──────────────────────────────────

    /**
     * The report-worker "your report is ready" mail. GmailReportEmailSender renders this
     * composer whenever no REPORT_READY template is configured (its classpath fallback only
     * changes the transport and From name, not the copy). The Java shows the school name when
     * whitelabelled and "Career&#8209;9" otherwise; per the port convention that pair is
     * {{school_name}} (the Java greets "there" when student_name is blank).
     */
    private static PortedTemplate reportReady() {
        return PortedTemplate.of("report.ready", EmailType.REPORT_READY)
                .name("Report ready with counselling next step (from code)")
                .source("ReportEmailComposer#subject / #html",
                        "service/b2c/report/pipeline/ReportEmailComposer.java:24-131")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your {{school_name}} report is ready")
                .body("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
                        + "<body style=\"margin:0;background:#f3f5f4;"
                        + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                        + "<div style=\"max-width:600px;margin:0 auto;background:#ffffff;\">"
                        + "{{email_header}}"
                        + "<div style=\"padding:28px 32px 8px;\">"

                        + "<h2 style=\"margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#0f1f18;\">"
                        + "&#127881; Your Career Assessment is complete!</h2>"
                        + "<p style=\"margin:0 0 18px;font-size:15px;line-height:1.6;color:#5f6f67;\">"
                        + "Hi {{student_name}}, now comes the exciting part&hellip;</p>"

                        + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\""
                        + " style=\"margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#0f1f18;\">"
                        + "<tr><td style=\"width:28px;vertical-align:top;\">&#128269;</td>"
                        + "<td>What does your report say about <strong>YOU</strong>?</td></tr>"
                        + "<tr><td style=\"vertical-align:top;\">&#128161;</td>"
                        + "<td>What are your natural strengths?</td></tr>"
                        + "<tr><td style=\"vertical-align:top;\">&#127919;</td>"
                        + "<td>Which careers could actually match your personality and abilities?</td></tr>"
                        + "<tr><td style=\"vertical-align:top;\">&#128640;</td>"
                        + "<td>What could you work on to get closer to your goals?</td></tr>"
                        + "</table>"

                        + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.65;color:#0f1f18;\">"
                        + "Your personalized <strong>{{school_name}} Report</strong> is ready &mdash; filled with "
                        + "insights about your strengths, interests, abilities, and career possibilities.</p>"

                        + "<div style=\"text-align:center;margin:0 0 10px;\">"
                        + "<a href=\"{{report_link}}\" style=\"display:inline-block;padding:14px 36px;"
                        + "background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;"
                        + "font-weight:700;font-size:15px;\">View my report &rarr;</a>"
                        + "</div>"
                        + "{{#has_pdf_link}}"
                        + "<p style=\"text-align:center;margin:0 0 6px;font-size:13px;\">"
                        + "<a href=\"{{report_pdf_link}}\" style=\"color:#059669;font-weight:700;text-decoration:none;\">"
                        + "Download as PDF</a></p>"
                        + "{{/has_pdf_link}}"
                        + "{{#is_link_only}}"
                        + "<p style=\"text-align:center;margin:0 0 24px;color:#8a978f;font-size:12.5px;\">"
                        + "Open your full report using the button above.</p>"
                        + "{{/is_link_only}}"
                        + "{{^is_link_only}}"
                        + "<p style=\"text-align:center;margin:0 0 24px;color:#8a978f;font-size:12.5px;\">"
                        + "Your detailed report is also attached to this email as a PDF.</p>"
                        + "{{/is_link_only}}"

                        + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.6;color:#0f1f18;\">"
                        + "But remember, the report is just the beginning! &#127775;</p>"

                        + "{{#has_booking_link}}"
                        + "<div style=\"border-top:1px solid #e3e8e5;text-align:center;margin:0 0 20px;\">"
                        + "<span style=\"position:relative;top:-9px;background:#ffffff;padding:0 12px;"
                        + "font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;\">"
                        + "&#128640; YOUR NEXT STEP</span>"
                        + "</div>"
                        + "<p style=\"margin:0 0 16px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                        + "Now it&rsquo;s time to understand what these insights really mean for your future. "
                        + "Get your report interpreted by subject-matter experts in a <strong>1:1 online session</strong> "
                        + "and understand your results:</p>"
                        + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\""
                        + " style=\"margin:0 0 20px;font-size:14px;line-height:1.7;color:#3d4a44;\">"
                        + "<tr><td style=\"width:26px;vertical-align:top;\">&#10024;</td>"
                        + "<td>Explore career options that fit <strong>YOU</strong></td></tr>"
                        + "<tr><td style=\"vertical-align:top;\">&#10024;</td>"
                        + "<td>Discover your strengths &amp; improvement areas</td></tr>"
                        + "<tr><td style=\"vertical-align:top;\">&#10024;</td>"
                        + "<td>Get clarity on your next academic step</td></tr>"
                        + "<tr><td style=\"vertical-align:top;\">&#10024;</td>"
                        + "<td>Ask anything about your future &mdash; no question is too small!</td></tr>"
                        + "</table>"
                        + "<div style=\"text-align:center;margin:0 0 24px;\">"
                        + "<a href=\"{{booking_link}}\" style=\"display:inline-block;padding:13px 32px;"
                        + "background:#ffffff;color:#059669;border:2px solid #059669;text-decoration:none;"
                        + "border-radius:8px;font-weight:700;font-size:14.5px;\">Book my counselling session</a>"
                        + "</div>"
                        + "{{/has_booking_link}}"

                        + "<p style=\"margin:0 0 28px;font-size:14px;line-height:1.65;color:#5f6f67;\">"
                        + "Your future is not a guess. It&rsquo;s a journey &mdash; and {{school_name}}"
                        + " is here to help you navigate it.</p>"

                        + "</div>"
                        + "{{email_footer}}"
                        + "</div></body></html>")
                .variants("has_pdf_link", "is_link_only", "has_booking_link")
                .build();
    }

    // ── reminder_config seed rows ────────────────────────────────────────────

    private static final String REMINDER_SEED_SOURCE =
            "db/migration/V20260525001__reminder_tables.sql:69-84";

    private static PortedTemplate reminderAssessmentInviteB2c() {
        return PortedTemplate.of("reminder.assessment_invite_b2c", EmailType.ENTITLEMENT_REMINDER)
                .name("B2C assessment not started reminder (from reminder config)")
                .source("reminder_config seed", REMINDER_SEED_SOURCE)
                .mailClass(MailClass.SUBSCRIBED)
                .origin(SeedOrigin.REMINDER_CONFIG)
                .subject("Reminder: complete your career assessment")
                .body("<p>Hi {{student_name}},</p>"
                        + "<p>You have not yet started your career assessment <b>{{assessment_name}}</b>."
                        + " Click the link below to begin:</p>"
                        + "<p><a href=\"{{action_link}}\">{{action_link}}</a></p>")
                .build();
    }

    private static PortedTemplate reminderCounselling24h() {
        return PortedTemplate.of("reminder.counselling_24h", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counselling session tomorrow reminder (from reminder config)")
                .source("reminder_config seed", REMINDER_SEED_SOURCE)
                .mailClass(MailClass.SUBSCRIBED)
                .origin(SeedOrigin.REMINDER_CONFIG)
                .subject("Reminder: your counselling session is tomorrow")
                .body("<p>Hi {{student_name}},</p>"
                        + "<p>Your counselling session with <b>{{counsellor_name}}</b> is scheduled for"
                        + " <b>{{session_datetime}}</b>.</p>"
                        + "<p>Join here: <a href=\"{{meeting_link}}\">{{meeting_link}}</a></p>")
                .build();
    }

    private static PortedTemplate reminderCounselling1h() {
        return PortedTemplate.of("reminder.counselling_1h", EmailType.COUNSELLING_NOTIFICATION)
                .name("Counselling session in an hour reminder (from reminder config)")
                .source("reminder_config seed", REMINDER_SEED_SOURCE)
                .mailClass(MailClass.SUBSCRIBED)
                .origin(SeedOrigin.REMINDER_CONFIG)
                .subject("Your counselling session starts in an hour")
                .body("<p>Hi {{student_name}},</p>"
                        + "<p>Your counselling session starts at <b>{{session_datetime}}</b>."
                        + " Join here: <a href=\"{{meeting_link}}\">{{meeting_link}}</a></p>")
                .build();
    }

    private static PortedTemplate reminderAssessmentMapping() {
        return PortedTemplate.of("reminder.assessment_mapping", EmailType.REMINDER)
                .name("Assigned assessment not started reminder (from reminder config)")
                .source("reminder_config seed", REMINDER_SEED_SOURCE)
                .mailClass(MailClass.SUBSCRIBED)
                .origin(SeedOrigin.REMINDER_CONFIG)
                .subject("Reminder: complete your assigned assessment")
                .body("<p>Hi {{student_name}},</p>"
                        + "<p>You have an assigned assessment <b>{{assessment_name}}</b> from {{school_name}}"
                        + " that you have not yet started. Please complete it at your earliest convenience.</p>"
                        + "<p><a href=\"{{action_link}}\">{{action_link}}</a></p>")
                .build();
    }
}
