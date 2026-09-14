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
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.LoginCredentialsEmailService;
import com.kccitm.api.service.email.mails.InternalMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailShell;

/**
 * Seeds the flagship default email templates on boot. Idempotent: a type is seeded only when it
 * has no template yet, so admin edits/deletes are never overwritten on restart. Bodies come from
 * the senders' shared HTML builders, tokenised — guaranteeing parity with the inline fallback.
 *
 * <p>{@code @Order(Integer.MAX_VALUE - 1)}: without an explicit order this and any other
 * unordered {@link ApplicationRunner} share the same lowest-precedence bucket, which would leave
 * the run order against {@link MailSeedUpgrader} (fixed at {@code Integer.MAX_VALUE}, must run
 * after this one so it sees rows this seeder just created) undefined.
 */
@Component
@Order(Integer.MAX_VALUE - 1)
public class EmailTemplateSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(EmailTemplateSeeder.class);

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Override
    public void run(ApplicationArguments args) {
        seed(EmailType.LOGIN_CREDENTIALS, "Login credentials (default)",
                LoginCredentialsEmailService.defaultSubjectTemplate(),
                LoginCredentialsEmailService.defaultBodyTemplate());

        // Lead templates are seeded once and then belong to the admin: editing them in
        // /admin/email-templates is the supported way to change the wording, and a restart
        // will not put these strings back over an edit. The seed bodies are the theme's own
        // {{token}} versions (InternalMails.leadAlertSeed/leadWelcomeSeed) rendered without the
        // shell — the dispatcher wraps the shell around whatever the admin ends up saving.
        Mail leadAlert = InternalMails.leadAlertSeed();
        seed(EmailType.LEAD_NOTIFICATION, "New lead alert (default)",
                leadAlert.getSubject(), MailShell.bodyHtml(leadAlert));

        Mail leadWelcome = InternalMails.leadWelcomeSeed();
        seed(EmailType.LEAD_WELCOME, "Lead acknowledgement (default)",
                leadWelcome.getSubject(), MailShell.bodyHtml(leadWelcome));
    }

    private void seed(EmailType type, String name, String subject, String body) {
        try {
            if (!templateRepository.findByEmailTypeOrderByNameAsc(type.name()).isEmpty()) {
                return; // already has a template — never clobber admin content
            }
            EmailTemplate t = new EmailTemplate();
            t.setName(name);
            t.setEmailType(type.name());
            t.setSubjectTemplate(subject);
            t.setBodyTemplate(body);
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
