package com.kccitm.api.service.b2c.report.pipeline;

import com.kccitm.api.service.OdooEmailService;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.email.mails.AccountMails;
import com.kccitm.api.service.email.mails.ReportMails;
import com.kccitm.api.service.email.theme.Brand;
import com.kccitm.api.service.email.theme.BrandResolver;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLinks;
import com.kccitm.api.service.email.theme.MailRenderer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Odoo {@link EmailSender} — sends the co-branded report email through Odoo
 * ({@link OdooEmailService#sendHtmlSync}, synchronous, throws on failure). The
 * actual outgoing SMTP server + daily cap are configured inside Odoo.
 *
 * <p>Opt-in: active only when {@code report.pipeline.email-transport=odoo}. The
 * default transport is Gmail SMTP ({@link SmtpReportEmailSender}). Both impls
 * implement {@link EmailSender}; the {@code @ConditionalOnProperty} gates ensure
 * exactly one is registered so the email consumer's injection is unambiguous.
 */
@Component
@ConditionalOnProperty(name = "report.pipeline.email-transport", havingValue = "odoo")
public class OdooEmailSender implements EmailSender {

    @Autowired private OdooEmailService odooEmailService;
    @Autowired private BrandResolver brandResolver;
    @Autowired private MailRenderer mailRenderer;
    @Autowired private MailLinks mailLinks;

    @Override
    public void sendReportEmail(ReportEmailEvent event, byte[] pdfBytes) throws Exception {
        boolean withPdf = pdfBytes != null && pdfBytes.length > 0 && !event.linkOnly;
        Brand brand = brandResolver.of(new BrandingDto(event.whitelabel, event.schoolName, event.logoUrl));
        Mail mail = ReportMails.reportReady(AccountMails.firstName(event.studentName), brand.getName(),
                mailLinks.of(event.reportUrl, "report"),
                event.pdfUrl == null ? null : mailLinks.of(event.pdfUrl, "report_pdf"),
                withPdf,
                event.bookingUrl == null ? null : mailLinks.of(event.bookingUrl, "counselling_booking"));
        // Odoo's sync send takes only an HTML body — no separate text part to carry r.text.
        MailRenderer.Rendered r = mailRenderer.render(mail, brand);
        String fromName = (event.whitelabel && event.schoolName != null && !event.schoolName.isEmpty())
                ? event.schoolName + " (via Career-9)"
                : null;

        if (withPdf) {
            odooEmailService.sendHtmlSync(event.recipientEmail, r.subject, r.html, fromName,
                    "Career-9-Report.pdf", pdfBytes, "application/pdf");
        } else {
            odooEmailService.sendHtmlSync(event.recipientEmail, r.subject, r.html, fromName,
                    null, null, null);
        }
    }
}
