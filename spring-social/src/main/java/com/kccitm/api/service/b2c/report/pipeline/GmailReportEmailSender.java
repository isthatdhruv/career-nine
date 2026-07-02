package com.kccitm.api.service.b2c.report.pipeline;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
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
import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailDeliveryMode;
import com.kccitm.api.model.email.EmailSendLog;
import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.repository.email.EmailAccountRepository;
import com.kccitm.api.repository.email.EmailSendLogRepository;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import com.kccitm.api.service.email.EmailTemplateRenderer;
import com.kccitm.api.service.email.SenderFactory;

/**
 * Default {@link EmailSender} for the report worker. Sends the report email through the
 * <b>resolved sending account</b> ({@link ReportEmailEvent#emailAccountId}, institute default →
 * global default, stamped at produce-time) via {@link SenderFactory} — the same per-account
 * transport (Gmail-API / Gmail-SMTP / Odoo) the rest of the platform uses. When a
 * {@code REPORT_READY} template is configured ({@link ReportEmailEvent#emailTemplateId}) the
 * subject + body are rendered from it; otherwise the built-in {@link ReportEmailComposer} HTML
 * is used. Every send writes an {@code email_send_log} row.
 *
 * <p>Deliberately <b>synchronous</b> and <b>throws on failure</b> — that's what lets the email
 * consumer commit the Kafka offset only on a real delivery, preserving retry → DLT. If no
 * account resolves (e.g. none seeded), it falls back to the legacy classpath Gmail send below.
 *
 * <p>Active by default; set {@code report.pipeline.email-transport=odoo} to route through Odoo.
 */
@Component
@ConditionalOnProperty(name = "report.pipeline.email-transport", havingValue = "gmail", matchIfMissing = true)
public class GmailReportEmailSender implements EmailSender {

    private static final Logger logger = LoggerFactory.getLogger(GmailReportEmailSender.class);

    /** Service account JSON bundled on the classpath (used only by the legacy fallback path). */
    @Value("classpath:firebase-service-account.json")
    private Resource serviceAccountResource;

    /** Legacy impersonated sender (domain-wide delegation) used only when no account resolves. */
    @Value("${app.gmail.sender-email:notifications@career-9.net}")
    private String senderEmail;

    @Autowired private ReportEmailComposer composer;
    @Autowired private EmailAccountRepository accountRepository;
    @Autowired private EmailTemplateRepository templateRepository;
    @Autowired private EmailSendLogRepository logRepository;
    @Autowired private SenderFactory senderFactory;
    @Autowired private EmailTemplateRenderer templateRenderer;
    @Autowired private InstituteBrandingService brandingService;

    @Override
    public void sendReportEmail(ReportEmailEvent event, byte[] pdfBytes) throws Exception {
        EmailAccount account = event.emailAccountId != null
                ? accountRepository.findById(event.emailAccountId)
                        .filter(a -> Boolean.TRUE.equals(a.getActive())).orElse(null)
                : null;
        EmailTemplate template = event.emailTemplateId != null
                ? templateRepository.findById(event.emailTemplateId)
                        .filter(t -> Boolean.TRUE.equals(t.getActive())).orElse(null)
                : null;

        boolean withPdf = pdfBytes != null && pdfBytes.length > 0 && !event.linkOnly;

        String subject;
        String html;
        if (template != null) {
            Map<String, String> ctx = reportPlaceholders(event);
            subject = templateRenderer.render(template.getSubjectTemplate(), ctx);
            if (subject == null || subject.trim().isEmpty()) {
                subject = composer.subject(event);
            }
            html = templateRenderer.render(template.getBodyTemplate(), ctx);
        } else {
            subject = composer.subject(event);
            html = composer.html(event);
        }

        EmailSendLog logRow = newLog(event, account, template, subject);
        try {
            if (account != null) {
                SmtpEmailRequest msg = new SmtpEmailRequest();
                msg.setFromEmail(account.getFromEmail());
                msg.setFromName(account.getFromName());
                msg.getTo().add(event.recipientEmail);
                msg.setSubject(subject);
                msg.setHtmlContent(html);
                if (withPdf) {
                    msg.getAttachments().add(new SmtpEmailRequest.EmailAttachment(
                            "Career-9-Report.pdf", pdfBytes, "application/pdf"));
                }
                senderFactory.forAccount(account).send(msg); // synchronous, throws on failure
            } else {
                sendViaClasspath(event, subject, html, pdfBytes, withPdf);
            }
            logRow.setStatus(EmailSendStatus.SENT);
            logRow.setSentAt(new Date());
            logRepository.save(logRow);
            logger.info("Report email sent to {} student={} assessment={} withPdf={} account={}",
                    event.recipientEmail, event.userStudentId, event.assessmentId, withPdf,
                    account != null ? account.getId() : "classpath-default");
        } catch (Exception e) {
            logRow.setStatus(EmailSendStatus.FAILED);
            logRow.setErrorMessage(truncate(e.getMessage()));
            logRepository.save(logRow);
            throw e; // propagate so the consumer retries → DLT
        }
    }

    // ─── placeholders + log ──────────────────────────────────────────────

    private Map<String, String> reportPlaceholders(ReportEmailEvent e) {
        BrandingDto brand = new BrandingDto(e.whitelabel, e.schoolName, e.logoUrl);
        String school = (e.whitelabel && e.schoolName != null && !e.schoolName.isEmpty())
                ? e.schoolName : "Career-9";
        Map<String, String> ctx = new LinkedHashMap<>();
        ctx.put("school_name", esc(school));
        ctx.put("logo_url", esc(e.logoUrl));
        ctx.put("email_header", brandingService.emailHeaderHtml(brand)); // raw HTML
        ctx.put("email_footer", brandingService.emailFooterHtml(brand)); // raw HTML
        ctx.put("student_name", esc(e.studentName));
        if (e.studentName != null && !e.studentName.trim().isEmpty()) {
            String t = e.studentName.trim();
            ctx.put("first_name", esc(t.contains(" ") ? t.substring(0, t.indexOf(' ')) : t));
        }
        ctx.put("report_link", esc(e.reportUrl));
        ctx.put("report_pdf_link", esc(e.pdfUrl));
        return ctx;
    }

    private EmailSendLog newLog(ReportEmailEvent e, EmailAccount account, EmailTemplate template, String subject) {
        EmailSendLog row = new EmailSendLog();
        row.setEmailType(EmailType.REPORT_READY.name());
        row.setRecipient(e.recipientEmail);
        row.setSubject(subject != null && subject.length() > 500 ? subject.substring(0, 500) : subject);
        row.setAccountId(account != null ? account.getId() : null);
        row.setTemplateId(template != null ? template.getId() : null);
        row.setUserStudentId(e.userStudentId);
        row.setDeliveryMode(EmailDeliveryMode.SYNC);
        row.setStatus(EmailSendStatus.QUEUED);
        return logRepository.save(row);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 2000 ? s.substring(0, 2000) : s;
    }

    // ─── legacy classpath fallback (only when no account resolves) ────────

    private void sendViaClasspath(ReportEmailEvent event, String subject, String html,
                                  byte[] pdfBytes, boolean withPdf) throws Exception {
        String fromName = (event.whitelabel && event.schoolName != null && !event.schoolName.isEmpty())
                ? event.schoolName + " (via Career-9)"
                : null;

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

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        mime.writeTo(buffer);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.toByteArray());
        com.google.api.services.gmail.model.Message gmailMessage =
                new com.google.api.services.gmail.model.Message().setRaw(raw);

        gmailService().users().messages().send("me", gmailMessage).execute();
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
