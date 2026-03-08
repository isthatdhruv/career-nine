package com.kccitm.api.service;

import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

public interface SmtpEmailService {

    /**
     * Send a simple text email
     */
    void sendSimpleEmail(String to, String subject, String text);

    /**
     * Send an HTML email
     */
    void sendHtmlEmail(String to, String subject, String htmlContent);

    /**
     * Send a comprehensive email using SmtpEmailRequest
     * Supports multiple recipients, CC, BCC, attachments, and HTML/text content
     */
    void sendEmail(SmtpEmailRequest emailRequest);

    /**
     * Send email with attachment (convenience method)
     */
    void sendEmailWithAttachment(String to, String subject, String text,
                                 String attachmentFilename, byte[] attachmentContent,
                                 String attachmentContentType);
}
