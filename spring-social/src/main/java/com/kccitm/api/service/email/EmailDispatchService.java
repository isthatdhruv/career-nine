package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.Date;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailDeliveryMode;
import com.kccitm.api.model.email.EmailSendLog;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.repository.email.EmailAccountRepository;
import com.kccitm.api.repository.email.EmailSendLogRepository;
import com.kccitm.api.repository.email.EmailTemplateRepository;

import java.util.Map;

/**
 * The single entry point every email in the system flows through. Resolves the sending
 * account (manual override → global default; institute default is added in Phase 2),
 * builds the message (template rendering is added in Phase 3 — Phase 1 passes the caller's
 * subject/html through), sends it on the SYNC or ASYNC path, and records an
 * {@code email_send_log} row for every send.
 */
@Service
public class EmailDispatchService {

    private static final Logger logger = LoggerFactory.getLogger(EmailDispatchService.class);

    @Autowired
    private EmailAccountRepository accountRepository;

    @Autowired
    private EmailSendLogRepository logRepository;

    @Autowired
    private SenderFactory senderFactory;

    @Autowired
    private AsyncEmailExecutor asyncExecutor;

    @Autowired
    private InstituteEmailSettingService instituteEmailSettingService;

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Autowired
    private PlaceholderResolver placeholderResolver;

    @Autowired
    private EmailTemplateRenderer templateRenderer;

    /** Convenience for the common single-recipient HTML send. */
    public EmailSendResult sendHtml(EmailType type, String to, String subject, String html) {
        return send(EmailSendRequest.html(type, to, subject, html));
    }

    /** Convenience for a single-recipient plain-text send. */
    public EmailSendResult sendText(EmailType type, String to, String subject, String text) {
        EmailSendRequest r = new EmailSendRequest();
        r.setEmailType(type);
        if (to != null) {
            r.getTo().add(to);
        }
        r.setSubject(subject);
        r.setTextContent(text);
        return send(r);
    }

    /**
     * Route a PRE-BUILT message (with attachments / cc / bcc) through the dispatcher, for
     * callers that already assemble an {@link SmtpEmailRequest}. The from-identity comes from
     * the resolved account; the message's own from-email/from-name are ignored.
     */
    public EmailSendResult send(EmailType type, SmtpEmailRequest msg, Integer instituteCode) {
        return send(type, msg, instituteCode, null);
    }

    /** As above, with a manual account override (the send-surface picker). */
    public EmailSendResult send(EmailType type, SmtpEmailRequest msg, Integer instituteCode,
                                Long overrideAccountId) {
        EmailSendRequest r = new EmailSendRequest();
        r.setEmailType(type != null ? type : EmailType.GENERIC);
        if (msg.getTo() != null) {
            r.setTo(new ArrayList<>(msg.getTo()));
        }
        if (msg.getCc() != null) {
            r.setCc(new ArrayList<>(msg.getCc()));
        }
        if (msg.getBcc() != null) {
            r.setBcc(new ArrayList<>(msg.getBcc()));
        }
        r.setSubject(msg.getSubject());
        r.setHtmlContent(msg.getHtmlContent());
        r.setTextContent(msg.getTextContent());
        if (msg.getAttachments() != null && !msg.getAttachments().isEmpty()) {
            r.setAttachments(new ArrayList<>(msg.getAttachments()));
        }
        r.setInstituteCode(instituteCode);
        r.setOverrideAccountId(overrideAccountId);
        return send(r);
    }

    public EmailSendResult send(EmailSendRequest req) {
        String recipient = firstRecipient(req);
        if (recipient == null) {
            return logSkip(req, null, "No recipient");
        }

        EmailAccount account = resolveAccount(req);
        if (account == null) {
            logger.warn("No email account configured for {} → {}", req.getEmailType(), recipient);
            return logSkip(req, null, "No email account configured");
        }

        EmailTemplate template = resolveTemplate(req);
        EmailDeliveryMode mode = resolveDeliveryMode(req, template);
        SmtpEmailRequest message = buildMessage(req, account, template);

        EmailSendLog row = saveLog(req, account, template, mode, EmailSendStatus.QUEUED, null);

        if (mode == EmailDeliveryMode.SYNC) {
            try {
                senderFactory.forAccount(account).send(message);
                row.setStatus(EmailSendStatus.SENT);
                row.setSentAt(new Date());
                logRepository.save(row);
                return EmailSendResult.sent(row.getId(), account.getId());
            } catch (Exception e) {
                logger.error("Sync email send failed ({} → {}): {}",
                        req.getEmailType(), recipient, e.getMessage(), e);
                row.setStatus(EmailSendStatus.FAILED);
                row.setErrorMessage(truncate(e.getMessage(), 2000));
                logRepository.save(row);
                return EmailSendResult.failed(row.getId(), account.getId(), e.getMessage());
            }
        }

        // ASYNC — hand off to the bounded executor; terminal status lands in the log.
        asyncExecutor.sendAsync(row.getId(), account, message);
        return EmailSendResult.queued(row.getId(), account.getId());
    }

    // ─── resolution ──────────────────────────────────────────────────────

    private EmailAccount resolveAccount(EmailSendRequest req) {
        // 1. Manual override — explicit pick at send time wins.
        EmailAccount override = activeById(req.getOverrideAccountId());
        if (override != null) {
            return override;
        }
        // 2. Institute default — the per-institute configured account (Phase 2).
        EmailAccount institute = activeById(
                instituteEmailSettingService.resolveDefaultAccountId(req.getInstituteCode()));
        if (institute != null) {
            return institute;
        }
        // 3. Global default.
        return accountRepository.findFirstByIsGlobalDefaultTrueAndActiveTrue().orElse(null);
    }

    /** Loads an account by id only if it exists and is active; null otherwise. */
    private EmailAccount activeById(Long id) {
        if (id == null) {
            return null;
        }
        return accountRepository.findById(id)
                .filter(a -> Boolean.TRUE.equals(a.getActive()))
                .orElse(null);
    }

    /**
     * Resolve the template: manual override → the send-scenario's default. Returns null when
     * no template is configured for the type, in which case the dispatcher passes the caller's
     * subject/html through unchanged (backward compatible).
     */
    private EmailTemplate resolveTemplate(EmailSendRequest req) {
        if (req.getOverrideTemplateId() != null) {
            EmailTemplate t = templateRepository.findById(req.getOverrideTemplateId()).orElse(null);
            if (t != null && Boolean.TRUE.equals(t.getActive())) {
                return t;
            }
        }
        if (req.getEmailType() != null) {
            return templateRepository
                    .findFirstByEmailTypeAndIsDefaultTrueAndActiveTrue(req.getEmailType().name())
                    .orElse(null);
        }
        return null;
    }

    private EmailDeliveryMode resolveDeliveryMode(EmailSendRequest req, EmailTemplate template) {
        if (req.getDeliveryModeOverride() != null) {
            return req.getDeliveryModeOverride();
        }
        if (template != null && template.getDeliveryMode() != null) {
            return template.getDeliveryMode();
        }
        EmailType type = req.getEmailType();
        return type != null ? type.defaultDeliveryMode() : EmailDeliveryMode.ASYNC;
    }

    /**
     * Build the message. When a template is resolved, subject + HTML are rendered from it with
     * the placeholder map; otherwise the caller's pass-through subject/html are used.
     */
    private SmtpEmailRequest buildMessage(EmailSendRequest req, EmailAccount account, EmailTemplate template) {
        SmtpEmailRequest m = new SmtpEmailRequest();
        m.setFromEmail(account.getFromEmail());
        m.setFromName(account.getFromName());
        m.setTo(new ArrayList<>(req.getTo()));
        if (req.getCc() != null) {
            m.setCc(new ArrayList<>(req.getCc()));
        }
        if (req.getBcc() != null) {
            m.setBcc(new ArrayList<>(req.getBcc()));
        }
        if (template != null) {
            Map<String, String> ctx = placeholderResolver.resolve(req);
            String subject = templateRenderer.render(template.getSubjectTemplate(), ctx);
            if (subject == null || subject.trim().isEmpty()) {
                subject = req.getSubject(); // fall back to a caller-supplied subject if the template's is blank
            }
            m.setSubject(subject);
            m.setHtmlContent(templateRenderer.render(template.getBodyTemplate(), ctx));
        } else {
            m.setSubject(req.getSubject());
            m.setHtmlContent(req.getHtmlContent());
            m.setTextContent(req.getTextContent());
        }
        if (req.getAttachments() != null && !req.getAttachments().isEmpty()) {
            m.setAttachments(new ArrayList<>(req.getAttachments()));
        }
        return m;
    }

    // ─── logging ─────────────────────────────────────────────────────────

    private EmailSendLog saveLog(EmailSendRequest req, EmailAccount account, EmailTemplate template,
                                 EmailDeliveryMode mode, EmailSendStatus status, String error) {
        EmailSendLog row = new EmailSendLog();
        row.setEmailType(req.getEmailType() != null ? req.getEmailType().name() : null);
        row.setRecipient(truncate(firstRecipient(req), 320));
        row.setSubject(truncate(req.getSubject(), 500));
        row.setAccountId(account != null ? account.getId() : null);
        row.setTemplateId(template != null ? template.getId() : null);
        row.setInstituteCode(req.getInstituteCode());
        row.setUserStudentId(req.getUserStudentId());
        row.setDeliveryMode(mode);
        row.setStatus(status);
        row.setErrorMessage(truncate(error, 2000));
        return logRepository.save(row);
    }

    private EmailSendResult logSkip(EmailSendRequest req, EmailAccount account, String reason) {
        EmailSendLog row = saveLog(req, account, null, null, EmailSendStatus.SKIPPED, reason);
        return EmailSendResult.skipped(row.getId(), reason);
    }

    private static String firstRecipient(EmailSendRequest req) {
        if (req.getTo() == null) {
            return null;
        }
        for (String to : req.getTo()) {
            if (to != null && !to.trim().isEmpty()) {
                return to.trim();
            }
        }
        return null;
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }

    // ─── send-test (used by the Accounts admin page) ─────────────────────

    /**
     * Sends a real test email through a SPECIFIC account (bypassing default resolution) so
     * an admin can verify newly-entered credentials. Synchronous so the caller sees the
     * outcome. The {@code account} may be a not-yet-persisted draft (id null).
     */
    public EmailSendResult sendTestThroughAccount(EmailAccount account, String to) {
        if (to == null || to.trim().isEmpty()) {
            return EmailSendResult.skipped(null, "No recipient");
        }
        String subject = "Career-9 email test — " + account.getName();
        String html = "<p>This is a test email from Career-9 confirming the <strong>"
                + account.getName() + "</strong> account ("
                + account.getProvider() + (account.getMode() != null ? "/" + account.getMode() : "")
                + ") can send.</p>";

        EmailSendRequest req = EmailSendRequest.html(EmailType.ACCOUNT_TEST, to, subject, html);
        req.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        SmtpEmailRequest message = buildMessage(req, account, null);

        EmailSendLog row = saveLog(req, account, null, EmailDeliveryMode.SYNC, EmailSendStatus.QUEUED, null);
        try {
            senderFactory.forAccount(account).send(message);
            row.setStatus(EmailSendStatus.SENT);
            row.setSentAt(new Date());
            logRepository.save(row);
            return EmailSendResult.sent(row.getId(), account.getId());
        } catch (Exception e) {
            logger.error("Test email failed for account {}: {}", account.getName(), e.getMessage(), e);
            row.setStatus(EmailSendStatus.FAILED);
            row.setErrorMessage(truncate(e.getMessage(), 2000));
            logRepository.save(row);
            return EmailSendResult.failed(row.getId(), account.getId(), e.getMessage());
        }
    }
}
