package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;
import java.util.List;

public class EmailMessage {
    private String fromEmail;
    private String fromName;

    private List<String> to = new ArrayList<>();
    private List<String> cc = new ArrayList<>();

    private String subject;
    private String templateName;

    private String attachmentName;
    private String attachmentContent;

    public EmailMessage(String fromEmail, String fromName, List<String> to, String subject, String templateName) {
        this.to = to;
        this.subject = subject;
        this.fromName = fromName;
        this.fromEmail = fromEmail;
        this.templateName = templateName;
    }

    public void setTo(List<String> to) {
        this.to = to;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    public void setFromEmail(String fromEmail) {
        this.fromEmail = fromEmail;
    }

    public void setCc(List<String> cc) {
        this.cc = cc;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public void setAttachmentName(String attachmentName) {
        this.attachmentName = attachmentName;
    }

    public void setAttachmentContent(String attachmentContent) {
        this.attachmentContent = attachmentContent;
    }

    public List<String> getTo() {
        return to;
    }

    public String getSubject() {
        return subject;
    }

    public String getFromName() {
        return fromName;
    }

    public String getFromEmail() {
        return fromEmail;
    }

    public List<String> getCc() {
        return cc;
    }

    public String getTemplateName() {
        return templateName;
    }

    public String getAttachmentName() {
        return attachmentName;
    }

    public String getAttachmentContent() {
        return attachmentContent;
    }
}
