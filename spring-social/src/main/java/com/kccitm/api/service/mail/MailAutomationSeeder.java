package com.kccitm.api.service.mail;

import java.util.Arrays;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailAutomationDelivery;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailPredicate;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.repository.mail.MailAutomationRepository;

/**
 * Seeds one automation per scheduled mail the code sends today, so switching the engine on
 * reproduces current behaviour and the admin has real rows to edit. Idempotent on
 * {@code automation_key}. Runs after the template seeders so templates can be linked.
 *
 * <p>Enabled by default only where the engine takes over an email-only scheduler when it is
 * switched on (the hourly assessment-invite nudge). Automations that would duplicate a
 * scheduler still running in code (WhatsApp-first counselling reminders) or that the code
 * never sends today are seeded disabled, with a description saying so.
 */
@Component
@Order(300)
public class MailAutomationSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(MailAutomationSeeder.class);

    @Autowired private MailAutomationRepository repository;
    @Autowired private EmailTemplateRepository templateRepository;
    @Autowired private MailAutomationService service;

    @Override
    public void run(ApplicationArguments args) {
        try {
            seedAll();
        } catch (Exception e) {
            logger.warn("Could not seed mail automations: {}", e.getMessage());
        }
    }

    void seedAll() {
        int n = 0;
        n += seed(base("b2c.assessment_invite_nudge", "Assessment invite nudge",
                "Replaces the hourly EntitlementSchedulerService job. 24 hours after access is granted and every 24 hours "
                + "after, while the assessment is not started, at most 2 times. Stops when the assessment starts.",
                MailEvent.ENTITLEMENT_GRANTED)
                .conditions(MailPredicate.ASSESSMENT_NOT_STARTED, MailPredicate.ENTITLEMENT_ACTIVE)
                .delay(1440).repeat(1440, 2).recheck()
                .cancelOn(MailEvent.ASSESSMENT_STARTED, MailEvent.ASSESSMENT_COMPLETED)
                .template("b2c.resend_assessment_invite").roles(MailRecipientRole.STUDENT)
                .enabled(true).build()) ? 1 : 0;

        n += seed(base("school.assessment_mapping_reminder", "School assessment reminder",
                "The reminder the disabled AssessmentMappingReminderSchedulerService used to send: 3 days after a school "
                + "assigns an assessment and every 3 days after, while not started, at most 3 times. Seeded disabled "
                + "because that scheduler is switched off in code today.",
                MailEvent.ASSESSMENT_MAPPED)
                .conditions(MailPredicate.ASSESSMENT_NOT_STARTED)
                .delay(4320).repeat(4320, 3).recheck()
                .cancelOn(MailEvent.ASSESSMENT_STARTED, MailEvent.ASSESSMENT_COMPLETED)
                .template("reminder.assessment_mapping").roles(MailRecipientRole.STUDENT)
                .enabled(false).build()) ? 1 : 0;

        n += seed(base("counselling.booking_nudge", "Counselling booking nudge",
                "One nudge 24 hours after access is granted when the plan includes counselling and nothing is booked. "
                + "The 10:30 ReminderSchedulerService job still sends this today (WhatsApp first); enable this only "
                + "once that job is retired, or both will send.",
                MailEvent.ENTITLEMENT_GRANTED)
                .conditions(MailPredicate.HAS_COUNSELLING_SESSIONS, MailPredicate.COUNSELLING_NOT_BOOKED)
                .delay(1440).max(1).recheck()
                .cancelOn(MailEvent.APPOINTMENT_CONFIRMED)
                .template("counselling.booking_nudge").roles(MailRecipientRole.STUDENT)
                .enabled(false).build()) ? 1 : 0;

        n += seed(base("counselling.session_reminders", "Counselling session reminders",
                "Reminders 12h, 4h, 2h and 15 minutes before a confirmed session, to student and parent, cancelled if "
                + "the session is cancelled or moved. The 5-minute ReminderSchedulerService job still sends these today "
                + "(WhatsApp first); enable this only once that job is retired.",
                MailEvent.APPOINTMENT_CONFIRMED, MailEvent.APPOINTMENT_RESCHEDULED)
                .conditions(MailPredicate.APPOINTMENT_STILL_SCHEDULED)
                .relative("session_start", -720, -240, -120, -15).recheck()
                .cancelOn(MailEvent.APPOINTMENT_CANCELLED, MailEvent.APPOINTMENT_RESCHEDULED)
                .template("counselling.reminder_student").roles(MailRecipientRole.STUDENT, MailRecipientRole.PARENT)
                .enabled(false).build()) ? 1 : 0;

        n += seed(base("payment.pending_reminder", "Payment pending reminder",
                "Not sent automatically today (admins press the nudge button). 20 hours after a payment link is created, "
                + "if still unpaid, one reminder. Enable to start.",
                MailEvent.PAYMENT_LINK_CREATED)
                .conditions(MailPredicate.PAYMENT_STILL_PENDING)
                .delay(1200).max(1).recheck()
                .cancelOn(MailEvent.PAYMENT_SUCCEEDED)
                .template("payment.reminder").roles(MailRecipientRole.STUDENT)
                .enabled(false).build()) ? 1 : 0;

        n += seed(base("report.counselling_followup", "Book a session after the report",
                "Not sent today. 3 days after a report is ready, if the plan includes counselling and nothing is booked, "
                + "one invitation to book. Subscribed mail: needs the opt-in phase before enabling.",
                MailEvent.REPORT_READY)
                .conditions(MailPredicate.HAS_COUNSELLING_SESSIONS, MailPredicate.COUNSELLING_NOT_BOOKED)
                .delay(4320).max(1).recheck()
                .cancelOn(MailEvent.APPOINTMENT_CONFIRMED)
                .template("counselling.booking_nudge").roles(MailRecipientRole.STUDENT)
                .enabled(false).build()) ? 1 : 0;

        if (n > 0) logger.info("Seeded {} mail automation(s)", n);
    }

    private boolean seed(MailAutomation a) {
        if (repository.existsByAutomationKey(a.getAutomationKey())) return false;
        service.seed(a);
        return true;
    }

    private Builder base(String key, String name, String description, MailEvent... triggers) {
        Builder b = new Builder();
        b.a.setAutomationKey(key);
        b.a.setName(name);
        b.a.setDescription(description);
        String[] keys = new String[triggers.length];
        for (int i = 0; i < triggers.length; i++) keys[i] = triggers[i].key();
        b.a.setTriggerEvents(MailAutomation.listToCsv(Arrays.asList(keys)));
        b.a.setDeliveryMode(MailAutomationDelivery.QUEUED);
        return b;
    }

    private final class Builder {
        final MailAutomation a = new MailAutomation();

        Builder conditions(MailPredicate... p) {
            String[] keys = new String[p.length];
            for (int i = 0; i < p.length; i++) keys[i] = p[i].key();
            a.setConditions(MailAutomation.listToCsv(Arrays.asList(keys)));
            return this;
        }
        Builder delay(int minutes) { a.setDelayMinutes(minutes); return this; }
        Builder repeat(int everyMinutes, int maxSends) { a.setRepeatEveryMinutes(everyMinutes); a.setMaxSends(maxSends); return this; }
        Builder max(int maxSends) { a.setMaxSends(maxSends); return this; }
        Builder relative(String field, Integer... offsets) {
            a.setRelativeToField(field);
            a.setRelativeOffsetsMinutes(MailAutomation.listToCsv(Arrays.asList(offsets)));
            return this;
        }
        Builder recheck() { a.setRecheckBeforeSend(true); return this; }
        Builder cancelOn(MailEvent... events) {
            String[] keys = new String[events.length];
            for (int i = 0; i < events.length; i++) keys[i] = events[i].key();
            a.setCancelOnEvents(MailAutomation.listToCsv(Arrays.asList(keys)));
            return this;
        }
        Builder template(String mailKey) {
            List<EmailTemplate> rows = templateRepository.findByMailKey(mailKey);
            if (rows != null && !rows.isEmpty()) {
                a.setTemplateId(rows.get(0).getId());
                a.setEmailType(rows.get(0).getEmailType());
            } else {
                logger.warn("Seeded automation {} has no template '{}' yet", a.getAutomationKey(), mailKey);
            }
            return this;
        }
        Builder roles(MailRecipientRole... roles) {
            String[] keys = new String[roles.length];
            for (int i = 0; i < roles.length; i++) keys[i] = roles[i].name();
            a.setRecipientRoles(MailAutomation.listToCsv(Arrays.asList(keys)));
            return this;
        }
        Builder enabled(boolean enabled) { a.setEnabled(enabled); return this; }
        MailAutomation build() { return a; }
    }
}
