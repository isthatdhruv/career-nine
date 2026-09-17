package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.DOB_CAPTION;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

/** B2C entitlement mails: welcome/assessment-invite/dashboard/LMS/counselling-booking links. Pure: strings and links in, Mail out. */
public final class EntitlementMails {
    private EntitlementMails() { }
    static final String PERSONAL = "The link is personal to you. Please don&rsquo;t forward it.";

    public static Mail welcome(String firstName, String username, String password, MailLink magic, MailLink signIn) {
        Mail.Builder m = Mail.builder().subject("Welcome to Career-9: start your assessment")
            .preheader("One tap signs you in. Your username and password are inside for later.")
            .title("Welcome aboard, " + v(firstName))
            .p("Your purchase is confirmed and your assessment is ready when you are. You can pause and resume at any time.")
            .p("One tap signs you in and takes you straight to your assessment:")
            .action(magic, "Start assessment")
            .p(b("Or sign in manually") + " with:");
        if (username != null && password != null) m.credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password));
        else m.small("Use the user ID and date of birth you provided at registration to sign in.");
        return m.links(null, signIn, "Open the sign-in page")
            .small("Keep these safe. You will need them to resume your assessment or open your report later.").signature().build();
    }

    public static Mail assessmentLink(String firstName, String assessmentName, MailLink magic) {
        return Mail.builder().subject("Your Career-9 assessment link")
            .preheader("Your assessment is waiting. One tap to start or resume.")
            .title("Your assessment link").p(hi(firstName))
            .p("Here is your link to " + b(assessmentName) + ". One tap signs you in, and you can pause and resume at any time.")
            .action(magic, "Start assessment").signature().build();
    }

    public static Mail dashboardAccess(String firstName, MailLink sso) {
        return Mail.builder().subject("Your Career-9 dashboard access").preheader("One tap opens your dashboard.")
            .title("Your dashboard access").p(hi(firstName))
            .p("One tap below signs you in and opens your Career-9 dashboard, where your results and next steps live.")
            .action(sso, "Open my dashboard").small(PERSONAL).signature().build();
    }

    public static Mail learningAccess(String firstName, MailLink lms) {
        return Mail.builder().subject("Your Career-9 learning access").preheader("Your learning modules are ready.")
            .title("Your learning modules are ready").p(hi(firstName))
            .p("Your Career-9 learning modules are ready. One tap below signs you in and opens them.")
            .action(lms, "Open my modules").small(PERSONAL).signature().build();
    }

    /**
     * Fallback body for an admin-sent campaign invite, used only until someone saves a
     * CAMPAIGN_INVITE template on the Email Templates page — that template then takes over.
     *
     * <p>No greeting: the admin types an address, not a name, so there is nobody to greet.
     * And no {@link #PERSONAL} footnote either — a campaign link is a public registration
     * page, so forwarding it to a friend is the point rather than the risk.
     */
    public static Mail campaignInvite(String campaignName, String assessmentName, MailLink landing) {
        String what = assessmentName == null || assessmentName.trim().isEmpty()
                ? "a Career-9 career assessment" : b(assessmentName);
        Mail.Builder m = Mail.builder().subject("You are invited to take a Career-9 assessment")
            .preheader("Register on the page inside — it takes a couple of minutes.")
            .title("Your Career-9 assessment invitation")
            .p("You have been invited to take " + what + ".");
        if (campaignName != null && !campaignName.trim().isEmpty()) {
            m.p("This invitation is part of " + b(campaignName) + ".");
        }
        return m.p("Register on the page below to get started. It takes a couple of minutes, and you can begin the assessment as soon as you are done.")
            .action(landing, "Register now").signature().build();
    }

    public static Mail bookingLink(String firstName, MailLink booking) {
        return Mail.builder().subject("Book your Career-9 counselling session").preheader("Pick a time that suits you. No login needed.")
            .title("Book your counselling session").p(hi(firstName))
            .p("Your plan includes a one-to-one counselling session. Pick a time that suits you; no login is needed.")
            .action(booking, "Book my session")
            .small("Once you choose a slot, your session is confirmed instantly and you will receive the meeting details by email.").signature().build();
    }
}
