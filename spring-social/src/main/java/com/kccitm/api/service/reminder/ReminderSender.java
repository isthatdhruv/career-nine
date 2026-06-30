package com.kccitm.api.service.reminder;

import java.util.Date;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderDeliveryStatus;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.model.reminder.ReminderTriggerSource;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.email.EmailDispatchService;

/**
 * Single entry point for actually delivering a reminder email. Centralises:
 * suppression check, cap enforcement, template rendering, email send, and
 * delivery-log writing — so the schedulers and the manual-send paths produce
 * identical log rows.
 */
@Service
public class ReminderSender {

    @Autowired private ReminderConfigService configService;
    @Autowired private ReminderTemplateRenderer renderer;
    @Autowired private ReminderSuppressionService suppressionService;
    @Autowired private ReminderDeliveryLogService logService;
    @Autowired private EmailDispatchService emailDispatchService;

    public static class Context {
        public ReminderServiceType serviceType;
        public String recipient;
        public Long userStudentId;
        public Integer instituteCode;
        public Map<String, Object> variables;
        public String linkUrl;
        public Long entitlementId;
        public Long appointmentId;
        public Long assessmentMappingId;
        public ReminderTriggerSource triggeredBy = ReminderTriggerSource.SCHEDULED;
        public Long triggeredByUserId;
        /** Overrides config-saved templates when non-null (used by manual-send and test). */
        public String subjectOverride;
        public String bodyOverride;
    }

    public ReminderDeliveryLog send(Context ctx) {
        ReminderDeliveryLog log = newLog(ctx);

        ReminderConfig cfg = configService.get(ctx.serviceType);
        if (cfg == null) {
            return fail(log, "No config for service " + ctx.serviceType);
        }

        // Disabled = no-op (but we still log a CAPPED row so we know it tried).
        if (ctx.triggeredBy == ReminderTriggerSource.SCHEDULED && !Boolean.TRUE.equals(cfg.getEnabled())) {
            log.setDeliveryStatus(ReminderDeliveryStatus.CAPPED);
            log.setFailureReason("Service disabled");
            return logService.save(log);
        }

        // Per-student opt-out check.
        if (ctx.userStudentId != null && suppressionService.isSuppressed(ctx.userStudentId, ctx.serviceType)) {
            log.setDeliveryStatus(ReminderDeliveryStatus.SUPPRESSED);
            log.setFailureReason("Recipient suppressed for this service");
            return logService.save(log);
        }

        // Cap enforcement (only for scheduled sends — manual/test bypass).
        if (ctx.triggeredBy == ReminderTriggerSource.SCHEDULED) {
            Integer cap = cfg.getMaxSendsPerRecipient();
            if (cap != null && cap > 0) {
                long already = ctx.userStudentId != null
                        ? logService.countSentToStudent(ctx.serviceType, ctx.userStudentId)
                        : logService.countSentTo(ctx.serviceType, ctx.recipient);
                if (already >= cap) {
                    log.setDeliveryStatus(ReminderDeliveryStatus.CAPPED);
                    log.setFailureReason("Per-recipient cap reached (" + cap + ")");
                    return logService.save(log);
                }
            }
        }

        if (ctx.recipient == null || ctx.recipient.isEmpty()) {
            return fail(log, "No recipient email");
        }

        // Render subject + body.
        String subjectTpl = ctx.subjectOverride != null ? ctx.subjectOverride : cfg.getSubjectTemplate();
        String bodyTpl    = ctx.bodyOverride    != null ? ctx.bodyOverride    : cfg.getBodyTemplate();
        String subject = renderer.render(subjectTpl, ctx.variables);
        String body    = renderer.render(bodyTpl,    ctx.variables);
        log.setSubject(subject);
        log.setBodySnapshot(body);

        // Test sends never call the email provider.
        if (ctx.triggeredBy == ReminderTriggerSource.TEST) {
            log.setDeliveryStatus(ReminderDeliveryStatus.DRY_RUN);
            log.setSentAt(new Date());
            return logService.save(log);
        }

        try {
            EmailSendRequest req = new EmailSendRequest();
            req.setEmailType(EmailType.REMINDER);
            req.getTo().add(ctx.recipient);
            req.setSubject(subject);
            req.setHtmlContent(body);
            if (ctx.instituteCode != null) {
                req.setInstituteCode(ctx.instituteCode);
            }
            if (ctx.userStudentId != null) {
                req.setUserStudentId(ctx.userStudentId);
            }
            EmailSendResult res = emailDispatchService.send(req);
            if (res != null && res.isSuccess()) {
                log.setDeliveryStatus(ReminderDeliveryStatus.SENT);
                log.setSentAt(new Date());
                return logService.save(log);
            }
            return fail(log, res != null ? res.getError() : "dispatch failed");
        } catch (Exception e) {
            return fail(log, e.getMessage() == null ? e.toString() : e.getMessage());
        }
    }

    private ReminderDeliveryLog newLog(Context ctx) {
        ReminderDeliveryLog log = new ReminderDeliveryLog();
        log.setServiceType(ctx.serviceType);
        log.setRecipient(ctx.recipient);
        log.setUserStudentId(ctx.userStudentId);
        log.setInstituteCode(ctx.instituteCode);
        log.setLinkUrl(ctx.linkUrl);
        log.setEntitlementId(ctx.entitlementId);
        log.setAppointmentId(ctx.appointmentId);
        log.setAssessmentMappingId(ctx.assessmentMappingId);
        log.setTriggeredBy(ctx.triggeredBy);
        log.setTriggeredByUserId(ctx.triggeredByUserId);
        return log;
    }

    private ReminderDeliveryLog fail(ReminderDeliveryLog log, String reason) {
        log.setDeliveryStatus(ReminderDeliveryStatus.FAILED);
        log.setFailureReason(reason);
        return logService.save(log);
    }
}
