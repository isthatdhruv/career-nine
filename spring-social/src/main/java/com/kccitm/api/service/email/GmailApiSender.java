package com.kccitm.api.service.email;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.Properties;

import javax.activation.DataHandler;
import javax.mail.Message;
import javax.mail.Session;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import javax.mail.util.ByteArrayDataSource;

import org.springframework.core.io.Resource;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailAccountCredentials;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

/**
 * Per-account Gmail API sender — generalizes {@code GmailApiEmailServiceImpl} to take its
 * service-account credentials + impersonated user from the account config instead of a
 * single classpath file + env var. When the account has no explicit service-account JSON
 * (the bootstrap default), it falls back to the bundled {@code firebase-service-account.json}.
 */
public class GmailApiSender implements ConfiguredEmailSender {

    private final String fromEmail;
    private final String fromName;
    private final Gmail gmail;

    GmailApiSender(EmailAccount account, EmailAccountCredentials creds, Resource classpathServiceAccount) {
        this.fromEmail = account.getFromEmail();
        this.fromName = account.getFromName();
        this.gmail = buildGmail(account, creds, classpathServiceAccount);
    }

    private static Gmail buildGmail(EmailAccount account, EmailAccountCredentials creds,
                                    Resource classpathServiceAccount) {
        try {
            InputStream in;
            if (creds.getServiceAccountJson() != null && !creds.getServiceAccountJson().trim().isEmpty()) {
                in = new ByteArrayInputStream(creds.getServiceAccountJson().getBytes(StandardCharsets.UTF_8));
            } else {
                in = classpathServiceAccount.getInputStream();
            }
            GoogleCredentials credentials = GoogleCredentials.fromStream(in)
                    .createScoped(Collections.singleton(GmailScopes.GMAIL_SEND));
            String delegated = (creds.getDelegatedUser() != null && !creds.getDelegatedUser().trim().isEmpty())
                    ? creds.getDelegatedUser() : account.getFromEmail();
            if (credentials instanceof ServiceAccountCredentials) {
                credentials = ((ServiceAccountCredentials) credentials).createDelegated(delegated);
            }
            return new Gmail.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance(),
                    new HttpCredentialsAdapter(credentials))
                    .setApplicationName("Career-9")
                    .build();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to init Gmail API client for account "
                    + account.getId(), e);
        }
    }

    @Override
    public void send(SmtpEmailRequest req) throws Exception {
        Session session = Session.getDefaultInstance(new Properties(), null);
        MimeMessage msg = new MimeMessage(session);

        String from = req.getFromEmail() != null ? req.getFromEmail() : fromEmail;
        String name = req.getFromName() != null ? req.getFromName() : fromName;
        if (name != null && !name.trim().isEmpty()) {
            msg.setFrom(new InternetAddress(from, name));
        } else {
            msg.setFrom(new InternetAddress(from));
        }
        for (String to : req.getTo()) {
            msg.addRecipient(Message.RecipientType.TO, new InternetAddress(to));
        }
        if (req.getCc() != null) {
            for (String cc : req.getCc()) {
                msg.addRecipient(Message.RecipientType.CC, new InternetAddress(cc));
            }
        }
        if (req.getBcc() != null) {
            for (String bcc : req.getBcc()) {
                msg.addRecipient(Message.RecipientType.BCC, new InternetAddress(bcc));
            }
        }
        msg.setSubject(req.getSubject() != null ? req.getSubject() : "");

        boolean hasAttachments = req.getAttachments() != null && !req.getAttachments().isEmpty();
        if (hasAttachments) {
            MimeMultipart multipart = new MimeMultipart();
            MimeBodyPart body = new MimeBodyPart();
            if (req.getHtmlContent() != null && !req.getHtmlContent().trim().isEmpty()) {
                body.setContent(req.getHtmlContent(), "text/html; charset=UTF-8");
            } else {
                body.setText(req.getTextContent() != null ? req.getTextContent() : "");
            }
            multipart.addBodyPart(body);
            for (SmtpEmailRequest.EmailAttachment att : req.getAttachments()) {
                MimeBodyPart part = new MimeBodyPart();
                ByteArrayDataSource ds = new ByteArrayDataSource(att.getContent(), att.getContentType());
                part.setDataHandler(new DataHandler(ds));
                part.setFileName(att.getFilename());
                multipart.addBodyPart(part);
            }
            msg.setContent(multipart);
        } else if (req.getHtmlContent() != null && !req.getHtmlContent().trim().isEmpty()) {
            msg.setContent(req.getHtmlContent(), "text/html; charset=UTF-8");
        } else {
            msg.setText(req.getTextContent() != null ? req.getTextContent() : "");
        }

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        msg.writeTo(buffer);
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.toByteArray());
        com.google.api.services.gmail.model.Message gmailMsg = new com.google.api.services.gmail.model.Message();
        gmailMsg.setRaw(encoded);
        gmail.users().messages().send("me", gmailMsg).execute();
    }
}
