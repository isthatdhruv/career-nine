package com.kccitm.api.service.email.mails;

import java.util.List;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

/** Mails to the Career-9 team and to notification-recipient lists. Internal tag, facts, one button to the admin page. */
public final class InternalMails {
    private InternalMails() { }

    public static Mail counsellorDeactivatedAlert(String counsellorName, String counsellorEmail, String adminName, List<String[]> rows, MailLink manageSessions) {
        int n = rows.size();
        // A counsellor with an empty diary is the quiet case, and the reader should see that from
        // the inbox: no student list to explain, and nothing to chase. The subject still counts
        // the sessions, because "(0 sessions)" is exactly what happened.
        Mail.Builder m = Mail.builder().subject("Counsellor deactivated: " + counsellorName + " (" + n + (n == 1 ? " session)" : " sessions)"))
            .preheader(n == 0
                    ? "No upcoming sessions were booked with this counsellor."
                    : n + (n == 1 ? " session" : " sessions") + " taken off the calendar. Some students may need a follow-up.")
            .internal("Counsellor deactivation").title("Counsellor deactivated")
            .details(new Mail.Row("Counsellor", counsellorName), new Mail.Row("Email", counsellorEmail), new Mail.Row("Deactivated by", adminName), new Mail.Row("Sessions affected", String.valueOf(n)));
        if (n == 0) {
            m.p("No upcoming sessions were booked with this counsellor, so no students need a follow-up.");
        } else {
            m.p("The students below have had their session taken off the calendar. " + b("Rebooking link sent") + " means they can pick a new time themselves. " + b("Needs follow-up") + " means no other counsellor covers their assessment and they were told the team would be in touch.")
             .table(new String[]{"Student", "When", "Contact", "Outcome"}, rows);
        }
        return m.action(manageSessions, "Open Manage Sessions").build();
    }

    public static Mail counsellingRequestForwarded(String assessmentName, String studentName, String studentEmail, String studentPhone, String instituteName, MailLink assign) {
        return Mail.builder().subject("Counselling request: " + assessmentName)
            .preheader("A student asked for counselling but no counsellor is mapped to this assessment.")
            .internal("Support inbox").title("Counselling request needs a counsellor")
            .p("A student has requested career counselling, but no counsellor is mapped to this assessment yet.")
            .details(new Mail.Row("Assessment", assessmentName), new Mail.Row("Student", studentName), new Mail.Row("Email", studentEmail), new Mail.Row("Phone", studentPhone), new Mail.Row("Institute", instituteName))
            .action(assign, "Assign a counsellor")
            .small("Assign a counsellor on the Counsellor &harr; Assessment page to let the student book.").build();
    }

    /** Small admin notices: no replacement counsellor, counsellor no-show, dispute raised. */
    public static Mail adminNotice(String tag, String title, String lead, List<Mail.Row> facts, MailLink open, String buttonLabel) {
        return Mail.builder().subject(title).preheader(lead.length() > 90 ? lead.substring(0, 90) : lead)
            .internal(tag).title(v(title)).p(v(lead)).details(facts).action(open, buttonLabel).build();
    }
}
