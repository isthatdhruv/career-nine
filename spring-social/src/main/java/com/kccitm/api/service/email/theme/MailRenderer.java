package com.kccitm.api.service.email.theme;

import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class MailRenderer {
    /** The hidden preheader div MailShell.shell() writes; stripped before deriving text from already-shelled html. */
    private static final Pattern PREHEADER_DIV = Pattern.compile("(?is)<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">.*?</div>");

    public static final class Rendered {
        public final String subject; public final String html; public final String text;
        public Rendered(String subject, String html, String text) { this.subject = subject; this.html = html; this.text = text; }
    }
    public Rendered render(Mail mail, Brand brand) {
        return new Rendered(mail.getSubject(), MailShell.render(mail, brand), MailShell.text(mail, brand));
    }
    /** Foreign HTML in the shell, with a text part derived from it. */
    public Rendered wrapForeign(String subject, String html, Brand brand) {
        String h = html == null ? "" : html;
        String shelled = MailShell.wrapForeign(h, brand);
        // Already-shelled input is returned untouched by MailShell.wrapForeign; deriving text from it as-is
        // would put the hidden preheader spacer (entities, no visible words) at the front of the text part.
        String source = h.contains(MailTheme.SHELL_MARKER) ? PREHEADER_DIV.matcher(h).replaceAll("") : h;
        String text = MailHtml.textOf(source.replaceAll("(?i)</(p|div|tr|li|h[1-6])>", "\n")).replaceAll("\n{3,}", "\n\n");
        return new Rendered(subject, shelled, text);
    }
    public String bodyHtml(Mail mail) { return MailShell.bodyHtml(mail); }
}
