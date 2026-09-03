package com.kccitm.api.service.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.PortState;
import com.kccitm.api.model.email.SeedOrigin;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.LoginCredentialsEmailService;

/**
 * Seeds the flagship default email templates on boot. Idempotent: a type is seeded only when it
 * has no live ({@link PortState#PORTED}) template yet, so admin edits/deletes are never
 * overwritten on restart. Bodies come from the senders' shared HTML builders, tokenised,
 * guaranteeing parity with the inline fallback.
 *
 * <p>Also stamps catalogue provenance on these rows ({@link SeedOrigin#SEED}, a mail key, and
 * the seed-time content hash), including on rows seeded before those columns existed, so the
 * dashboard can tell whether an admin has changed them since.
 */
@Component
@Order(100)
public class EmailTemplateSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(EmailTemplateSeeder.class);

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Override
    public void run(ApplicationArguments args) {
        seed(EmailType.LOGIN_CREDENTIALS, "Login credentials (default)",
                LoginCredentialsEmailService.defaultSubjectTemplate(),
                LoginCredentialsEmailService.defaultBodyTemplate());
        seed(EmailType.LEAD_NOTIFICATION, "New lead alert (default)",
                LEAD_ALERT_SUBJECT, LEAD_ALERT_BODY);
        seed(EmailType.LEAD_WELCOME, "Lead acknowledgement (default)",
                LEAD_WELCOME_SUBJECT, LEAD_WELCOME_BODY);
    }

    /*
     * Lead templates.
     *
     * Held here as constants rather than pulled off a sender the way the credentials pair is,
     * because these two have no inline predecessor to keep parity with — the notification is
     * new. They are seeded once and then belong to the admin: editing them in
     * /admin/email-templates is the supported way to change the wording, and a restart will
     * not put these strings back over an edit.
     */
    private static final String LEAD_ALERT_SUBJECT =
            "New {{lead_type}} lead: {{lead_name}}";
    private static final String LEAD_ALERT_BODY =
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

    private static final String LEAD_WELCOME_SUBJECT =
            "Thanks for getting in touch with Career-9";
    private static final String LEAD_WELCOME_BODY =
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

    private void seed(EmailType type, String name, String subject, String body) {
        try {
            String mailKey = type.name().toLowerCase();
            String seedHash = TemplateContentHash.of(subject, body, null);
            boolean hasLive = false;
            for (EmailTemplate existing : templateRepository.findByEmailTypeOrderByNameAsc(type.name())) {
                if (existing.getPortState() != PortState.CONTENT_ONLY) {
                    hasLive = true;
                }
                // Backfill provenance on rows seeded before the catalogue columns existed.
                if (name.equals(existing.getName()) && existing.getSeededHash() == null) {
                    existing.setSeedOrigin(SeedOrigin.SEED);
                    if (existing.getMailKey() == null) {
                        existing.setMailKey(mailKey);
                    }
                    existing.setSeededHash(seedHash);
                    templateRepository.save(existing);
                }
            }
            if (hasLive) {
                return; // already has a live template — never clobber admin content
            }
            EmailTemplate t = new EmailTemplate();
            t.setName(name);
            t.setEmailType(type.name());
            t.setMailKey(mailKey);
            t.setSubjectTemplate(subject);
            t.setBodyTemplate(body);
            t.setSeedOrigin(SeedOrigin.SEED);
            t.setSeededHash(seedHash);
            t.setPortState(PortState.PORTED);
            t.setIsDefault(true);
            t.setDeliveryMode(type.defaultDeliveryMode());
            t.setActive(true);
            templateRepository.save(t);
            logger.info("Seeded default email template for {}", type.name());
        } catch (Exception e) {
            logger.warn("Could not seed default template for {}: {}", type, e.getMessage());
        }
    }
}
