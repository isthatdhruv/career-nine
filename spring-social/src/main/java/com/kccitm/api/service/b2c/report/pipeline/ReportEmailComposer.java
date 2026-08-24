package com.kccitm.api.service.b2c.report.pipeline;

import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Builds the co-branded subject + HTML body for the report email. Reuses
 * {@link InstituteBrandingService}'s shared email header/footer so the email
 * matches the rest of the platform's transactional mail.
 */
@Component
public class ReportEmailComposer {

    @Autowired private InstituteBrandingService brandingService;

    public String subject(ReportEmailEvent e) {
        if (e.whitelabel && e.schoolName != null && !e.schoolName.isEmpty()) {
            return "Your " + e.schoolName + " report is ready";
        }
        return "Your Career-9 report is ready";
    }

    public String html(ReportEmailEvent e) {
        BrandingDto brand = new BrandingDto(e.whitelabel, e.schoolName, e.logoUrl);
        String header = brandingService.emailHeaderHtml(brand);
        String footer = brandingService.emailFooterHtml(brand);
        String orgName = (e.whitelabel && e.schoolName != null && !e.schoolName.isEmpty())
                ? escape(e.schoolName) : "Career-9";
        String attachLine = e.linkOnly
                ? "<p style=\"margin:16px 0 0;color:#555;font-size:14px;\">Open your full report using the button above.</p>"
                : "<p style=\"margin:16px 0 0;color:#555;font-size:14px;\">Your detailed report is also attached to this email as a PDF.</p>";
        // Direct Spaces CDN link to the PDF, so the report is reachable even from
        // clients that strip attachments (and after the attachment is lost).
        String pdfLine = (e.pdfUrl != null && !e.pdfUrl.isEmpty())
                ? "<p style=\"text-align:center;margin:0 0 8px;\">"
                        + "<a href=\"" + e.pdfUrl + "\" style=\"color:#1f8a4c;font-weight:bold;\">Download your report as a PDF</a>"
                        + "</p>"
                : "";

        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
                + "<body style=\"margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;\">"
                + "<div style=\"max-width:600px;margin:0 auto;background:#ffffff;\">"
                + header
                + "<div style=\"padding:24px 28px;\">"
                + "<h2 style=\"color:#2b2b6b;margin:0 0 12px;\">Your report is ready</h2>"
                + "<p style=\"color:#444;margin:0 0 16px;font-size:15px;\">Your assessment report from "
                + orgName + " has been generated.</p>"
                + "<p style=\"text-align:center;margin:24px 0 12px;\">"
                + "<a href=\"" + e.reportUrl + "\" style=\"background:#1f8a4c;color:#ffffff;text-decoration:none;"
                + "padding:12px 28px;border-radius:6px;display:inline-block;font-weight:bold;\">View your report</a>"
                + "</p>"
                + pdfLine
                + attachLine
                + "</div>"
                + footer
                + "</div></body></html>";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
