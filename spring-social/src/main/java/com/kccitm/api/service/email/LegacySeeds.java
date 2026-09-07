package com.kccitm.api.service.email;

/**
 * Byte-identical copies of the HTML the pre-theme seed helpers produced, kept only so the
 * boot-time template upgrader (Task 12) can compute the MD5 of "the seeded default as it used
 * to be" and decide whether an admin's saved template still matches the seed (safe to migrate)
 * or has been edited (leave it alone). Nothing in the running application should render these —
 * new sends go through the theme package.
 */
public final class LegacySeeds {
    private LegacySeeds() { }

    /** {@code LoginCredentialsEmailService.renderBody("{{first_name}}", "{{username}}", "{{password}}", "{{dashboard_link}}", "{{email_header}}", "{{email_footer}}")} verbatim. */
    public static final String LOGIN_CREDENTIALS_BODY = renderBody("{{first_name}}", "{{username}}", "{{password}}",
            "{{dashboard_link}}", "{{email_header}}", "{{email_footer}}");

    /** {@code EmailTemplateSeeder.LEAD_ALERT_BODY} verbatim, before the lead alert moved to the theme. */
    public static final String LEAD_ALERT_BODY =
            "<div style=\"font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827\">"
            + "<p style=\"font-size:17px;font-weight:700;margin:0 0 4px\">New enquiry from the website</p>"
            + "<p style=\"margin:0 0 20px;color:#4b5563;font-size:14px\">"
            + "{{lead_type}} &middot; {{lead_source}} &middot; received {{lead_received_at}}</p>"
            + "{{lead_details}}"
            + "<p style=\"margin:22px 0 0\">"
            + "<a href=\"mailto:{{lead_email}}\" style=\"display:inline-block;padding:10px 18px;"
            + "background:#1c5cab;color:#ffffff;border-radius:8px;text-decoration:none;"
            + "font-weight:600;font-size:14px\">Reply to {{lead_name}}</a></p>"
            + "<p style=\"margin:16px 0 0;color:#6b7280;font-size:12px\">"
            + "Career-9 lead #{{lead_id}}. This alert goes to everyone on the New-lead "
            + "recipient list; change it under Email &rsaquo; Notification Recipients.</p>"
            + "</div>";

    /** {@code EmailTemplateSeeder.LEAD_WELCOME_BODY} verbatim, before the lead welcome moved to the theme. */
    public static final String LEAD_WELCOME_BODY =
            "{{email_header}}"
            + "<div style=\"font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827\">"
            + "<p>Hi {{first_name}},</p>"
            + "<p>Thanks for getting in touch with Career-9. We have your enquiry and someone from "
            + "our team will be in contact shortly.</p>"
            + "<p style=\"color:#4b5563;font-size:14px;margin-top:22px\">Here is what you sent us:</p>"
            + "{{lead_details}}"
            + "<p style=\"margin-top:22px\">Warm regards,<br>Team Career-9</p>"
            + "</div>"
            + "{{email_footer}}";

    /**
     * {@code reminder_config.body_template} seed rows from
     * {@code V20260525001__reminder_tables.sql} lines 72-83, verbatim (SQL '' unescaped to ').
     * Kept here for the same reason as the mail bodies above: a future upgrader needs "the seed
     * as it used to be" to tell an untouched row from an admin edit.
     */
    public static final String REMINDER_ASSESSMENT_INVITE_B2C =
            "<p>Hi {{studentName}},</p><p>You have not yet started your career assessment <b>{{assessmentName}}</b>. Click the link below to begin:</p><p><a href=\"{{link}}\">{{link}}</a></p>";

    public static final String REMINDER_COUNSELLING_24H =
            "<p>Hi {{studentName}},</p><p>Your counselling session with <b>{{counsellorName}}</b> is scheduled for <b>{{appointmentTime}}</b>.</p><p>Join here: <a href=\"{{meetingUrl}}\">{{meetingUrl}}</a></p>";

    public static final String REMINDER_COUNSELLING_1H =
            "<p>Hi {{studentName}},</p><p>Your counselling session starts at <b>{{appointmentTime}}</b>. Join here: <a href=\"{{meetingUrl}}\">{{meetingUrl}}</a></p>";

    public static final String REMINDER_ASSESSMENT_MAPPING =
            "<p>Hi {{studentName}},</p><p>You have an assigned assessment <b>{{assessmentName}}</b> from {{instituteName}} that you have not yet started. Please complete it at your earliest convenience.</p><p><a href=\"{{link}}\">{{link}}</a></p>";

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
}
