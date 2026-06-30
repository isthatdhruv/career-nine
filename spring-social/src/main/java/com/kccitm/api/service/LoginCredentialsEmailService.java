package com.kccitm.api.service;

import java.util.ArrayList;
import java.util.Collections;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.b2c.LinkBuilder;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import com.kccitm.api.service.email.EmailDispatchService;

/**
 * Sends a styled "here are your login credentials" email to a student through the central
 * {@link EmailDispatchService} (Phase 3). The send is logged, honours per-institute account
 * routing, and renders the {@code LOGIN_CREDENTIALS} template when one is configured —
 * otherwise it falls back to the inline HTML built here (kept byte-identical via the shared
 * {@link #renderBody} method, which also produces the seeded default template).
 */
@Service
public class LoginCredentialsEmailService {

    private static final Logger logger = LoggerFactory.getLogger(LoginCredentialsEmailService.class);

    @Autowired
    private EmailDispatchService emailDispatchService;

    @Autowired
    private LinkBuilder linkBuilder;

    @Autowired
    private InstituteBrandingService brandingService;

    /** Backwards-compatible overload — standard (non-whitelabel) Career-9 branding. */
    public void send(String studentName, String recipientEmail, String username, String dob) {
        send(studentName, recipientEmail, username, dob, null);
    }

    /**
     * Dispatch a login-credentials email. Branding (header/footer/school name) is resolved
     * whitelabel-aware from {@code institute}; the sending identity comes from the institute's
     * configured account (or the global default) — see Phase 2 routing.
     *
     * @param institute the student's institute (may be null for B2C / lead students)
     */
    public void send(String studentName, String recipientEmail, String username, String dob,
                     InstituteDetail institute) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            throw new IllegalArgumentException("recipientEmail is required");
        }
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username is required");
        }
        if (dob == null || dob.isBlank()) {
            throw new IllegalArgumentException("dob (used as password) is required");
        }

        BrandingDto brand = brandingService.forInstitute(institute);
        String fallbackSubject = brand.isWhitelabel()
                ? "Your " + brand.getSchoolName() + " Login Credentials"
                : "Your Career-9 Login Credentials";
        String safeName = escapeHtml(studentName == null || studentName.isBlank() ? "Student" : studentName);
        String firstName = safeName.contains(" ") ? safeName.substring(0, safeName.indexOf(' ')) : safeName;
        String fallbackHtml = renderBody(firstName, escapeHtml(username), escapeHtml(dob),
                linkBuilder.studentLogin(), brandingService.emailHeaderHtml(brand),
                brandingService.emailFooterHtml(brand));

        EmailSendRequest req = new EmailSendRequest();
        req.setEmailType(EmailType.LOGIN_CREDENTIALS);
        req.setTo(new ArrayList<>(Collections.singletonList(recipientEmail)));
        if (institute != null && institute.getInstituteCode() != null) {
            req.setInstituteCode(institute.getInstituteCode());
        }
        // Context for the template (values are HTML-escaped by the resolver).
        req.put("student_name", studentName);
        req.put("username", username);
        req.put("password", dob);
        // Inline fallback used only if no LOGIN_CREDENTIALS template is configured.
        req.setSubject(fallbackSubject);
        req.setHtmlContent(fallbackHtml);

        emailDispatchService.send(req);
        logger.info("Login-credentials email dispatched for {} (whitelabel={})",
                recipientEmail, brand.isWhitelabel());
    }

    // ─── seed helpers ────────────────────────────────────────────────────

    /** Subject for the seeded default template ({{school_name}} → school or "Career-9"). */
    public static String defaultSubjectTemplate() {
        return "Your {{school_name}} Login Credentials";
    }

    /** Body for the seeded default template — the same HTML as the inline fallback, tokenised. */
    public static String defaultBodyTemplate() {
        return renderBody("{{first_name}}", "{{username}}", "{{password}}", "{{dashboard_link}}",
                "{{email_header}}", "{{email_footer}}");
    }

    /**
     * Single source of the credentials-email HTML. All dynamic parts are arguments so the same
     * markup serves both the runtime fallback (real, escaped values) and the seeded template
     * (placeholder tokens). {@code headerHtml}/{@code footerHtml} are raw HTML blocks.
     */
    private static String renderBody(String firstName, String username, String password,
                                     String dashboardLink, String headerHtml, String footerHtml) {
        return "<!DOCTYPE html>\n"
            + "<html lang=\"en\">\n"
            + "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"></head>\n"
            + "<body style=\"margin:0;padding:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#e8eaf6 0%,#e0f2e9 50%,#f3e5f5 100%);\">\n"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:40px 20px;\">\n"
            + "<tr><td align=\"center\">\n"

            + "<table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "background:rgba(255,255,255,0.65);"
            + "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
            + "border-radius:24px;"
            + "border:1px solid rgba(255,255,255,0.5);"
            + "box-shadow:0 8px 32px rgba(0,0,0,0.08);"
            + "overflow:hidden;\">\n"

            + "<tr><td style=\"height:6px;background:linear-gradient(90deg,#4ECDC4,#44B78B,#A0D585);\"></td></tr>\n"

            + "<tr><td align=\"center\" style=\"padding:32px 40px 16px;\">\n"
            + headerHtml + "\n"
            + "</td></tr>\n"

            + "<tr><td align=\"center\" style=\"padding:8px 40px 0;\">\n"
            + "  <div style=\"width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,rgba(78,205,196,0.15),rgba(160,213,133,0.2));display:inline-block;text-align:center;line-height:80px;\">\n"
            + "    <span style=\"font-size:36px;\">&#128273;</span>\n"
            + "  </div>\n"
            + "</td></tr>\n"

            + "<tr><td align=\"center\" style=\"padding:20px 40px 4px;\">\n"
            + "  <h1 style=\"margin:0;font-size:26px;font-weight:800;background:linear-gradient(135deg,#4ECDC4,#44B78B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;\">Your Login Credentials</h1>\n"
            + "</td></tr>\n"

            + "<tr><td align=\"center\" style=\"padding:4px 40px 20px;\">\n"
            + "  <p style=\"margin:0;font-size:16px;color:#4a5568;line-height:1.6;\">Hello, <strong style=\"color:#1a2a3a;\">" + firstName + "</strong>! Use the details below to log in and take your assessment.</p>\n"
            + "</td></tr>\n"

            + "<tr><td style=\"padding:0 40px 16px;\">\n"
            + "  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "    background:rgba(255,255,255,0.55);"
            + "    border-radius:16px;"
            + "    border:1px solid rgba(78,205,196,0.2);"
            + "    box-shadow:0 2px 12px rgba(0,0,0,0.04);\">\n"
            + "    <tr><td style=\"padding:20px 24px 8px;\">\n"
            + "      <div style=\"font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#78909c;font-weight:600;\">Your Login Details</div>\n"
            + "    </td></tr>\n"
            + "    <tr><td style=\"padding:4px 24px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"font-size:13px;color:#64748b;width:90px;\">Username</td>\n"
            + "        <td style=\"font-size:15px;font-weight:600;color:#1a2a3a;font-family:'Courier New',monospace;background:rgba(78,205,196,0.08);padding:6px 12px;border-radius:8px;\">" + username + "</td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"
            + "    <tr><td style=\"padding:4px 24px 16px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"font-size:13px;color:#64748b;width:90px;\">Password</td>\n"
            + "        <td style=\"font-size:15px;font-weight:600;color:#1a2a3a;font-family:'Courier New',monospace;background:rgba(78,205,196,0.08);padding:6px 12px;border-radius:8px;\">" + password + "</td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"
            + "    <tr><td style=\"padding:0 24px 18px;\">\n"
            + "      <div style=\"font-size:12px;color:#78909c;line-height:1.5;\">Your password is your date of birth in <strong>DD-MM-YYYY</strong> format.</div>\n"
            + "    </td></tr>\n"
            + "  </table>\n"
            + "</td></tr>\n"

            + "<tr><td style=\"padding:0 40px;\">\n"
            + "  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "    background:rgba(255,255,255,0.55);"
            + "    border-radius:16px;"
            + "    border:1px solid rgba(78,205,196,0.2);"
            + "    box-shadow:0 2px 12px rgba(0,0,0,0.04);\">\n"

            + "    <tr><td style=\"padding:24px 24px 16px;\">\n"
            + "      <div style=\"font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#78909c;font-weight:600;\">How To Get Started</div>\n"
            + "    </td></tr>\n"

            + "    <tr><td style=\"padding:0 24px 14px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">1</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Open the assessment portal</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Visit your dashboard from the button below and log in with the credentials shown above.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            + "    <tr><td style=\"padding:0 24px 14px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">2</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Complete your assessment</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Pick the assessment your school has assigned to you and answer the questions honestly &mdash; there are no right or wrong answers.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            + "    <tr><td style=\"padding:0 24px 22px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">3</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Get your personalised report</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Once you submit, our AI engine builds your Career Report across six career dimensions, ready in your dashboard.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            + "  </table>\n"
            + "</td></tr>\n"

            + "<tr><td align=\"center\" style=\"padding:28px 40px 32px;\">\n"
            + "  <a href=\"" + dashboardLink + "\" style=\""
            + "    display:inline-block;padding:14px 36px;"
            + "    background:linear-gradient(135deg,#4ECDC4,#44B78B);"
            + "    color:#ffffff;font-size:15px;font-weight:700;"
            + "    text-decoration:none;border-radius:12px;"
            + "    box-shadow:0 4px 16px rgba(68,183,139,0.35);"
            + "    letter-spacing:0.3px;\">Log In Now</a>\n"
            + "</td></tr>\n"

            + "<tr><td style=\"height:4px;background:linear-gradient(90deg,#A0D585,#4ECDC4,#44B78B);\"></td></tr>\n"

            + "</table>\n"

            + "<table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\">\n"
            + "<tr><td align=\"center\" style=\"padding:24px 40px;\">\n"
            + "  <p style=\"margin:0;font-size:12px;color:#90a4ae;line-height:1.6;\">"
            + footerHtml
            + "  </p>\n"
            + "</td></tr>\n"
            + "</table>\n"

            + "</td></tr></table>\n"
            + "</body></html>";
    }

    private static String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
