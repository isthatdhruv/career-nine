package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.theme.Mail.b;
import static com.kccitm.api.service.email.theme.Mail.v;

/** Registration, sign-in and password mails. Pure: strings and links in, Mail out. */
public final class AccountMails {
    static final String KEEP = "Keep these details safe. You will need them to resume the assessment and to open your report later.";
    static final String DOB_CAPTION = "Your password is your date of birth, DD-MM-YYYY.";
    private AccountMails() { }

    /** "Aarav Sharma" → "Aarav"; null/blank → "there". */
    public static String firstName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) return "there";
        String t = fullName.trim();
        return t.contains(" ") ? t.substring(0, t.indexOf(' ')) : t;
    }
    static String hi(String firstName) { return "Hi " + v(firstName) + ","; }

    public static Mail loginCredentials(String brandName, String firstName, String username, String password, MailLink signIn) {
        return Mail.builder()
            .subject("Your " + brandName + " login details")
            .preheader("Username and password to sign in and take your assessment.")
            .title("Your login details").p(hi(firstName))
            .p("Use the details below to sign in and take your assessment. You can pause and resume at any time.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
            .steps(new Mail.Step("Sign in", "Open the portal with the button below and enter the details above."),
                   new Mail.Step("Complete your assessment", "Pick the assessment assigned to you and answer honestly. There are no right or wrong answers."),
                   new Mail.Step("Get your report", "Once you submit, your Career Report is built across six career dimensions and appears in your dashboard."))
            .action(signIn, "Sign in").small(KEEP).signature().build();
    }

    /** Identical to {@link #loginCredentials} except the primary button has no href yet (seeded template: {{dashboard_link}} is a token). */
    public static Mail loginCredentialsSeed() {
        return Mail.builder()
            .subject("Your {{school_name}} login details")
            .preheader("Username and password to sign in and take your assessment.")
            .title("Your login details").p(hi("{{first_name}}"))
            .p("Use the details below to sign in and take your assessment. You can pause and resume at any time.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", "{{username}}"), new Mail.Row("Password", "{{password}}"))
            .steps(new Mail.Step("Sign in", "Open the portal with the button below and enter the details above."),
                   new Mail.Step("Complete your assessment", "Pick the assessment assigned to you and answer honestly. There are no right or wrong answers."),
                   new Mail.Step("Get your report", "Once you submit, your Career Report is built across six career dimensions and appears in your dashboard."))
            .button(MailLink.of("{{dashboard_link}}", ""), "Sign in").small(KEEP).signature().build();
    }

    public static Mail registrationSuccess(String firstName, String assessmentName, String username, String password, MailLink signIn) {
        return Mail.builder()
            .subject("You're registered for " + assessmentName)
            .preheader("Your username and password are inside. Sign in when you're ready.")
            .title("Registration successful").p(hi(firstName))
            .p("You are registered for " + b(assessmentName) + ". Sign in with the details below when you are ready to begin.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
            .action(signIn, "Sign in").small(KEEP).signature().build();
    }

    public static Mail accountWelcome(String firstName) {
        return Mail.builder().subject("Welcome to Career-9")
            .preheader("Your account is under review. We will let you know once it is active.")
            .title("Welcome to Career-9").p(hi(firstName))
            .p("Thanks for registering. Your account is under review and we will email you as soon as it is active.")
            .signature().build();
    }

    public static Mail passwordResetLink(String firstName, int minutes, MailLink reset) {
        return Mail.builder().subject("Reset your Career-9 password")
            .preheader("This link works once and expires in " + minutes + " minutes.")
            .title("Reset your password").p(hi(firstName))
            .p("We received a request to reset the password for your Career-9 account. Use the button below to choose a new one. The link works once and expires in " + b(minutes + " minutes") + ".")
            .action(reset, "Reset password")
            .small("If you did not request this, you can ignore this email. Your password stays as it is.")
            .signature().build();
    }

    public static Mail passwordResetConfirm(String firstName, MailLink signIn) {
        return Mail.builder().subject("Your Career-9 password was changed")
            .preheader("If this wasn't you, secure your account now.")
            .title("Your password was changed").p(hi(firstName))
            .p("The password for your Career-9 account was just changed.")
            .notice("If this wasn't you, reset your password again straight away and write to support@career-9.net so we can check the account.")
            .action(signIn, "Sign in").signature().build();
    }

    public static Mail adminPasswordReset(String firstName, String newPassword, MailLink signIn) {
        return Mail.builder().subject("Your Career-9 password has been reset")
            .preheader("An administrator set a new password for you. Change it after signing in.")
            .title("Your password has been reset").p(hi(firstName))
            .p("An administrator has reset the password for your Career-9 account.")
            .credentials("Sign in with your registered email and this password, then change it from your profile.", new Mail.Row("New password", newPassword))
            .action(signIn, "Sign in")
            .small("If you did not ask for this change, contact your administrator or write to support@career-9.net.")
            .signature().build();
    }

    public static Mail accountActivated(String firstName, MailLink signIn) {
        return Mail.builder().subject("Your Career-9 account is active")
            .preheader("You can sign in now with your registered email and password.")
            .title("Your account is active").p(hi(firstName))
            .p("Your Career-9 dashboard account has been activated. Sign in with your registered email and password.")
            .action(signIn, "Sign in").signature().build();
    }
}
