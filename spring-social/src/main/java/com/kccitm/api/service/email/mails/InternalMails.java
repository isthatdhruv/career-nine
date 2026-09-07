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

    public static Mail leadAlert(String leadType, String leadName, String leadSource, String receivedAt, List<Mail.Row> fields, String leadId, MailLink openLead) {
        return Mail.builder().subject("New " + leadType + " lead: " + leadName)
            .preheader(leadSource + " · received " + receivedAt)
            .internal("New lead alert").title("New enquiry from the website")
            .p(b(leadType) + " &middot; " + v(leadSource) + " &middot; received " + v(receivedAt))
            .details(fields)
            .action(openLead, "Open lead #" + leadId)
            .small("Every field the form submitted is listed above. This alert goes to everyone on the New-lead recipient list; change it under Email &rsaquo; Notification recipients.").build();
    }
    public static Mail leadWelcome(String firstName, List<Mail.Row> fields, MailLink site) {
        return Mail.builder().subject("Thanks for getting in touch with Career-9")
            .preheader("We have your enquiry and will be in touch shortly.")
            .title("Thanks for getting in touch").p(AccountMails.hi(firstName))
            .p("We have your enquiry and someone from our team will contact you shortly.")
            .p(b("Here is what you sent us:")).details(fields)
            .action(site, "Explore Career-9").signature().build();
    }
    public static Mail accountTest(String accountName, String provider, String sentAt) {
        return Mail.builder().subject("Career-9 email test: " + accountName)
            .preheader("If you can read this, the account can send.")
            .internal("Email account test").title("This account can send")
            .p("This is a test email from Career-9 confirming that the " + b(accountName) + " account (" + v(provider) + ") can send mail.")
            .details(new Mail.Row("Account", accountName), new Mail.Row("Provider", provider), new Mail.Row("Sent", sentAt)).build();
    }
    /** Seed bodies: same layout with {{tokens}}; button() because the href is a token until send time. */
    public static Mail leadAlertSeed() {
        return Mail.builder().subject("New {{lead_type}} lead: {{lead_name}}").preheader("{{lead_source}} · received {{lead_received_at}}")
            .internal("New lead alert").title("New enquiry from the website")
            .p("<b>{{lead_type}}</b> &middot; {{lead_source}} &middot; received {{lead_received_at}}")
            .details(new Mail.Row("Name", "{{lead_name}}"), new Mail.Row("Email", "{{lead_email}}"), new Mail.Row("Phone", "{{lead_phone}}"), new Mail.Row("School", "{{lead_school}}"), new Mail.Row("City", "{{lead_city}}"), new Mail.Row("Designation", "{{lead_designation}}"))
            .button(MailLink.of("{{lead_admin_link}}", ""), "Open lead #{{lead_id}}")
            .small("Every field the form submitted is listed above. This alert goes to everyone on the New-lead recipient list; change it under Email &rsaquo; Notification recipients.").build();
    }
    public static Mail leadWelcomeSeed() {
        return Mail.builder().subject("Thanks for getting in touch with Career-9").preheader("We have your enquiry and will be in touch shortly.")
            .title("Thanks for getting in touch").p("Hi {{first_name}},")
            .p("We have your enquiry and someone from our team will contact you shortly.")
            .p("<b>Here is what you sent us:</b>")
            .details(new Mail.Row("Name", "{{lead_name}}"), new Mail.Row("Email", "{{lead_email}}"), new Mail.Row("Phone", "{{lead_phone}}"), new Mail.Row("Enquiry type", "{{lead_type}}"), new Mail.Row("School", "{{lead_school}}"), new Mail.Row("City", "{{lead_city}}"))
            .button(MailLink.of("{{site_link}}", ""), "Explore Career-9").signature().build();
    }
}
