package com.kccitm.api.service;

import com.kccitm.api.exception.EmailSendException;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import javax.mail.util.ByteArrayDataSource;

@Service
public class SmtpEmailServiceImpl implements SmtpEmailService {

    private static final Logger logger = LoggerFactory.getLogger(SmtpEmailServiceImpl.class);

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String defaultFromEmail;

    @Override
    public void sendSimpleEmail(String to, String subject, String text) {
        logger.info("Sending simple email to: {} with subject: {}", to, subject);

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(defaultFromEmail);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);

            mailSender.send(message);
            logger.info("Simple email sent successfully to: {}", to);

        } catch (Exception e) {
            logger.error("Failed to send simple email to: {}. Error: {}", to, e.getMessage(), e);
            throw new EmailSendException("Failed to send email to " + to, e);
        }
    }

    @Override
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        logger.info("Sending HTML email to: {} with subject: {}", to, subject);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(defaultFromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            logger.info("HTML email sent successfully to: {}", to);

        } catch (MessagingException e) {
            logger.error("Failed to send HTML email to: {}. Error: {}", to, e.getMessage(), e);
            throw new EmailSendException("Failed to send HTML email to " + to, e);
        }
    }

    @Override
    public void sendEmail(SmtpEmailRequest emailRequest) {
        // Validation
        if (emailRequest.getTo() == null || emailRequest.getTo().isEmpty()) {
            throw new EmailSendException("Email recipient list cannot be empty");
        }
        if (emailRequest.getSubject() == null || emailRequest.getSubject().trim().isEmpty()) {
            throw new EmailSendException("Email subject cannot be empty");
        }
        if (emailRequest.getTextContent() == null && emailRequest.getHtmlContent() == null) {
            throw new EmailSendException("Email must have either text or HTML content");
        }

        String recipients = String.join(", ", emailRequest.getTo());
        logger.info("Sending email to: {} with subject: {}", recipients, emailRequest.getSubject());

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            // From
            String fromEmail = emailRequest.getFromEmail() != null ?
                               emailRequest.getFromEmail() : defaultFromEmail;
            if (emailRequest.getFromName() != null && !emailRequest.getFromName().trim().isEmpty()) {
                helper.setFrom(fromEmail, emailRequest.getFromName());
            } else {
                helper.setFrom(fromEmail);
            }

            // Recipients
            helper.setTo(emailRequest.getTo().toArray(new String[0]));
            if (emailRequest.getCc() != null && !emailRequest.getCc().isEmpty()) {
                helper.setCc(emailRequest.getCc().toArray(new String[0]));
            }
            if (emailRequest.getBcc() != null && !emailRequest.getBcc().isEmpty()) {
                helper.setBcc(emailRequest.getBcc().toArray(new String[0]));
            }

            // Subject
            helper.setSubject(emailRequest.getSubject());

            // Content (HTML with text fallback)
            if (emailRequest.getHtmlContent() != null && !emailRequest.getHtmlContent().trim().isEmpty()) {
                String textFallback = emailRequest.getTextContent() != null ?
                                     emailRequest.getTextContent() :
                                     "Please view this email in an HTML-capable client.";
                helper.setText(textFallback, emailRequest.getHtmlContent());
            } else {
                helper.setText(emailRequest.getTextContent(), false);
            }

            // Attachments
            if (emailRequest.getAttachments() != null && !emailRequest.getAttachments().isEmpty()) {
                for (SmtpEmailRequest.EmailAttachment attachment : emailRequest.getAttachments()) {
                    ByteArrayDataSource dataSource = new ByteArrayDataSource(
                        attachment.getContent(),
                        attachment.getContentType()
                    );
                    helper.addAttachment(attachment.getFilename(), dataSource);
                }
                logger.info("Added {} attachment(s) to email", emailRequest.getAttachments().size());
            }

            mailSender.send(message);
            logger.info("Email sent successfully to: {}", recipients);

        } catch (MessagingException e) {
            logger.error("Failed to send email to: {}. Error: {}", recipients, e.getMessage(), e);
            throw new EmailSendException("Failed to send email to " + recipients, e);
        } catch (Exception e) {
            logger.error("Unexpected error sending email to: {}. Error: {}", recipients, e.getMessage(), e);
            throw new EmailSendException("Unexpected error sending email to " + recipients, e);
        }
    }

    @Override
    public void sendEmailWithAttachment(String to, String subject, String text,
                                       String attachmentFilename, byte[] attachmentContent,
                                       String attachmentContentType) {
        logger.info("Sending email with attachment to: {} (attachment: {})", to, attachmentFilename);

        SmtpEmailRequest request = new SmtpEmailRequest();
        request.getTo().add(to);
        request.setSubject(subject);
        request.setTextContent(text);

        SmtpEmailRequest.EmailAttachment attachment = new SmtpEmailRequest.EmailAttachment(
            attachmentFilename, attachmentContent, attachmentContentType
        );
        request.getAttachments().add(attachment);

        sendEmail(request);
    }
}
