package com.kccitm.api.service.b2c.report.pipeline;

import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Builds the co-branded subject + HTML body for the report email. Reuses
 * {@link InstituteBrandingService}'s shared email header/footer so the email
 * matches the rest of the platform's transactional mail.
 *
 * <p>Single source of the report-mail body: the pipeline consumer, the legacy
 * pipeline-disabled send and the admin resend all render through
 * {@link #html(ReportEmailEvent)}. When {@link ReportEmailEvent#bookingUrl} is
 * set the mail closes with the "Your Next Step" counselling section — the
 * caller decides eligibility, this class only renders.
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
                ? escape(e.schoolName) : "Career&#8209;9";
        String greetName = (e.studentName != null && !e.studentName.isBlank())
                ? escape(e.studentName.trim()) : "there";

        String attachLine = e.linkOnly
                ? "<p style=\"text-align:center;margin:0 0 24px;color:#8a978f;font-size:12.5px;\">"
                        + "Open your full report using the button above.</p>"
                : "<p style=\"text-align:center;margin:0 0 24px;color:#8a978f;font-size:12.5px;\">"
                        + "Your detailed report is also attached to this email as a PDF.</p>";
        // Direct Spaces CDN link to the PDF, so the report is reachable even from
        // clients that strip attachments (and after the attachment is lost).
        String pdfLine = (e.pdfUrl != null && !e.pdfUrl.isEmpty())
                ? "<p style=\"text-align:center;margin:0 0 6px;font-size:13px;\">"
                        + "<a href=\"" + e.pdfUrl + "\" style=\"color:#059669;font-weight:700;text-decoration:none;\">"
                        + "Download as PDF</a></p>"
                : "";

        // Rendered only when the caller resolved a booking link (counselling in the
        // tier/config and no active appointment). The page behind the link re-checks
        // on every open, so a stale CTA can never double-book.
        String nextStep = (e.bookingUrl == null || e.bookingUrl.isEmpty()) ? ""
                : "<div style=\"border-top:1px solid #e3e8e5;text-align:center;margin:0 0 20px;\">"
                + "<span style=\"position:relative;top:-9px;background:#ffffff;padding:0 12px;"
                +     "font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;\">"
                +     "&#128640; YOUR NEXT STEP</span>"
                + "</div>"
                + "<p style=\"margin:0 0 16px;font-size:14.5px;line-height:1.65;color:#0f1f18;\">"
                +     "Now it&rsquo;s time to understand what these insights really mean for your future. "
                +     "Get your report interpreted by subject-matter experts in a <strong>1:1 online session</strong> "
                +     "and understand your results:</p>"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\""
                +     " style=\"margin:0 0 20px;font-size:14px;line-height:1.7;color:#3d4a44;\">"
                + "<tr><td style=\"width:26px;vertical-align:top;\">&#10024;</td>"
                +     "<td>Explore career options that fit <strong>YOU</strong></td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#10024;</td>"
                +     "<td>Discover your strengths &amp; improvement areas</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#10024;</td>"
                +     "<td>Get clarity on your next academic step</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#10024;</td>"
                +     "<td>Ask anything about your future &mdash; no question is too small!</td></tr>"
                + "</table>"
                + "<div style=\"text-align:center;margin:0 0 24px;\">"
                + "<a href=\"" + e.bookingUrl + "\" style=\"display:inline-block;padding:13px 32px;"
                +     "background:#ffffff;color:#059669;border:2px solid #059669;text-decoration:none;"
                +     "border-radius:8px;font-weight:700;font-size:14.5px;\">Book my counselling session</a>"
                + "</div>";

        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
                + "<body style=\"margin:0;background:#f3f5f4;"
                + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                + "<div style=\"max-width:600px;margin:0 auto;background:#ffffff;\">"
                + header
                + "<div style=\"padding:28px 32px 8px;\">"

                + "<h2 style=\"margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#0f1f18;\">"
                +     "&#127881; Your Career Assessment is complete!</h2>"
                + "<p style=\"margin:0 0 18px;font-size:15px;line-height:1.6;color:#5f6f67;\">"
                +     "Hi " + greetName + ", now comes the exciting part&hellip;</p>"

                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\""
                +     " style=\"margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#0f1f18;\">"
                + "<tr><td style=\"width:28px;vertical-align:top;\">&#128269;</td>"
                +     "<td>What does your report say about <strong>YOU</strong>?</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#128161;</td>"
                +     "<td>What are your natural strengths?</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#127919;</td>"
                +     "<td>Which careers could actually match your personality and abilities?</td></tr>"
                + "<tr><td style=\"vertical-align:top;\">&#128640;</td>"
                +     "<td>What could you work on to get closer to your goals?</td></tr>"
                + "</table>"

                + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.65;color:#0f1f18;\">"
                +     "Your personalized <strong>" + orgName + " Report</strong> is ready &mdash; filled with "
                +     "insights about your strengths, interests, abilities, and career possibilities.</p>"

                + "<div style=\"text-align:center;margin:0 0 10px;\">"
                + "<a href=\"" + e.reportUrl + "\" style=\"display:inline-block;padding:14px 36px;"
                +     "background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;"
                +     "font-weight:700;font-size:15px;\">View my report &rarr;</a>"
                + "</div>"
                + pdfLine
                + attachLine

                + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.6;color:#0f1f18;\">"
                +     "But remember, the report is just the beginning! &#127775;</p>"

                + nextStep

                + "<p style=\"margin:0 0 28px;font-size:14px;line-height:1.65;color:#5f6f67;\">"
                +     "Your future is not a guess. It&rsquo;s a journey &mdash; and " + orgName
                +     " is here to help you navigate it.</p>"

                + "</div>"
                + footer
                + "</div></body></html>";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
