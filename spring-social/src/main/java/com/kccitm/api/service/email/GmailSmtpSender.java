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

        // Blank (not just null) host/port/username fall back to sane Gmail defaults —
        // otherwise an empty host makes JavaMail dial localhost:0.
        String host = notBlank(creds.getSmtpHost()) ? creds.getSmtpHost().trim() : "smtp.gmail.com";
        int port = (creds.getSmtpPort() != null && creds.getSmtpPort() > 0) ? creds.getSmtpPort() : 587;
        String username = notBlank(creds.getSmtpUsername()) ? creds.getSmtpUsername().trim() : account.getFromEmail();

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(creds.getSmtpPassword());
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        // Fail fast (~10s) instead of hanging when the port is unreachable — e.g.
        // DigitalOcean blocks outbound SMTP 25/465/587, so use Gmail API mode there.
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        if (port == 465) {
            // Port 465 = implicit TLS (SMTPS): TLS on connect, NOT STARTTLS.
            props.put("mail.smtp.ssl.enable", "true");
        } else {
            // Port 587 (and others) = STARTTLS upgrade.
            boolean starttls = creds.getSmtpStarttls() == null || creds.getSmtpStarttls();
            props.put("mail.smtp.starttls.enable", String.valueOf(starttls));
        }
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

    private static boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
