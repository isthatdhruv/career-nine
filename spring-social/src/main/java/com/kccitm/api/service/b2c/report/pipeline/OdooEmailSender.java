package com.kccitm.api.service.b2c.report.pipeline;

import com.kccitm.api.service.OdooEmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Default {@link EmailSender} — sends the co-branded report email through Odoo
 * ({@link OdooEmailService#sendHtmlSync}, synchronous, throws on failure). The
 * actual outgoing SMTP server + daily cap are configured inside Odoo.
 */
@Component
public class OdooEmailSender implements EmailSender {

    @Autowired private OdooEmailService odooEmailService;
    @Autowired private ReportEmailComposer composer;

    @Override
    public void sendReportEmail(ReportEmailEvent event, byte[] pdfBytes) throws Exception {
        String subject = composer.subject(event);
        String html = composer.html(event);
        String fromName = (event.whitelabel && event.schoolName != null && !event.schoolName.isEmpty())
                ? event.schoolName + " (via Career-9)"
                : null;

        if (pdfBytes != null && pdfBytes.length > 0 && !event.linkOnly) {
            odooEmailService.sendHtmlSync(event.recipientEmail, subject, html, fromName,
                    "Career-9-Report.pdf", pdfBytes, "application/pdf");
        } else {
            odooEmailService.sendHtmlSync(event.recipientEmail, subject, html, fromName,
                    null, null, null);
        }
    }
}
