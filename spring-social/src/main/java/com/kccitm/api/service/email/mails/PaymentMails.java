package com.kccitm.api.service.email.mails;

import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import static com.kccitm.api.service.email.mails.AccountMails.DOB_CAPTION;
import static com.kccitm.api.service.email.mails.AccountMails.KEEP;
import static com.kccitm.api.service.email.mails.AccountMails.hi;
import static com.kccitm.api.service.email.theme.Mail.b;

/** Payment success, resend, failure/pending and payment-link mails. Pure: strings and links in, Mail out. */
public final class PaymentMails {
    public enum Outcome { FAILED, EXPIRED, CANCELLED }
    private PaymentMails() { }
    static String rupees(String amount) { return "&#8377;" + Mail.v(amount); }

    public static Mail paymentReceived(String firstName, String assessmentName, String username, String password, MailLink start) {
        return Mail.builder().subject("Payment received for " + assessmentName)
            .preheader("Your assessment is ready. Username and password are inside.")
            .title("Payment received").p(hi(firstName))
            .p("Your payment for " + b(assessmentName) + " has been received and the assessment is ready for you.")
            .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
            .action(start, "Start assessment").small(KEEP).signature().build();
    }

    /** magic may be null (legacy school/mapping payment with no entitlement): then the sign-in page is the primary action. */
    public static Mail welcomeResend(String firstName, String assessmentName, String username, String password, MailLink magic, MailLink signIn) {
        Mail.Builder m = Mail.builder().subject("Your " + assessmentName + " is ready")
            .preheader("One tap starts your assessment. Your username and password are inside for later.")
            .title("Your assessment is ready").p(hi(firstName))
            .p("Your payment for " + b(assessmentName) + " was received and the assessment is waiting for you. You can pause and resume at any time.");
        if (magic != null) {
            m.p("One tap signs you in and takes you straight to your assessment:").action(magic, "Start assessment")
             .p(b("Or sign in manually") + " with:")
             .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
             .links(null, signIn, "Open the sign-in page");
        } else {
            m.p("Sign in with the details below to begin:")
             .credentials(DOB_CAPTION, new Mail.Row("Username", username), new Mail.Row("Password", password))
             .action(signIn, "Sign in");
        }
        return m.small(KEEP).signature().build();
    }

    public static Mail paymentFailed(String firstName, String assessmentName, String amount, Outcome outcome, MailLink retry) {
        String subject, lead;
        switch (outcome) {
            case EXPIRED:   subject = "Payment link for " + assessmentName + " has expired";
                            lead = "The payment link for " + b(assessmentName) + " (" + rupees(amount) + ") has expired, so nothing has been charged."; break;
            case CANCELLED: subject = "Payment for " + assessmentName + " was cancelled";
                            lead = "Your payment of " + b("₹" + amount) + " for " + b(assessmentName) + " was cancelled, so nothing has been charged."; break;
            default:        subject = "Payment for " + assessmentName + " did not go through";
                            lead = "Your payment of " + b("₹" + amount) + " for " + b(assessmentName) + " did not go through, so nothing has been charged.";
        }
        return Mail.builder().subject(subject).preheader("Nothing has been charged. Use the button to try again.")
            .title("Payment could not be completed").p(hi(firstName)).p(lead)
            .notice("If an amount was deducted from your account, it will be refunded automatically within 5&ndash;7 working days.")
            .action(retry, "Try again").signature().build();
    }

    public static Mail paymentPending(String firstName, String assessmentName, String amount, MailLink pay) {
        return Mail.builder().subject("Complete your payment for " + assessmentName)
            .preheader("₹" + amount + " is still pending. The button takes you straight to payment.")
            .title("Your payment is still pending").p(hi(firstName))
            .p("Your payment of " + b("₹" + amount) + " for " + b(assessmentName) + " is still pending. Complete it to get access to your assessment.")
            .action(pay, "Complete payment").signature().build();
    }

    public static Mail paymentLink(String firstName, String assessmentName, String amount, MailLink pay) {
        return Mail.builder().subject("Payment link for " + assessmentName)
            .preheader("₹" + amount + " for " + assessmentName + ". Pay securely with the button below.")
            .title("Your payment link").p(hi(firstName))
            .p("Here is your payment link for " + b(assessmentName) + ". The amount due is " + b("₹" + amount) + ".")
            .action(pay, "Pay now").small("Payments are processed securely by Razorpay.").signature().build();
    }
}
