package com.kccitm.api.service.b2c.report.pipeline;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Collections;
import java.util.Properties;

import javax.activation.DataHandler;
import javax.mail.Message.RecipientType;
import javax.mail.Session;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import javax.mail.util.ByteArrayDataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;

/**
 * Default {@link EmailSender} — sends the co-branded report email through the
 * Gmail API over HTTPS, the same channel as the platform's registration mail
 * ({@code GmailApiEmailServiceImpl}). We use the Gmail API rather than raw SMTP
 * because this host (DigitalOcean) blocks outbound SMTP ports (25/465/587), so a
 * {@code smtp.gmail.com:587} connection just times out.
 *
 * <p>This is a deliberately <b>synchronous</b> twin of {@code GmailApiEmailServiceImpl}
 * (which is {@code @Async} / fire-and-forget). The report worker's only job is
 * generating + emailing reports, so it blocks on the send and <b>throws on
 * failure</b> — that's what lets the email consumer mark the job sent (and commit
 * the Kafka offset) only on a real delivery, preserving the retry → DLT guarantee.
 *
 * <p>From = {@code app.gmail.sender-email} (GMAIL_SENDER, e.g. aspire@career-9.net)
 * impersonated via the service account's domain-wide delegation; only the friendly
 * display name is customised for whitelabel ("{School} (via Career-9)").
 *
 * <p>Active by default; set {@code report.pipeline.email-transport=odoo} to route
 * through Odoo instead ({@link OdooEmailSender}).
 */
@Component
@ConditionalOnProperty(name = "report.pipeline.email-transport", havingValue = "gmail", matchIfMissing = true)
public class GmailReportEmailSender implements EmailSender {

    private static final Logger logger = LoggerFactory.getLogger(GmailReportEmailSender.class);

    /** Service account JSON bundled on the classpath (same one the Firebase/Gmail API uses). */
    @Value("classpath:firebase-service-account.json")
    private Resource serviceAccountResource;

    /** Impersonated sender (domain-wide delegation). GMAIL_SENDER, e.g. aspire@career-9.net. */
    @Value("${app.gmail.sender-email:notifications@career-9.net}")
    private String senderEmail;

    @Autowired private ReportEmailComposer composer;

    @Override
    public void sendReportEmail(ReportEmailEvent event, byte[] pdfBytes) throws Exception {
        String subject = composer.subject(event);
        String html = composer.html(event);
        String fromName = (event.whitelabel && event.schoolName != null && !event.schoolName.isEmpty())
                ? event.schoolName + " (via Career-9)"
                : null;
        boolean withPdf = pdfBytes != null && pdfBytes.length > 0 && !event.linkOnly;

        MimeMessage mime = new MimeMessage(Session.getDefaultInstance(new Properties(), null));
        mime.setFrom(fromName != null
                ? new InternetAddress(senderEmail, fromName)
                : new InternetAddress(senderEmail));
        mime.addRecipient(RecipientType.TO, new InternetAddress(event.recipientEmail));
        mime.setSubject(subject);

        if (withPdf) {
            MimeMultipart multipart = new MimeMultipart();
            MimeBodyPart body = new MimeBodyPart();
            body.setContent(html, "text/html; charset=UTF-8");
            multipart.addBodyPart(body);

            MimeBodyPart attachment = new MimeBodyPart();
            attachment.setDataHandler(new DataHandler(new ByteArrayDataSource(pdfBytes, "application/pdf")));
            attachment.setFileName("Career-9-Report.pdf");
            multipart.addBodyPart(attachment);

            mime.setContent(multipart);
        } else {
            mime.setContent(html, "text/html; charset=UTF-8");
        }

        // Synchronous send — any failure propagates so the consumer retries → DLT.
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        mime.writeTo(buffer);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.toByteArray());
        com.google.api.services.gmail.model.Message gmailMessage =
                new com.google.api.services.gmail.model.Message().setRaw(raw);

        gmailService().users().messages().send("me", gmailMessage).execute();

        logger.info("Report email sent (Gmail API, sync) to {} student={} assessment={} withPdf={}",
                event.recipientEmail, event.userStudentId, event.assessmentId, withPdf);
    }

    /** Builds a Gmail client impersonating {@link #senderEmail} via domain-wide delegation. */
    private Gmail gmailService() throws Exception {
        GoogleCredentials credentials = GoogleCredentials
                .fromStream(serviceAccountResource.getInputStream())
                .createScoped(Collections.singleton(GmailScopes.GMAIL_SEND));
        if (credentials instanceof ServiceAccountCredentials) {
            credentials = ((ServiceAccountCredentials) credentials).createDelegated(senderEmail);
        }
        return new Gmail.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(credentials))
                .setApplicationName("Career-9")
                .build();
    }
}
