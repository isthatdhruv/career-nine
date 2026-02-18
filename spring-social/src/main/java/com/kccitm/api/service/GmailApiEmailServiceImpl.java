package com.kccitm.api.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.Properties;

import javax.activation.DataHandler;
import javax.mail.MessagingException;
import javax.mail.Session;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import javax.mail.util.ByteArrayDataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.kccitm.api.exception.EmailSendException;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

@Service
@Primary
public class GmailApiEmailServiceImpl implements SmtpEmailService {

    private static final Logger logger = LoggerFactory.getLogger(GmailApiEmailServiceImpl.class);

    @Value("${app.googleAPIJSON}")
    private Resource serviceAccountResource;

    @Value("${app.gmail.sender-email:notifications@career-9.net}")
    private String senderEmail;

    private Gmail getGmailService() {
        try {
            GoogleCredentials credentials = GoogleCredentials
                    .fromStream(serviceAccountResource.getInputStream())
                    .createScoped(Collections.singleton(GmailScopes.GMAIL_SEND));

            // Impersonate the sender email using domain-wide delegation
            if (credentials instanceof ServiceAccountCredentials) {
                credentials = ((ServiceAccountCredentials) credentials)
                        .createDelegated(senderEmail);
            }

            return new Gmail.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance(),
                    new HttpCredentialsAdapter(credentials))
                    .setApplicationName("Career-9")
                    .build();
        } catch (Exception e) {
            logger.error("Failed to initialize Gmail API service: {}", e.getMessage(), e);
            throw new EmailSendException("Failed to initialize Gmail API service", e);
        }
    }

    private com.google.api.services.gmail.model.Message sendRawMessage(MimeMessage mimeMessage) {
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            mimeMessage.writeTo(buffer);
            byte[] rawMessageBytes = buffer.toByteArray();
            String encodedEmail = java.util.Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(rawMessageBytes);

            com.google.api.services.gmail.model.Message message =
                    new com.google.api.services.gmail.model.Message();
            message.setRaw(encodedEmail);

            return getGmailService().users().messages().send("me", message).execute();
        } catch (IOException | MessagingException e) {
            logger.error("Failed to send email via Gmail API: {}", e.getMessage(), e);
            throw new EmailSendException("Failed to send email via Gmail API", e);
        }
    }

    @Override
    @Async
    public void sendSimpleEmail(String to, String subject, String text) {
        logger.info("Sending simple email via Gmail API to: {} with subject: {}", to, subject);

        try {
            Session session = Session.getDefaultInstance(new Properties(), null);
            MimeMessage mimeMessage = new MimeMessage(session);

            mimeMessage.setFrom(new InternetAddress(senderEmail));
            mimeMessage.addRecipient(javax.mail.Message.RecipientType.TO, new InternetAddress(to));
            mimeMessage.setSubject(subject);
            mimeMessage.setText(text);

            sendRawMessage(mimeMessage);
            logger.info("Simple email sent successfully via Gmail API to: {}", to);

        } catch (MessagingException e) {
            logger.error("Failed to send simple email to: {}. Error: {}", to, e.getMessage(), e);
            throw new EmailSendException("Failed to send email to " + to, e);
        }
    }

    @Override
    @Async
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        logger.info("Sending HTML email via Gmail API to: {} with subject: {}", to, subject);

        try {
            Session session = Session.getDefaultInstance(new Properties(), null);
            MimeMessage mimeMessage = new MimeMessage(session);

            mimeMessage.setFrom(new InternetAddress(senderEmail));
            mimeMessage.addRecipient(javax.mail.Message.RecipientType.TO, new InternetAddress(to));
            mimeMessage.setSubject(subject);
            mimeMessage.setContent(htmlContent, "text/html; charset=UTF-8");

            sendRawMessage(mimeMessage);
            logger.info("HTML email sent successfully via Gmail API to: {}", to);

        } catch (MessagingException e) {
            logger.error("Failed to send HTML email to: {}. Error: {}", to, e.getMessage(), e);
            throw new EmailSendException("Failed to send HTML email to " + to, e);
        }
    }

    @Override
    @Async
    public void sendEmail(SmtpEmailRequest emailRequest) {
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
        logger.info("Sending email via Gmail API to: {} with subject: {}", recipients, emailRequest.getSubject());

        try {
            Session session = Session.getDefaultInstance(new Properties(), null);
            MimeMessage mimeMessage = new MimeMessage(session);

            // From
            String fromEmail = emailRequest.getFromEmail() != null ? emailRequest.getFromEmail() : senderEmail;
            if (emailRequest.getFromName() != null && !emailRequest.getFromName().trim().isEmpty()) {
                mimeMessage.setFrom(new InternetAddress(fromEmail, emailRequest.getFromName()));
            } else {
                mimeMessage.setFrom(new InternetAddress(fromEmail));
            }

            // To
            for (String to : emailRequest.getTo()) {
                mimeMessage.addRecipient(javax.mail.Message.RecipientType.TO, new InternetAddress(to));
            }

            // CC
            if (emailRequest.getCc() != null) {
                for (String cc : emailRequest.getCc()) {
                    mimeMessage.addRecipient(javax.mail.Message.RecipientType.CC, new InternetAddress(cc));
                }
            }

            // BCC
            if (emailRequest.getBcc() != null) {
                for (String bcc : emailRequest.getBcc()) {
                    mimeMessage.addRecipient(javax.mail.Message.RecipientType.BCC, new InternetAddress(bcc));
                }
            }

            // Subject
            mimeMessage.setSubject(emailRequest.getSubject());

            // Content + Attachments
            boolean hasAttachments = emailRequest.getAttachments() != null && !emailRequest.getAttachments().isEmpty();

            if (hasAttachments) {
                MimeMultipart multipart = new MimeMultipart();

                // Body part
                MimeBodyPart bodyPart = new MimeBodyPart();
                if (emailRequest.getHtmlContent() != null && !emailRequest.getHtmlContent().trim().isEmpty()) {
                    bodyPart.setContent(emailRequest.getHtmlContent(), "text/html; charset=UTF-8");
                } else {
                    bodyPart.setText(emailRequest.getTextContent());
                }
                multipart.addBodyPart(bodyPart);

                // Attachment parts
                for (SmtpEmailRequest.EmailAttachment attachment : emailRequest.getAttachments()) {
                    MimeBodyPart attachmentPart = new MimeBodyPart();
                    ByteArrayDataSource dataSource = new ByteArrayDataSource(
                            attachment.getContent(), attachment.getContentType());
                    attachmentPart.setDataHandler(new DataHandler(dataSource));
                    attachmentPart.setFileName(attachment.getFilename());
                    multipart.addBodyPart(attachmentPart);
                }

                mimeMessage.setContent(multipart);
                logger.info("Added {} attachment(s) to email", emailRequest.getAttachments().size());
            } else {
                if (emailRequest.getHtmlContent() != null && !emailRequest.getHtmlContent().trim().isEmpty()) {
                    mimeMessage.setContent(emailRequest.getHtmlContent(), "text/html; charset=UTF-8");
                } else {
                    mimeMessage.setText(emailRequest.getTextContent());
                }
            }

            sendRawMessage(mimeMessage);
            logger.info("Email sent successfully via Gmail API to: {}", recipients);

        } catch (Exception e) {
            logger.error("Failed to send email to: {}. Error: {}", recipients, e.getMessage(), e);
            throw new EmailSendException("Failed to send email to " + recipients, e);
        }
    }

    @Override
    public void sendEmailWithAttachment(String to, String subject, String text,
                                        String attachmentFilename, byte[] attachmentContent,
                                        String attachmentContentType) {
        logger.info("Sending email with attachment via Gmail API to: {} (attachment: {})", to, attachmentFilename);

        SmtpEmailRequest request = new SmtpEmailRequest();
        request.getTo().add(to);
        request.setSubject(subject);
        request.setTextContent(text);

        SmtpEmailRequest.EmailAttachment attachment = new SmtpEmailRequest.EmailAttachment(
                attachmentFilename, attachmentContent, attachmentContentType);
        request.getAttachments().add(attachment);

        sendEmail(request);
    }
}
