package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.career9.PrincipalDashboardReleaseLog;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailEventContext;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.service.mail.MailEvents;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.service.email.EmailDispatchService;

/**
 * Tells a school its dashboard is live, and how to use it.
 *
 * <p>Sent by hand, to chosen recipients. Nothing is mailed as a side effect of generating:
 * a release can be re-run several times while an admin gets a school's data right, and
 * each of those runs mailing the principal would train them to ignore the mail. The admin
 * decides when the dashboard is worth announcing.
 *
 * <p>Every send is written to the release log, so "did anyone tell the school?" has an
 * answer that does not depend on someone remembering.
 */
@Service
public class PrincipalDashboardNotificationService {

    private static final Logger log =
            LoggerFactory.getLogger(PrincipalDashboardNotificationService.class);

    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @Autowired
    private EmailDispatchService emailDispatch;

    @Autowired
    private PrincipalDashboardReleaseLogger trace;

    /** Optional: reports mail events to the admin automation engine; absent until wired. Never affects the flow. */
    @Autowired(required = false)
    private MailEvents mailEvents;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /** One recipient's outcome, so the page can show exactly who got it and who did not. */
    public static final class SendOutcome {
        public Long contactPersonId;
        public String name;
        public String email;
        public boolean sent;
        public String error;
    }

    /** A contact person as the recipient picker needs them. */
    public static final class Recipient {
        public Long id;
        public String name;
        public String email;
        public String designation;
        /** False when there is no address to send to — shown, but not selectable. */
        public boolean emailable;
    }

    public List<Recipient> recipientsFor(Long instituteCode) {
        List<Recipient> out = new ArrayList<>();
        // The derived finder, not findAll() with a filter: this table holds every school's
        // contacts. instituteCode is an int on the entity, so the narrowing happens here
        // rather than through an equals() between Long and Integer that is always false.
        for (ContactPerson person : contactPersonRepository
                .findByInstitute_InstituteCode(instituteCode.intValue())) {
            Recipient r = new Recipient();
            r.id = person.getId();
            r.name = person.getName();
            r.email = person.getEmail();
            r.designation = person.getDesignation();
            r.emailable = person.getEmail() != null && person.getEmail().contains("@");
            out.add(r);
        }
        return out;
    }

    /**
     * Mail the chosen contacts.
     *
     * <p>Sends are attempted one at a time and a failure is recorded rather than thrown:
     * one bad address among five must not stop the other four, and the admin needs to see
     * which one it was.
     */
    public List<SendOutcome> notify(Long instituteCode, String instituteName,
            String assessmentName, List<Long> contactPersonIds) {

        List<Recipient> all = recipientsFor(instituteCode);
        List<SendOutcome> outcomes = new ArrayList<>();

        for (Recipient recipient : all) {
            if (!contactPersonIds.contains(recipient.id)) {
                continue;
            }
            SendOutcome outcome = new SendOutcome();
            outcome.contactPersonId = recipient.id;
            outcome.name = recipient.name;
            outcome.email = recipient.email;

            if (!recipient.emailable) {
                outcome.sent = false;
                outcome.error = "No email address on file";
                outcomes.add(outcome);
                continue;
            }

            try {
                String subject = "Your Career-9 school dashboard is ready — " + instituteName;
                EmailSendResult result = emailDispatch.sendHtml(
                        EmailType.SCHOOL_DASHBOARD_READY,
                        recipient.email,
                        subject,
                        body(recipient.name, instituteName, assessmentName));
                outcome.sent = result.isSuccess();
                outcome.error = result.isSuccess() ? null : result.getError();
            } catch (Exception e) {
                outcome.sent = false;
                outcome.error = PrincipalDashboardReleaseLogger.describe(e);
                log.warn("Dashboard notification to {} failed: {}", recipient.email, e.toString());
            }
            // One mail event per contact actually notified; a failed send can be retried by the admin.
            if (outcome.sent) publishDashboardReleased(instituteCode, instituteName, assessmentName, recipient);
            outcomes.add(outcome);
        }

        // Recorded against the school rather than a run: this is an act on the published
        // dashboard, not a step of any one generation.
        long sent = outcomes.stream().filter(o -> o.sent).count();
        trace.run("notify-" + instituteCode, instituteCode, null,
                PrincipalDashboardReleaseLog.STEP_EMAILED,
                sent == outcomes.size() ? PrincipalDashboardReleaseLog.OUTCOME_OK
                                        : PrincipalDashboardReleaseLog.OUTCOME_FAILED,
                describe(outcomes, sent));

        return outcomes;
    }

    /**
     * DASHBOARD_RELEASED for admin automations. The release subject is the same id this act is
     * logged under ("notify-{instituteCode}"); the dashboard link is the one in {@link #body}.
     */
    private void publishDashboardReleased(Long instituteCode, String instituteName, String assessmentName,
                                          Recipient recipient) {
        if (mailEvents == null || recipient == null) return;
        try {
            mailEvents.publish(MailEventContext.of(MailEvent.DASHBOARD_RELEASED)
                    .subject("release", "notify-" + instituteCode)
                    .subject("institute", instituteCode)
                    .recipient(MailRecipientRole.SCHOOL_CONTACT, recipient.email, recipient.name)
                    .field("contact_person_name", recipient.name)
                    .field("school_name", instituteName)
                    .field("dashboard_link", frontendUrl + "/school-dashboard")
                    .field("assessment_name", assessmentName)
                    .ref("instituteCode", instituteCode)
                    .institute(instituteCode == null ? null : instituteCode.intValue())
                    .build());
        } catch (Exception e) {
            log.warn("mail event {} failed: {}", MailEvent.DASHBOARD_RELEASED.key(), e.getMessage());
        }
    }

    private static String describe(List<SendOutcome> outcomes, long sent) {
        StringBuilder sb = new StringBuilder();
        sb.append(sent).append(" of ").append(outcomes.size()).append(" notified");
        for (SendOutcome o : outcomes) {
            if (!o.sent) {
                sb.append(" · failed: ").append(o.email).append(" (").append(o.error).append(")");
            }
        }
        return sb.toString();
    }

    /**
     * The message itself.
     *
     * Written for a principal rather than an operator: what it is, how to open it, what
     * the filters do, and who to tell when something looks wrong. Inline styles because
     * mail clients strip stylesheets.
     */
    private String body(String name, String instituteName, String assessmentName) {
        String dashboardLink = frontendUrl + "/school-dashboard";
        String greeting = (name == null || name.isBlank()) ? "Hello," : "Dear " + name + ",";

        return "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;"
                + "line-height:1.6;color:#0d1b2e;max-width:600px\">"

                + "<p>" + escape(greeting) + "</p>"

                + "<p>The Career-9 school dashboard for <b>" + escape(instituteName)
                + "</b> is now live. It summarises what "
                + escape(assessmentName == null ? "the assessment" : assessmentName)
                + " found across your students — where they are heading, where they will "
                + "need support, and what the school can do about it.</p>"

                + "<p style=\"margin:24px 0\">"
                + "<a href=\"" + escape(dashboardLink) + "\" "
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
                + "</div>";
    }

    /** Contact names and school names are user-entered; they are not markup. */
    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
