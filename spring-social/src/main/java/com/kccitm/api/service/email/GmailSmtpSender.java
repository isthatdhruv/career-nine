package com.kccitm.api.service.email;

import java.util.Properties;

import javax.mail.internet.MimeMessage;
import javax.mail.util.ByteArrayDataSource;

import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailAccountCredentials;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

/**
 * Per-account SMTP sender (Gmail SMTP app-password mode) — generalizes
 * {@code SmtpEmailServiceImpl}, building a dedicated {@link JavaMailSenderImpl} from the
 * account's host/port/username/password. NOTE: outbound SMTP ports are blocked on
 * DigitalOcean, so this mode is for dev / hosts with port-587 egress; production Gmail
 * accounts should use API mode.
 */
public class GmailSmtpSender implements ConfiguredEmailSender {

    private final String fromEmail;
    private final String fromName;
    private final JavaMailSenderImpl mailSender;

    GmailSmtpSender(EmailAccount account, EmailAccountCredentials creds) {
        this.fromEmail = account.getFromEmail();
        this.fromName = account.getFromName();

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(creds.getSmtpHost() != null ? creds.getSmtpHost() : "smtp.gmail.com");
        sender.setPort(creds.getSmtpPort() != null ? creds.getSmtpPort() : 587);
        sender.setUsername(creds.getSmtpUsername() != null ? creds.getSmtpUsername() : account.getFromEmail());
        sender.setPassword(creds.getSmtpPassword());
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        boolean starttls = creds.getSmtpStarttls() == null || creds.getSmtpStarttls();
        props.put("mail.smtp.starttls.enable", String.valueOf(starttls));
        this.mailSender = sender;
    }

    @Override
    public void send(SmtpEmailRequest req) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        String from = req.getFromEmail() != null ? req.getFromEmail() : fromEmail;
        String name = req.getFromName() != null ? req.getFromName() : fromName;
        if (name != null && !name.trim().isEmpty()) {
            helper.setFrom(from, name);
        } else {
            helper.setFrom(from);
        }
        helper.setTo(req.getTo().toArray(new String[0]));
        if (req.getCc() != null && !req.getCc().isEmpty()) {
            helper.setCc(req.getCc().toArray(new String[0]));
        }
        if (req.getBcc() != null && !req.getBcc().isEmpty()) {
            helper.setBcc(req.getBcc().toArray(new String[0]));
        }
        helper.setSubject(req.getSubject() != null ? req.getSubject() : "");

        if (req.getHtmlContent() != null && !req.getHtmlContent().trim().isEmpty()) {
            String fallback = req.getTextContent() != null ? req.getTextContent()
                    : "Please view this email in an HTML-capable client.";
            helper.setText(fallback, req.getHtmlContent());
        } else {
            helper.setText(req.getTextContent() != null ? req.getTextContent() : "", false);
        }

        if (req.getAttachments() != null && !req.getAttachments().isEmpty()) {
            for (SmtpEmailRequest.EmailAttachment att : req.getAttachments()) {
                helper.addAttachment(att.getFilename(),
                        new ByteArrayDataSource(att.getContent(), att.getContentType()));
            }
        }
        mailSender.send(message);
    }
}
