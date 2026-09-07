package com.kccitm.api.service.email.theme;

import org.springframework.stereotype.Service;

@Service
public class MailRenderer {
    public static final class Rendered {
        public final String subject; public final String html; public final String text;
        public Rendered(String subject, String html, String text) { this.subject = subject; this.html = html; this.text = text; }
    }
    public Rendered render(Mail mail, Brand brand) {
        return new Rendered(mail.getSubject(), MailShell.render(mail, brand), MailShell.text(mail, brand));
    }
    /** Foreign HTML in the shell, with a text part derived from it. */
    public Rendered wrapForeign(String subject, String html, Brand brand) {
        String shelled = MailShell.wrapForeign(html, brand);
        String text = MailHtml.textOf(html.replaceAll("(?i)</(p|div|tr|li|h[1-6])>", "\n")).replaceAll("\n{3,}", "\n\n");
        return new Rendered(subject, shelled, text);
    }
    public String bodyHtml(Mail mail) { return MailShell.bodyHtml(mail); }
}
