package com.kccitm.api.service.email;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.email.mails.InternalMails;
import com.kccitm.api.service.email.mails.ReminderMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailShell;
import com.kccitm.api.service.reminder.ReminderConfigService;
import com.kccitm.api.service.LoginCredentialsEmailService;

/**
 * Moves seeded templates onto the theme, but only rows nobody has edited: a body that still equals
 * the old seed byte-for-byte is replaced, anything else is left alone (the dispatcher shells it anyway).
 *
 * <p>Runs after {@link EmailTemplateSeeder} (which seeds a brand-new row when a type has none at
 * all) so a fresh install's freshly-seeded LOGIN_CREDENTIALS/LEAD_* rows are themed already and
 * this runner is a no-op for them on the very first boot.
 */
@Component
@Order(Integer.MAX_VALUE)
public class MailSeedUpgrader implements ApplicationRunner {
    private static final Logger logger = LoggerFactory.getLogger(MailSeedUpgrader.class);
    @Autowired private EmailTemplateRepository templateRepository;
    @Autowired private ReminderConfigService reminderConfigService;

    static boolean isUntouched(String current, String legacy) {
        return current != null && legacy != null && current.trim().equals(legacy.trim());
    }

    @Override
    public void run(ApplicationArguments args) {
        upgradeTemplate(EmailType.LOGIN_CREDENTIALS, LegacySeeds.LOGIN_CREDENTIALS_BODY, LoginCredentialsEmailService.defaultSubjectTemplate(), LoginCredentialsEmailService.defaultBodyTemplate());
        upgradeTemplate(EmailType.LEAD_NOTIFICATION, LegacySeeds.LEAD_ALERT_BODY, InternalMails.leadAlertSeed().getSubject(), MailShell.bodyHtml(InternalMails.leadAlertSeed()));
        upgradeTemplate(EmailType.LEAD_WELCOME, LegacySeeds.LEAD_WELCOME_BODY, InternalMails.leadWelcomeSeed().getSubject(), MailShell.bodyHtml(InternalMails.leadWelcomeSeed()));
        upgradeReminder(ReminderServiceType.ASSESSMENT_MAPPING, LegacySeeds.REMINDER_ASSESSMENT_MAPPING, ReminderMails.assessmentMapping());
        upgradeReminder(ReminderServiceType.ASSESSMENT_INVITE_B2C, LegacySeeds.REMINDER_ASSESSMENT_INVITE_B2C, ReminderMails.assessmentInviteB2c());
        upgradeReminder(ReminderServiceType.COUNSELLING_24H, LegacySeeds.REMINDER_COUNSELLING_24H, ReminderMails.counselling24h());
        upgradeReminder(ReminderServiceType.COUNSELLING_1H, LegacySeeds.REMINDER_COUNSELLING_1H, ReminderMails.counselling1h());
    }

    private void upgradeTemplate(EmailType type, String legacyBody, String subject, String body) {
        try {
            List<EmailTemplate> rows = templateRepository.findByEmailTypeOrderByNameAsc(type.name());
            for (EmailTemplate t : rows) {
                if (!isUntouched(t.getBodyTemplate(), legacyBody)) continue;
                t.setSubjectTemplate(subject); t.setBodyTemplate(body);
                templateRepository.save(t);
                logger.info("Upgraded untouched seed template {} (id {}) to the mail theme", type, t.getId());
            }
        } catch (Exception e) { logger.warn("Seed upgrade for {} skipped: {}", type, e.getMessage()); }
    }

    private void upgradeReminder(ReminderServiceType type, String legacyBody, Mail mail) {
        try {
            ReminderConfig cfg = reminderConfigService.get(type);
            if (cfg == null || !isUntouched(cfg.getBodyTemplate(), legacyBody)) return;
            reminderConfigService.updateTemplate(type, mail.getSubject(), MailShell.bodyHtml(mail), null);
            logger.info("Upgraded untouched reminder template {} to the mail theme", type);
        } catch (Exception e) { logger.warn("Reminder seed upgrade for {} skipped: {}", type, e.getMessage()); }
    }
}
