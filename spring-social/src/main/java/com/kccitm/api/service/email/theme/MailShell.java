package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static com.kccitm.api.service.email.theme.MailHtml.esc;
import static com.kccitm.api.service.email.theme.MailHtml.escAttr;
import static com.kccitm.api.service.email.theme.MailTheme.*;

/** Shell A3. Tables and inline styles only: Outlook renders through Word and Gmail strips head styles. */
public final class MailShell {
    private static final Pattern BODY = Pattern.compile("(?is)<body[^>]*>(.*)</body>");
    private static final Pattern STRIP = Pattern.compile("(?is)<style[^>]*>.*?</style>|<!doctype[^>]*>|</?(html|head|body)[^>]*>|<meta[^>]*>|<title>.*?</title>");
    private MailShell() { }

    public static String render(Mail mail, Brand brand) {
        StringBuilder body = new StringBuilder();
        for (Block b : mail.getBlocks()) body.append(b.html());
        return shell(mail.getPreheader(), body.toString(), brand);
    }

    /** Blocks only, no shell — for seeded templates that the dispatcher wraps at send time. */
    public static String bodyHtml(Mail mail) {
        StringBuilder body = new StringBuilder();
        for (Block b : mail.getBlocks()) body.append(b.html());
        return body.toString();
    }

    public static String text(Mail mail, Brand brand) {
        List<String> out = new ArrayList<>();
        for (Block b : mail.getBlocks()) { String t = b.text(); if (t != null && !t.isEmpty()) out.add(t); }
        out.add("--\n" + footerText(brand));
        return String.join("\n\n", out);
    }

    public static String wrapForeign(String html, Brand brand) {
        if (html == null) html = "";
        if (html.contains(SHELL_MARKER)) return html;
        Matcher m = BODY.matcher(html);
        String inner = m.find() ? m.group(1) : html;
        inner = STRIP.matcher(inner).replaceAll("").trim();
        return shell(preheaderFrom(inner), inner, brand);
    }

    /** First 90 visible characters of foreign HTML, for the inbox line. */
    public static String preheaderFrom(String html) {
        String t = MailHtml.textOf(html).replaceAll("\\s+", " ").trim();
        return t.length() <= MAX_PREHEADER ? t : t.substring(0, MAX_PREHEADER);
    }

    static String shell(String preheader, String body, Brand brand) {
        String pre = "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">" + esc(preheader == null ? "" : preheader)
                + "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>";
        return pre
            + "<div style=\"background:" + GROUND + ";padding:32px 12px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" " + SHELL_MARKER + "><tr><td align=\"center\">"
            + "<table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:560px;\">"
            + "<tr><td style=\"background:" + PRIMARY + ";height:8px;font-size:0;line-height:0;border-radius:6px 6px 0 0;\">&nbsp;</td></tr>"
            + "<tr><td style=\"background:" + WHITE + ";border:1px solid " + BORDER + ";border-top:none;padding:16px 28px;\">" + headerRow(brand) + "</td></tr>"
            + "<tr><td style=\"background:" + WHITE + ";border:1px solid " + BORDER + ";border-top:1px solid " + BORDER + ";border-radius:0 0 6px 6px;padding:28px 28px 24px;\">" + body + "</td></tr>"
            + "<tr><td style=\"padding:16px 4px 0;font-family:" + FONT + ";font-size:12px;line-height:1.7;color:" + FAINT + ";\">" + footerHtml(brand) + "</td></tr>"
            + "</table></td></tr></table></div>";
    }

    private static String headerRow(Brand brand) {
        String mark;
        if (brand.isWhitelabel()) {
            mark = "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
                 + "<td style=\"vertical-align:middle;\"><img src=\"" + escAttr(brand.getSchoolLogoUrl()) + "\" width=\"36\" height=\"36\" alt=\"" + escAttr(brand.getSchoolName()) + " logo\" style=\"display:block;border:0;border-radius:4px;\"></td>"
                 + "<td style=\"padding-left:12px;vertical-align:middle;\"><div style=\"font-family:" + FONT + ";font-size:15px;font-weight:700;line-height:1.2;color:" + INK + ";\">" + esc(brand.getSchoolName()) + "</div>"
                 + "<div style=\"font-family:" + FONT + ";font-size:11px;letter-spacing:.3px;margin-top:2px;color:" + FAINT + ";\">Powered by Career-9</div></td></tr></table>";
        } else {
            mark = "<img src=\"" + escAttr(brand.getLogoUrl()) + "\" width=\"127\" height=\"48\" alt=\"Career-9\" style=\"display:block;border:0;\">";
        }
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
             + "<td style=\"vertical-align:middle;\">" + mark + "</td>"
             + "<td align=\"right\" style=\"vertical-align:middle;font-family:" + FONT + ";font-size:12px;color:" + FAINT + ";\">Help: <a href=\"mailto:" + escAttr(brand.getSupportEmail()) + "\" style=\"color:" + FAINT + ";text-decoration:none;\">" + esc(brand.getSupportEmail()) + "</a></td>"
             + "</tr></table>";
    }

    private static String footerHtml(Brand b) {
        String first = b.isWhitelabel() ? "Sent by Career-9 on behalf of " + esc(b.getSchoolName()) + "." : "Career-9 &middot; Ensuring Career Success";
        return first + "<br>Questions? Write to <a href=\"mailto:" + escAttr(b.getSupportEmail()) + "\" style=\"color:" + PRIMARY + ";text-decoration:underline;\">" + esc(b.getSupportEmail()) + "</a>"
             + "<br>&copy; " + b.getYear() + " Career-9. All rights reserved. &middot; <a href=\"" + escAttr(b.getSiteUrl()) + "\" style=\"color:" + PRIMARY + ";text-decoration:none;\">" + esc(b.getSiteDisplay()) + "</a>";
    }

    private static String footerText(Brand b) {
        String first = b.isWhitelabel() ? "Sent by Career-9 on behalf of " + b.getSchoolName() + "." : "Career-9 · Ensuring Career Success";
        return first + "\nQuestions? Write to " + b.getSupportEmail() + "\n© " + b.getYear() + " Career-9. All rights reserved. · " + b.getSiteDisplay();
    }
}
