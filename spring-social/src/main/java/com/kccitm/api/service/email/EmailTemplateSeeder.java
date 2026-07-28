package com.kccitm.api.service.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.LoginCredentialsEmailService;

/**
 * Seeds the flagship default email templates on boot. Idempotent: a type is seeded only when it
 * has no template yet, so admin edits/deletes are never overwritten on restart. Bodies come from
 * the senders' shared HTML builders, tokenised — guaranteeing parity with the inline fallback.
 */
@Component
public class EmailTemplateSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(EmailTemplateSeeder.class);

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Override
    public void run(ApplicationArguments args) {
        seed(EmailType.LOGIN_CREDENTIALS, "Login credentials (default)",
                LoginCredentialsEmailService.defaultSubjectTemplate(),
                LoginCredentialsEmailService.defaultBodyTemplate());
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
