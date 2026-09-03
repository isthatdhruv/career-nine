package com.kccitm.api.service.email.port;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;

/**
 * Code-ported templates for the Razorpay payment mails ({@code PaymentEmailService}), the
 * B2C entitlement mails ({@code EntitlementService}: welcome / assessment invite, 1-pager,
 * final report, admin resends) and the assessment-completion mail
 * ({@code AssessmentCompletionEmailService}).
 *
 * <p>Every subject and body below is the ORIGINAL markup lifted verbatim, with dynamic Java
 * expressions replaced by {@code {{placeholders}}} and Java branches by
 * {@code {{#flag}}…{{/flag}}} / {@code {{^flag}}…{{/flag}}} sections. Nothing is reworded.
 */
@Component
public class PaymentAndB2cPorts implements PortedTemplateSource {

    private static final String PAYMENT_SRC = "service/PaymentEmailService.java";
    private static final String ENTITLEMENT_SRC = "service/b2c/EntitlementService.java";
    private static final String COMPLETION_SRC = "service/AssessmentCompletionEmailService.java";

    @Override
    public List<PortedTemplate> templates() {
        List<PortedTemplate> out = new ArrayList<>();

        // PaymentEmailService
        out.add(paymentSuccess());
        out.add(paymentSuccessResend());
        out.add(paymentFailed());
        out.add(paymentExpired());
        out.add(paymentCancelled());
        out.add(paymentReminder());
        out.add(paymentLink());

        // EntitlementService (B2C)
        out.add(b2cWelcome());
        out.add(b2cOnePagerReady());
        out.add(b2cResendAssessmentInvite());
        out.add(b2cResendOnePager());
        out.add(b2cResendDashboardAccess());
        out.add(b2cResendCounsellingBook());
        out.add(b2cResendLmsAccess());

        // AssessmentCompletionEmailService
        out.add(assessmentCompletion());

        return out;
    }

    // ───────────────────────────────────────────────────────────────────────
    // PaymentEmailService
    // ───────────────────────────────────────────────────────────────────────

    private static PortedTemplate paymentSuccess() {
        String body = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Payment Successful!</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>Your payment for <strong>{{assessment_name}}</strong> has been received. Your assessment has been allotted.</p>"
                + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #059669; font-size: 1.1em;'>{{username}}</span></p>"
                + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #059669; font-size: 1.1em;'>{{password}}</span> (Your Date of Birth)</p>"
                + "</div>"
                + "<p>Please log in and complete your assessment at your earliest convenience.</p>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                + "</div>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";

        return PortedTemplate.of("payment.success", EmailType.PAYMENT_SUCCESS)
                .name("Payment success / receipt (from code)")
                .source("PaymentEmailService#sendWelcomeEmail", PAYMENT_SRC + ":36-72")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Payment Successful - {{assessment_name}}")
                .body(body)
                .build();
    }

    private static PortedTemplate paymentSuccessResend() {
        String body = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Payment Successful!</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>Your payment for <strong>{{assessment_name}}</strong> has been received successfully.</p>"
                + "<p>Your assessment has been allotted. Please log in to complete it at your earliest convenience.</p>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                + "</div>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";

        return PortedTemplate.of("payment.success_resend", EmailType.PAYMENT_SUCCESS)
                .name("Payment success welcome resend (from code)")
                .source("PaymentEmailService#sendWelcomeEmailResend", PAYMENT_SRC + ":182-207")
                .mailClass(MailClass.SUBSCRIBED)
                .subject("Welcome! Complete Your Assessment - {{assessment_name}}")
                .body(body)
                .build();
    }

    /** Shared frame of the failed / expired / cancelled mails, exactly as sendFailedOrPendingEmail builds it. */
    private static String paymentStatusHtml(String headerBg, String headerTitle, String bodyMessage) {
        return "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: " + headerBg + "; padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>" + headerTitle + "</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>" + bodyMessage + "</p>"
                + "<p>Please try again using the link below:</p>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<a href='{{payment_link}}' style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1em;'>Retry Payment</a>"
                + "</div>"
                + "<p style='color: #666; font-size: 0.85em;'>If the amount was deducted, it will be refunded within 5-7 business days.</p>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";
    }

    private static PortedTemplate paymentFailed() {
        return PortedTemplate.of("payment.failed", EmailType.PAYMENT_FAILED)
                .name("Payment failed (from code)")
                .source("PaymentEmailService#sendFailedOrPendingEmail", PAYMENT_SRC + ":75-125")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Payment Failed - {{assessment_name}}")
                .body(paymentStatusHtml(
                        "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        "Payment Failed",
                        "Your payment of <strong>INR {{amount}}</strong> for <strong>{{assessment_name}}</strong> could not be processed."))
                .build();
    }

    private static PortedTemplate paymentExpired() {
        return PortedTemplate.of("payment.expired", EmailType.PAYMENT_FAILED)
                .name("Payment link expired (from code)")
                .source("PaymentEmailService#sendFailedOrPendingEmail", PAYMENT_SRC + ":75-125")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Payment Link Expired - {{assessment_name}}")
                .body(paymentStatusHtml(
                        "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                        "Payment Link Expired",
                        "The payment link for <strong>{{assessment_name}}</strong> (INR {{amount}}) has expired."))
                .build();
    }

    private static PortedTemplate paymentCancelled() {
        return PortedTemplate.of("payment.cancelled", EmailType.PAYMENT_FAILED)
                .name("Payment cancelled (from code)")
                .source("PaymentEmailService#sendFailedOrPendingEmail", PAYMENT_SRC + ":75-125")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Payment Cancelled - {{assessment_name}}")
                .body(paymentStatusHtml(
                        "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
                        "Payment Cancelled",
                        "Your payment of <strong>INR {{amount}}</strong> for <strong>{{assessment_name}}</strong> was cancelled."))
                .build();
    }

    private static PortedTemplate paymentReminder() {
        String body = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Payment Pending</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>Your payment of <strong>INR {{amount}}</strong> for <strong>{{assessment_name}}</strong> is still pending.</p>"
                + "<p>Please complete your payment using the link below:</p>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<a href='{{payment_link}}' style='background: #f59e0b; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1em;'>Complete Payment</a>"
                + "</div>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated reminder. Please do not reply.</p>"
                + "</div></div>";

        return PortedTemplate.of("payment.reminder", EmailType.PAYMENT_REMINDER)
                .name("Payment pending reminder (from code)")
                .source("PaymentEmailService#sendNudgeEmail", PAYMENT_SRC + ":128-154")
                .mailClass(MailClass.SUBSCRIBED)
                .subject("Complete Your Payment - {{assessment_name}}")
                .body(body)
                .build();
    }

    private static PortedTemplate paymentLink() {
        String body = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Assessment Payment</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>Please complete your payment of <strong>INR {{amount}}</strong> for <strong>{{assessment_name}}</strong>.</p>"
                + "<div style='text-align: center; margin: 28px 0;'>"
                + "<a href='{{payment_link}}' style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 1.1em; display: inline-block;'>Pay Now</a>"
                + "</div>"
                + "<p style='color: #666; font-size: 0.85em;'>Or copy this link: <a href='{{payment_link}}'>{{payment_link}}</a></p>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";

        return PortedTemplate.of("payment.link", EmailType.PAYMENT_LINK)
                .name("Payment link (from code)")
                .source("PaymentEmailService#sendPaymentLinkEmail", PAYMENT_SRC + ":157-179")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Payment Link - {{assessment_name}} (INR {{amount}})")
                .body(body)
                .build();
    }

    // ───────────────────────────────────────────────────────────────────────
    // EntitlementService (B2C)
    // ───────────────────────────────────────────────────────────────────────

    private static PortedTemplate b2cWelcome() {
        String credentialsBlock = "{{#has_credentials}}"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;font-size:13.5px;\">"
                + "<tr><td style=\"padding:4px 0;color:#5f6f67;width:110px;\">Username</td>"
                + "<td style=\"padding:4px 0;color:#0f1f18;font-family:Consolas,'Courier New',monospace;font-weight:700;\">"
                +     "{{username}}</td></tr>"
                + "<tr><td style=\"padding:4px 0;color:#5f6f67;\">Password</td>"
                + "<td style=\"padding:4px 0;color:#0f1f18;font-family:Consolas,'Courier New',monospace;font-weight:700;\">"
                +     "{{password}}"
                + " <span style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
                +     "color:#8a978f;font-weight:400;\">(your date of birth)</span></td></tr>"
                + "</table>"
                + "{{/has_credentials}}"
                + "{{^has_credentials}}"
                + "<p style=\"margin:0;font-size:13.5px;line-height:1.6;color:#3d4a44;\">"
                + "Use the user ID and date of birth you provided at registration to sign in."
                + "</p>"
                + "{{/has_credentials}}";

        String body = ""
            + "<div style=\"background:#f3f5f4;padding:40px 16px;"
            +     "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
            + "<div style=\"max-width:560px;margin:0 auto;\">"

            // Wordmark above the card
            + "<div style=\"padding:0 6px 12px;\">"
            + "<span style=\"font-size:14px;font-weight:800;letter-spacing:2px;color:#059669;\">CAREER&#8209;9</span>"
            + "</div>"

            // Card, single green accent line
            + "<div style=\"background:#ffffff;border:1px solid #e3e8e5;border-radius:14px;overflow:hidden;\">"
            + "<div style=\"height:4px;background:#059669;\"></div>"
            + "<div style=\"padding:32px 32px 8px;\">"

            + "<h1 style=\"margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#0f1f18;\">"
            +     "Welcome aboard, {{student_name}}!</h1>"
            + "<p style=\"margin:0 0 24px;font-size:15px;line-height:1.6;color:#5f6f67;\">"
            +     "Your purchase is confirmed. Your assessment is ready when you are &mdash; "
            +     "you can pause and resume anytime.</p>"

            // Primary action: magic link
            + "<p style=\"margin:0 0 14px;font-size:14px;line-height:1.6;color:#0f1f18;\">"
            +     "One click signs you in and takes you straight to your assessment:</p>"
            + "<div style=\"text-align:center;margin:0 0 26px;\">"
            + "<a href=\"{{action_link}}\" style=\"display:inline-block;padding:14px 36px;background:#059669;"
            +     "color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;\">"
            +     "Start Assessment &rarr;</a>"
            + "</div>"

            // Divider
            + "<div style=\"border-top:1px solid #e3e8e5;text-align:center;margin:0 0 20px;\">"
            + "<span style=\"position:relative;top:-9px;background:#ffffff;padding:0 12px;"
            +     "font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;\">OR SIGN IN MANUALLY</span>"
            + "</div>"

            // Credentials panel
            + "<div style=\"background:#f6f8f7;border:1px solid #e3e8e5;border-radius:10px;padding:18px 20px;margin:0 0 22px;\">"
            + "<p style=\"margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#3d4a44;\">Visit "
            + "<a href=\"{{dashboard_link}}\" style=\"color:#059669;font-weight:700;text-decoration:none;\">"
            +     "{{dashboard_link}}</a> and use:</p>"
            + credentialsBlock
            + "<p style=\"margin:12px 0 0;font-size:12px;line-height:1.6;color:#8a978f;\">"
            +     "Keep these safe &mdash; you&rsquo;ll need them to resume your assessment or open your report later.</p>"
            + "</div>"

            // Fallback raw link
            + "<p style=\"margin:0 0 28px;font-size:12px;line-height:1.6;color:#8a978f;text-align:center;\">"
            +     "If the button doesn&rsquo;t work, paste this link into your browser:<br>"
            + "<span style=\"word-break:break-all;color:#5f6f67;\">{{action_link}}</span></p>"

            + "</div>"

            // Footer
            + "<div style=\"background:#f6f8f7;border-top:1px solid #e3e8e5;padding:14px 32px;\">"
            + "<p style=\"margin:0;font-size:11px;line-height:1.6;color:#8a978f;\">"
            +     "This is an automated message from Career&#8209;9 &mdash; please don&rsquo;t reply to this address.<br>"
            +     "&copy; Career&#8209;9. All rights reserved.</p>"
            + "</div>"

            + "</div></div></div>";

        return PortedTemplate.of("b2c.welcome", EmailType.ENTITLEMENT_GRANTED)
                .name("B2C welcome / assessment invite (from code)")
                .source("EntitlementService#sendWelcomeAssessmentLink", ENTITLEMENT_SRC + ":902-1020")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Welcome to Career-9 — start your assessment")
                .body(body)
                .variants("has_credentials")
                .build();
    }

    /** Verbatim copy of EntitlementService#simpleHtml with the link as a placeholder. */
    private static String simpleHtml(String greeting, String preLink, String linkPlaceholder, String cta) {
        return "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;'>"
                + "<div style='background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px;border-radius:12px 12px 0 0;color:white;'>"
                + "<h2 style='margin:0;'>" + greeting + "</h2></div>"
                + "<div style='padding:24px;background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;'>"
                + "<p>" + preLink + "</p>"
                + "<div style='text-align:center;margin:24px 0;'>"
                + "<a href='" + linkPlaceholder + "' style='display:inline-block;padding:14px 32px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;'>" + cta + "</a>"
                + "</div>"
                + "<p style='color:#64748b;font-size:0.85em;margin-top:24px;'>If the button doesn't work, copy this link: " + linkPlaceholder + "</p>"
                + "</div></div>";
    }

    private static PortedTemplate b2cOnePagerReady() {
        return PortedTemplate.of("b2c.one_pager_ready", EmailType.REPORT_READY)
                .name("1-pager ready (from code)")
                .source("EntitlementService#onAssessmentCompleted", ENTITLEMENT_SRC + ":621-626")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 1-pager is ready")
                .body(simpleHtml("Your free 1-page Career-9 summary is ready.",
                        "View your summary or unlock the full report from there:", "{{one_pager_link}}", "Open 1-pager"))
                .build();
    }


    private static PortedTemplate b2cResendAssessmentInvite() {
        return PortedTemplate.of("b2c.resend_assessment_invite", EmailType.ENTITLEMENT_GRANTED)
                .name("Resend assessment link (from code)")
                .source("EntitlementService#resendServiceLink", ENTITLEMENT_SRC + ":762-766")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 assessment link")
                .body(simpleHtml("Here is your Career-9 assessment link.", "Take the assessment:", "{{action_link}}", "Start assessment"))
                .build();
    }

    private static PortedTemplate b2cResendOnePager() {
        return PortedTemplate.of("b2c.resend_one_pager", EmailType.REPORT_READY)
                .name("Resend 1-pager (from code)")
                .source("EntitlementService#resendServiceLink", ENTITLEMENT_SRC + ":767-771")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 1-pager")
                .body(simpleHtml("Your 1-pager summary.", "View it:", "{{one_pager_link}}", "Open 1-pager"))
                .build();
    }

    private static PortedTemplate b2cResendDashboardAccess() {
        return PortedTemplate.of("b2c.resend_dashboard_access", EmailType.GENERIC)
                .name("Resend dashboard access (from code)")
                .source("EntitlementService#resendServiceLink", ENTITLEMENT_SRC + ":788-793")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 dashboard access")
                .body(simpleHtml("Open your dashboard.", "Click below:", "{{dashboard_link}}", "Open dashboard"))
                .build();
    }

    private static PortedTemplate b2cResendCounsellingBook() {
        return PortedTemplate.of("b2c.resend_counselling_book", EmailType.GENERIC)
                .name("Resend counselling booking link (from code)")
                .source("EntitlementService#resendServiceLink", ENTITLEMENT_SRC + ":794-801")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Book your Career-9 counselling session")
                .body(simpleHtml("Book your counselling session.", "Pick a slot:", "{{booking_link}}", "Book session"))
                .build();
    }

    private static PortedTemplate b2cResendLmsAccess() {
        return PortedTemplate.of("b2c.resend_lms_access", EmailType.GENERIC)
                .name("Resend LMS access (from code)")
                .source("EntitlementService#resendServiceLink", ENTITLEMENT_SRC + ":802-807")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 LMS access")
                .body(simpleHtml("Your LMS is ready.", "Launch it:", "{{lms_link}}", "Open LMS"))
                .build();
    }

    // ───────────────────────────────────────────────────────────────────────
    // AssessmentCompletionEmailService
    // ───────────────────────────────────────────────────────────────────────

    private static PortedTemplate assessmentCompletion() {
        String body = "<!DOCTYPE html>\n"
            + "<html lang=\"en\">\n"
            + "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"></head>\n"
            + "<body style=\"margin:0;padding:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#e8eaf6 0%,#e0f2e9 50%,#f3e5f5 100%);\">\n"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:40px 20px;\">\n"
            + "<tr><td align=\"center\">\n"

            // — Outer card (glassmorphism) —
            + "<table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "background:rgba(255,255,255,0.65);"
            + "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
            + "border-radius:24px;"
            + "border:1px solid rgba(255,255,255,0.5);"
            + "box-shadow:0 8px 32px rgba(0,0,0,0.08);"
            + "overflow:hidden;\">\n"

            // — Top gradient bar —
            + "<tr><td style=\"height:6px;background:linear-gradient(90deg,#4ECDC4,#44B78B,#A0D585);\"></td></tr>\n"

            // — Logo row (co-branded with the school when whitelabel) —
            + "<tr><td align=\"center\" style=\"padding:32px 40px 16px;\">\n"
            + "{{email_header}}" + "\n"
            + "</td></tr>\n"

            // — Celebration icon —
            + "<tr><td align=\"center\" style=\"padding:8px 40px 0;\">\n"
            + "  <div style=\"width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,rgba(78,205,196,0.15),rgba(160,213,133,0.2));display:inline-block;text-align:center;line-height:80px;\">\n"
            + "    <span style=\"font-size:36px;\">&#10003;</span>\n"
            + "  </div>\n"
            + "</td></tr>\n"

            // — Heading —
            + "<tr><td align=\"center\" style=\"padding:20px 40px 4px;\">\n"
            + "  <h1 style=\"margin:0;font-size:26px;font-weight:800;background:linear-gradient(135deg,#4ECDC4,#44B78B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;\">Assessment Complete!</h1>\n"
            + "</td></tr>\n"

            // — Greeting —
            + "<tr><td align=\"center\" style=\"padding:4px 40px 20px;\">\n"
            + "  <p style=\"margin:0;font-size:16px;color:#4a5568;line-height:1.6;\">Great work, <strong style=\"color:#1a2a3a;\">{{first_name}}</strong>! You've successfully completed <strong style=\"color:#1a2a3a;\">{{assessment_name}}</strong>.</p>\n"
            + "</td></tr>\n"

            // — Login credentials card (username != null || dob != null) —
            + "{{#has_credentials}}"
            + "<tr><td style=\"padding:0 40px 16px;\">\n"
            + "  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "    background:rgba(255,255,255,0.55);"
            + "    border-radius:16px;"
            + "    border:1px solid rgba(78,205,196,0.2);"
            + "    box-shadow:0 2px 12px rgba(0,0,0,0.04);\">\n"
            + "    <tr><td style=\"padding:20px 24px 8px;\">\n"
            + "      <div style=\"font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#78909c;font-weight:600;\">Your Login Details</div>\n"
            + "    </td></tr>\n"
            + "{{#has_username}}"
            + "    <tr><td style=\"padding:4px 24px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"font-size:13px;color:#64748b;width:90px;\">Username</td>\n"
            + "        <td style=\"font-size:15px;font-weight:600;color:#1a2a3a;font-family:'Courier New',monospace;background:rgba(78,205,196,0.08);padding:6px 12px;border-radius:8px;\">{{username}}</td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"
            + "{{/has_username}}"
            + "{{#has_password}}"
            + "    <tr><td style=\"padding:4px 24px 16px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"font-size:13px;color:#64748b;width:90px;\">DOB</td>\n"
            + "        <td style=\"font-size:15px;font-weight:600;color:#1a2a3a;font-family:'Courier New',monospace;background:rgba(78,205,196,0.08);padding:6px 12px;border-radius:8px;\">{{password}}</td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"
            + "{{/has_password}}"
            + "  </table>\n"
            + "</td></tr>\n"
            + "{{/has_credentials}}"

            // — Inner glass card: What Happens Next —
            + "<tr><td style=\"padding:0 40px;\">\n"
            + "  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "    background:rgba(255,255,255,0.55);"
            + "    border-radius:16px;"
            + "    border:1px solid rgba(78,205,196,0.2);"
            + "    box-shadow:0 2px 12px rgba(0,0,0,0.04);\">\n"

            // Section heading
            + "    <tr><td style=\"padding:24px 24px 16px;\">\n"
            + "      <div style=\"font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#78909c;font-weight:600;\">What Happens Next</div>\n"
            + "    </td></tr>\n"

            // Step 1
            + "    <tr><td style=\"padding:0 24px 14px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">1</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Your report is being generated</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Our AI engine is analysing your responses across 6 career dimensions to build your personalised Career Report.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            // Step 2
            + "    <tr><td style=\"padding:0 24px 14px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">2</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Check your dashboard</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Log in to your Student Dashboard to view your career matches, strengths, and detailed insights once the report is ready.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            // Step 3
            + "    <tr><td style=\"padding:0 24px 22px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">3</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Talk to a career expert</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Our counsellors are available to walk you through your results and help you plan your next steps. You can book a session anytime from your dashboard.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            + "  </table>\n"
            + "</td></tr>\n"

            // — CTA Button —
            + "<tr><td align=\"center\" style=\"padding:28px 40px 32px;\">\n"
            + "  <a href=\"https://dashboard.career-9.com/student/login\" style=\""
            + "    display:inline-block;padding:14px 36px;"
            + "    background:linear-gradient(135deg,#4ECDC4,#44B78B);"
            + "    color:#ffffff;font-size:15px;font-weight:700;"
            + "    text-decoration:none;border-radius:12px;"
            + "    box-shadow:0 4px 16px rgba(68,183,139,0.35);"
            + "    letter-spacing:0.3px;\">Go to My Dashboard</a>\n"
            + "</td></tr>\n"

            // — Bottom gradient bar —
            + "<tr><td style=\"height:4px;background:linear-gradient(90deg,#A0D585,#4ECDC4,#44B78B);\"></td></tr>\n"

            + "</table>\n"

            // — Footer —
            + "<table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\">\n"
            + "<tr><td align=\"center\" style=\"padding:24px 40px;\">\n"
            + "  <p style=\"margin:0;font-size:12px;color:#90a4ae;line-height:1.6;\">"
            + "{{email_footer}}"
            + "  </p>\n"
            + "</td></tr>\n"
            + "</table>\n"

            + "</td></tr></table>\n"
            + "</body></html>";

        return PortedTemplate.of("assessment.completion", EmailType.ASSESSMENT_COMPLETION)
                .name("Assessment completion (from code)")
                .source("AssessmentCompletionEmailService#sendCompletionEmail", COMPLETION_SRC + ":37-260")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("You've completed {{assessment_name}} — {{school_name}}")
                .body(body)
                .variants("has_credentials", "has_username", "has_password")
                .build();
    }
}
