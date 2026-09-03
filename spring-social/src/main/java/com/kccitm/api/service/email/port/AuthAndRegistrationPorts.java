package com.kccitm.api.service.email.port;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;

/**
 * Auth / account, registration-confirmation, B2C counselling-request and system-test mails
 * lifted verbatim from their inline Java builders so they appear in the admin catalogue.
 *
 * <p>Fidelity: copy is the ORIGINAL text, typos and all. Dynamic Java expressions became
 * {@code {{placeholders}}}, null-guarded lines became {@code {{#flag}}…{{/flag}}} sections.
 * Mails whose original was plain text ({@code sendText}) carry the same text in both
 * {@code body} and {@code text}, since the builder requires a body.
 */
@Component
public class AuthAndRegistrationPorts implements PortedTemplateSource {

    @Override
    public List<PortedTemplate> templates() {
        List<PortedTemplate> out = new ArrayList<>();
        out.add(accountWelcome());
        out.add(passwordReset());
        out.add(passwordResetConfirm());
        out.add(adminPasswordReset());
        out.add(accountActivated());
        out.add(counsellingRequest());
        out.add(assessmentRegistrationSuccessful());
        out.add(schoolRegistrationSuccessful());
        out.add(accountTest());
        return out;
    }

    // ── Auth / account ──────────────────────────────────────────────────────

    /** AuthController#registerUser — plain-text welcome after /auth/signup. */
    private PortedTemplate accountWelcome() {
        final String text = "Hello {{student_name}},\n\n"
                + "Thank you for registering.\n"
                + "Your account is under review.We will get back to you soon.\n\n"
                + "Regards,\n"
                + "Career-9 Team";
        return PortedTemplate.of("auth.account_welcome", EmailType.ACCOUNT_WELCOME)
                .name("Account welcome / under review (from code)")
                .source("AuthController#registerUser", "controller/AuthController.java:654-657")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Welcome to Career-9")
                .body(text)
                .text(text)
                .build();
    }

    /** AuthController#forgotPassword → buildResetEmailHtml. Greeting branches on a non-blank name. */
    private PortedTemplate passwordReset() {
        String body = "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 32px;\">"
                + "<h2 style=\"color: #111827; margin-bottom: 16px;\">Reset your password</h2>"
                + "<p>{{#has_name}}Hi {{student_name}},{{/has_name}}{{^has_name}}Hi,{{/has_name}}</p>"
                + "<p>We received a request to reset your Career-9 password. Click the button below to set a new password. This link is valid for "
                + "60 minutes and can be used only once.</p>"
                + "<p style=\"text-align: center; margin: 32px 0;\">"
                + "<a href=\"{{reset_link}}\" style=\"display: inline-block; background: #009ef7; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600;\">Reset Password</a>"
                + "</p>"
                + "<p style=\"color: #6b7280; font-size: 14px;\">If the button doesn't work, copy and paste this URL into your browser:</p>"
                + "<p style=\"color: #4b5563; font-size: 13px; word-break: break-all;\">{{reset_link}}</p>"
                + "<hr style=\"border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;\"/>"
                + "<p style=\"color: #6b7280; font-size: 13px;\">If you did not request this, you can safely ignore this email — your password will remain unchanged.</p>"
                + "<p style=\"color: #6b7280; font-size: 13px;\">— The Career-9 Team</p>"
                + "</div>";
        return PortedTemplate.of("auth.password_reset", EmailType.PASSWORD_RESET)
                .name("Password reset link (from code)")
                .source("AuthController#forgotPassword / buildResetEmailHtml",
                        "controller/AuthController.java:695-699, 780-798")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Reset your Career-9 password")
                .body(body)
                .variants("has_name")
                .build();
    }

    /** AuthController#resetPassword → buildResetConfirmationHtml. Greeting branches on a non-blank name. */
    private PortedTemplate passwordResetConfirm() {
        String body = "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 32px;\">"
                + "<h2 style=\"color: #111827; margin-bottom: 16px;\">Your password was reset</h2>"
                + "<p>{{#has_name}}Hi {{student_name}},{{/has_name}}{{^has_name}}Hi,{{/has_name}}</p>"
                + "<p>This is a confirmation that the password for your Career-9 account was just changed.</p>"
                + "<p>If this wasn't you, please contact support immediately and reset your password again.</p>"
                + "<hr style=\"border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;\"/>"
                + "<p style=\"color: #6b7280; font-size: 13px;\">— The Career-9 Team</p>"
                + "</div>";
        return PortedTemplate.of("auth.password_reset_confirm", EmailType.PASSWORD_RESET_CONFIRM)
                .name("Password reset confirmation (from code)")
                .source("AuthController#resetPassword / buildResetConfirmationHtml",
                        "controller/AuthController.java:759-763, 800-812")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 password was reset")
                .body(body)
                .variants("has_name")
                .build();
    }

    /** UserController#adminResetPassword — plain text carrying the new password, sent only when the admin ticks sendEmail. */
    private PortedTemplate adminPasswordReset() {
        final String text = "Hello {{student_name}},\n\n"
                + "An administrator has reset your Career-9 password.\n\n"
                + "Your new password is: {{password}}\n\n"
                + "Please log in at https://dashboard.career-9.com using your registered email "
                + "and the password above, and change it immediately from your profile.\n\n"
                + "If you did not request this change, contact your administrator.\n\n"
                + "— Career-9 Team";
        return PortedTemplate.of("auth.admin_password_reset", EmailType.ADMIN_PASSWORD_RESET)
                .name("Admin-issued password reset (from code)")
                .source("UserController#adminResetPassword", "controller/UserController.java:512-523")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Your Career-9 password has been reset")
                .body(text)
                .text(text)
                .build();
    }

    /** UserController#toggleUserActive — plain text, no dynamic values. */
    private PortedTemplate accountActivated() {
        final String text = "Your Dashboard account has been activated.\n"
                + "You can login at https://dashboard.career-9.com using your registered email and password.\n\n"
                + "Best regards,\n"
                + "Career-9 Team";
        return PortedTemplate.of("auth.account_activated", EmailType.ACCOUNT_ACTIVATED)
                .name("Account activated (from code)")
                .source("UserController#toggleUserActive", "controller/UserController.java:563-567")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Congratulations! Account Activated")
                .body(text)
                .text(text)
                .build();
    }

    // ── B2C counselling ─────────────────────────────────────────────────────

    /**
     * CampaignPublicController#notifyCounsellingForwarded — plain-text alert to the support
     * inbox. Each detail line is emitted only when the Java value is non-null.
     */
    private PortedTemplate counsellingRequest() {
        final String text = "A student has requested career counselling, but no counsellor is mapped to this assessment yet.\n\n"
                + "Assessment: {{assessment_name}}\n"
                + "{{#has_student_name}}Student: {{student_name}}\n{{/has_student_name}}"
                + "{{#has_student_email}}Email: {{student_email}}\n{{/has_student_email}}"
                + "{{#has_student_phone}}Phone: {{student_phone}}\n{{/has_student_phone}}"
                + "{{#has_school_name}}Institute: {{school_name}}\n{{/has_school_name}}"
                + "\nAssign a counsellor on the Counsellor ↔ Assessment page to let the student book.";
        return PortedTemplate.of("b2c.counselling_request", EmailType.COUNSELLING_REQUEST)
                .name("Counselling request — no counsellor mapped (from code)")
                .source("CampaignPublicController#notifyCounsellingForwarded",
                        "controller/career9/b2c/CampaignPublicController.java:1281-1299")
                .mailClass(MailClass.INTERNAL)
                .subject("Counselling request — {{assessment_name}}")
                .body(text)
                .text(text)
                .variants("has_student_name", "has_student_email", "has_student_phone", "has_school_name")
                .build();
    }

    // ── B2B / registration ──────────────────────────────────────────────────

    /** AssessmentInstituteMappingController#sendRegistrationEmail — purple header variant. Values are NOT escaped in Java. */
    private PortedTemplate assessmentRegistrationSuccessful() {
        String body = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Registration Successful!</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>You have been successfully registered for <strong>{{assessment_name}}</strong>.</p>"
                + "<p>Here are your login credentials:</p>"
                + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #667eea; font-size: 1.1em;'>{{username}}</span></p>"
                + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #667eea; font-size: 1.1em;'>{{password}}</span> (Your Date of Birth)</p>"
                + "</div>"
                + "<p style='color: #666; font-size: 0.9em;'>Please save these credentials. You will need them to log in and take the assessment.</p>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                + "</div>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div>"
                + "</div>";
        return PortedTemplate.of("b2b.assessment_registration_successful", EmailType.ASSESSMENT_INSTITUTE_MAPPING)
                .name("Registration successful — assessment mapping (from code)")
                .source("AssessmentInstituteMappingController#sendRegistrationEmail",
                        "controller/career9/AssessmentInstituteMappingController.java:1780-1810")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Registration Successful - {{assessment_name}}")
                .body(body)
                .build();
    }

    /** SchoolRegistrationController#sendRegistrationEmail — green header variant. Values are HTML-escaped in Java. */
    private PortedTemplate schoolRegistrationSuccessful() {
        String body = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Registration Successful!</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>{{student_name}}</strong>,</p>"
                + "<p>You have been successfully registered for <strong>{{assessment_name}}</strong>.</p>"
                + "<p>Here are your login credentials:</p>"
                + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #059669; font-size: 1.1em;'>{{username}}</span></p>"
                + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #059669; font-size: 1.1em;'>{{password}}</span> (Your Date of Birth)</p>"
                + "</div>"
                + "<p style='color: #666; font-size: 0.9em;'>Please save these credentials. You will need them to log in and take the assessment.</p>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                + "</div>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";
        return PortedTemplate.of("b2b.school_registration_successful", EmailType.SCHOOL_REGISTRATION)
                .name("Registration successful — school registration (from code)")
                .source("SchoolRegistrationController#sendRegistrationEmail",
                        "controller/career9/SchoolRegistrationController.java:1139-1167")
                .mailClass(MailClass.TRANSACTIONAL)
                .subject("Registration Successful - {{assessment_name}}")
                .body(body)
                .build();
    }

    // ── System ──────────────────────────────────────────────────────────────

    /** EmailDispatchService#sendTestThroughAccount — admin "send test" from the Accounts page. "/mode" appears only when the account has a mode. */
    private PortedTemplate accountTest() {
        String body = "<p>This is a test email from Career-9 confirming the <strong>"
                + "{{account_name}}</strong> account ("
                + "{{account_provider}}{{#has_account_mode}}/{{account_mode}}{{/has_account_mode}}"
                + ") can send.</p>";
        return PortedTemplate.of("system.account_test", EmailType.ACCOUNT_TEST)
                .name("Email-account test message (from code)")
                .source("EmailDispatchService#sendTestThroughAccount",
                        "service/email/EmailDispatchService.java:295-323")
                .mailClass(MailClass.INTERNAL)
                .subject("Career-9 email test — {{account_name}}")
                .body(body)
                .variants("has_account_mode")
                .build();
    }
}
