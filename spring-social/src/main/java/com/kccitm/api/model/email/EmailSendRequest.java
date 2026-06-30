package com.kccitm.api.model.email;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

/**
 * Input to {@code EmailDispatchService.send(...)} — the single entry point every email
 * flows through. The dispatcher resolves the sending account + template, renders, sends,
 * and logs.
 *
 * <p>Phase 1 is content pass-through: callers supply {@link #subject} / {@link #htmlContent}
 * directly. Phases 3+ resolve these from a DB template using {@link #userStudentId} and the
 * placeholder catalog, at which point callers pass a context map instead.
 */
public class EmailSendRequest {

    private EmailType emailType = EmailType.GENERIC;
    private List<String> to = new ArrayList<>();
    private List<String> cc = new ArrayList<>();
    private List<String> bcc = new ArrayList<>();

    /** Pass-through content (Phase 1); later rendered from the resolved template. */
    private String subject;
    private String htmlContent;
    private String textContent;

    /** Manual pick — wins over institute/global default account (Phase 2 surfaces). */
    private Long overrideAccountId;
    /** Manual pick — wins over the send-scenario default template (Phase 3 surfaces). */
    private Long overrideTemplateId;
    /** Drives the institute-default account lookup (Phase 2). */
    private Integer instituteCode;
    /** For logging + placeholder resolution (Phase 3). */
    private Long userStudentId;
    /** Optional explicit delivery mode; else template / EmailType default. */
    private EmailDeliveryMode deliveryModeOverride;

    /** Per-send placeholder values (e.g. "username" → "asha01") merged by the resolver (Phase 3). */
    private Map<String, String> templateContext = new HashMap<>();

    private List<SmtpEmailRequest.EmailAttachment> attachments = new ArrayList<>();

    public EmailSendRequest() {
    }

    /** Convenience for the common single-recipient pass-through send. */
    public static EmailSendRequest html(EmailType type, String to, String subject, String htmlContent) {
        EmailSendRequest r = new EmailSendRequest();
        r.emailType = type;
        if (to != null) {
            r.to.add(to);
        }
        r.subject = subject;
        r.htmlContent = htmlContent;
        return r;
    }

    public EmailType getEmailType() { return emailType; }
    public void setEmailType(EmailType emailType) { this.emailType = emailType; }
    public List<String> getTo() { return to; }
    public void setTo(List<String> to) { this.to = to; }
    public List<String> getCc() { return cc; }
    public void setCc(List<String> cc) { this.cc = cc; }
    public List<String> getBcc() { return bcc; }
    public void setBcc(List<String> bcc) { this.bcc = bcc; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getHtmlContent() { return htmlContent; }
    public void setHtmlContent(String htmlContent) { this.htmlContent = htmlContent; }
    public String getTextContent() { return textContent; }
    public void setTextContent(String textContent) { this.textContent = textContent; }
    public Long getOverrideAccountId() { return overrideAccountId; }
    public void setOverrideAccountId(Long overrideAccountId) { this.overrideAccountId = overrideAccountId; }
    public Long getOverrideTemplateId() { return overrideTemplateId; }
    public void setOverrideTemplateId(Long overrideTemplateId) { this.overrideTemplateId = overrideTemplateId; }
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }
    public EmailDeliveryMode getDeliveryModeOverride() { return deliveryModeOverride; }
    public void setDeliveryModeOverride(EmailDeliveryMode deliveryModeOverride) { this.deliveryModeOverride = deliveryModeOverride; }
    public Map<String, String> getTemplateContext() { return templateContext; }
    public void setTemplateContext(Map<String, String> templateContext) {
        this.templateContext = templateContext != null ? templateContext : new HashMap<>();
    }
    /** Fluent helper to add a single placeholder value. */
    public EmailSendRequest put(String key, String value) {
        if (key != null) {
            this.templateContext.put(key, value);
        }
        return this;
    }
    public List<SmtpEmailRequest.EmailAttachment> getAttachments() { return attachments; }
    public void setAttachments(List<SmtpEmailRequest.EmailAttachment> attachments) { this.attachments = attachments; }
}
