package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.List;
import static com.kccitm.api.service.email.theme.MailHtml.esc;
import static com.kccitm.api.service.email.theme.MailHtml.escAttr;
import static com.kccitm.api.service.email.theme.MailHtml.textOf;
import static com.kccitm.api.service.email.theme.MailTheme.*;

/** One class per block. Authored strings are trusted markup (inline b, entities); values come in escaped via Mail.b/Mail.v or are escaped here. */
final class Blocks {
    private Blocks() { }

    static final class Title extends Block {
        final String html; Title(String h) { html = h == null ? "" : h; }
        public String html() { return "<h1 style=\"margin:0 0 14px;font-family:" + FONT + ";font-size:20px;line-height:1.3;font-weight:700;color:" + INK + ";\">" + html + "</h1>"; }
        public String text() { return textOf(html).toUpperCase(); }
    }
    static final class Paragraph extends Block {
        final String html; Paragraph(String h) { html = h == null ? "" : h; }
        public String html() { return "<p style=\"margin:0 0 14px;font-family:" + FONT + ";font-size:15px;line-height:1.6;color:" + INK + ";\">" + html + "</p>"; }
        public String text() { return textOf(html); }
    }
    static final class Small extends Block {
        final String html; Small(String h) { html = h == null ? "" : h; }
        public String html() { return "<p style=\"margin:0 0 14px;font-family:" + FONT + ";font-size:13px;line-height:1.6;color:" + MUTED + ";\">" + html + "</p>"; }
        public String text() { return textOf(html); }
    }
    static final class Notice extends Block {
        final String html; Notice(String h) { html = h == null ? "" : h; }
        public String html() { return "<div style=\"border-left:3px solid " + ACCENT + ";background:" + PANEL + ";padding:10px 14px;margin:0 0 18px;font-family:" + FONT + ";font-size:14px;line-height:1.55;color:" + INK + ";\">" + html + "</div>"; }
        public String text() { return textOf(html); }
    }
    static final class Internal extends Block {
        final String tag; Internal(String t) { tag = t == null ? "" : t; }
        public String html() { return "<p style=\"margin:-4px 0 14px;font-family:" + FONT + ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" + FAINT + ";\">Internal &middot; " + esc(tag) + "</p>"; }
        public String text() { return "[Internal] " + tag; }
    }
    static final class Details extends Block {
        final List<Mail.Row> rows; Details(List<Mail.Row> r) { rows = r; }
        public String html() {
            StringBuilder tr = new StringBuilder();
            for (Mail.Row r : rows) {
                if (r == null || r.value == null || r.value.isEmpty()) continue;
                tr.append("<tr><td style=\"padding:6px 12px 6px 0;width:120px;font-family:").append(FONT).append(";font-size:14px;color:").append(MUTED).append(";vertical-align:top;\">").append(esc(r.label)).append("</td>")
                  .append("<td style=\"padding:6px 0;font-family:").append(FONT).append(";font-size:14px;font-weight:700;color:").append(INK).append(";vertical-align:top;\">").append(esc(r.value)).append("</td></tr>");
            }
            return "<div style=\"background:" + PANEL + ";border:1px solid " + BORDER + ";border-radius:4px;padding:10px 16px;margin:4px 0 18px;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + tr + "</table></div>";
        }
        public String text() {
            List<String> out = new ArrayList<>();
            for (Mail.Row r : rows) if (r != null && r.value != null && !r.value.isEmpty()) out.add("  " + r.label + ": " + r.value);
            return String.join("\n", out);
        }
    }
    static final class Credentials extends Block {
        final List<Mail.Row> rows; final String caption;
        Credentials(List<Mail.Row> r, String c) { rows = r; caption = c; }
        public String html() {
            StringBuilder tr = new StringBuilder();
            for (Mail.Row r : rows) {
                if (r == null || r.value == null || r.value.isEmpty()) continue;
                tr.append("<tr><td style=\"padding:5px 12px 5px 0;width:120px;font-family:").append(FONT).append(";font-size:14px;color:").append(MUTED).append(";vertical-align:top;\">").append(esc(r.label)).append("</td>")
                  .append("<td style=\"padding:5px 0;font-family:").append(MONO).append(";font-size:15px;font-weight:700;color:").append(INK).append(";vertical-align:top;\">").append(esc(r.value)).append("</td></tr>");
            }
            String cap = caption == null || caption.isEmpty() ? "" : "<div style=\"font-family:" + FONT + ";font-size:12px;line-height:1.5;color:" + MUTED + ";padding-top:8px;\">" + caption + "</div>";
            return "<div style=\"background:" + PANEL + ";border:1px solid " + BORDER + ";border-radius:4px;padding:12px 16px;margin:4px 0 18px;\">"
                 + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" + FAINT + ";padding-bottom:6px;\">Your login details</div>"
                 + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + tr + "</table>" + cap + "</div>";
        }
        public String text() {
            List<String> out = new ArrayList<>(); out.add("Your login details");
            for (Mail.Row r : rows) if (r != null && r.value != null && !r.value.isEmpty()) out.add("  " + r.label + ": " + r.value);
            if (caption != null && !caption.isEmpty()) out.add(textOf(caption));
            return String.join("\n", out);
        }
    }
    static final class Code extends Block {
        final String code, caption; Code(String c, String cap) { code = c == null ? "" : c; caption = cap == null ? "" : cap; }
        public String html() {
            return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:6px 0 18px;\"><tr><td align=\"center\" style=\"background:" + PANEL + ";border:1px dashed " + BORDER + ";border-radius:4px;padding:20px 16px;\">"
                 + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" + FAINT + ";\">" + esc(caption) + "</div>"
                 + "<div style=\"font-family:" + MONO + ";font-size:36px;line-height:1.2;font-weight:700;letter-spacing:10px;color:" + PRIMARY + ";padding:10px 0 2px 10px;\">" + esc(code) + "</div></td></tr></table>";
        }
        public String text() { return caption + ": " + code; }
    }
    static String button(MailLink l, String label) {
        return "<a href=\"" + escAttr(l.getHref()) + "\" style=\"display:inline-block;background:" + PRIMARY + ";color:#FFFFFF;font-family:" + FONT + ";font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:4px;\">" + esc(label) + "</a>";
    }
    /** Primary button with the "Or open:" short-link line. */
    static final class Action extends Block {
        final MailLink link; final String label; Action(MailLink l, String lb) { link = l; label = lb; }
        public boolean isPrimaryAction() { return true; }
        public String html() {
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:6px 0 18px;\"><tr><td>" + button(link, label) + "</td></tr>"
                 + "<tr><td style=\"padding-top:10px;font-family:" + FONT + ";font-size:12px;line-height:1.5;color:" + FAINT + ";\">Or open: <a href=\"" + escAttr(link.getHref()) + "\" style=\"color:" + PRIMARY + ";text-decoration:underline;\">" + esc(link.getDisplay()) + "</a></td></tr></table>";
        }
        public String text() { return label + ": " + link.getDisplay(); }
    }
    /** Primary button without the fallback line — for seeded templates whose href is still a {{token}}. */
    static final class Button extends Block {
        final MailLink link; final String label; Button(MailLink l, String lb) { link = l; label = lb; }
        public boolean isPrimaryAction() { return true; }
        public String html() { return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:6px 0 18px;\"><tr><td>" + button(link, label) + "</td></tr></table>"; }
        public String text() { return label + ": " + link.getDisplay(); }
    }
    static final class Outline extends Block {
        final MailLink link; final String label; Outline(MailLink l, String lb) { link = l; label = lb; }
        public boolean isSecondaryAction() { return true; }
        public String html() {
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:-6px 0 18px;\"><tr><td><a href=\"" + escAttr(link.getHref()) + "\" style=\"display:inline-block;border:1px solid " + PRIMARY + ";color:" + PRIMARY + ";font-family:" + FONT + ";font-size:13px;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:4px;\">" + esc(label) + "</a></td></tr></table>";
        }
        public String text() { return label + ": " + link.getDisplay(); }
    }
    /** A small line of labelled links, e.g. "Also attached as a PDF. Download as PDF". */
    static final class Links extends Block {
        final String prefix; final List<MailLink> links; final List<String> labels;
        Links(String p, List<MailLink> l, List<String> lb) { prefix = p; links = l; labels = lb; }
        public String html() {
            StringBuilder parts = new StringBuilder();
            for (int i = 0; i < links.size(); i++) {
                if (i > 0) parts.append(" &middot; ");
                parts.append("<a href=\"").append(escAttr(links.get(i).getHref())).append("\" style=\"color:").append(PRIMARY).append(";font-weight:700;text-decoration:underline;\">").append(esc(labels.get(i))).append("</a>");
            }
            String pre = prefix == null || prefix.isEmpty() ? "" : prefix + " ";
            return "<p style=\"margin:-6px 0 16px;font-family:" + FONT + ";font-size:13px;line-height:1.6;color:" + MUTED + ";\">" + pre + parts + "</p>";
        }
        public String text() {
            List<String> out = new ArrayList<>();
            if (prefix != null && !prefix.isEmpty()) out.add(textOf(prefix));
            for (int i = 0; i < links.size(); i++) out.add("  " + labels.get(i) + ": " + links.get(i).getDisplay());
            return String.join("\n", out);
        }
    }
    static final class BulletList extends Block {
        final List<String> items; BulletList(List<String> i) { items = i; }
        public String html() {
            StringBuilder rows = new StringBuilder();
            for (String i : items) rows.append("<tr><td style=\"width:18px;vertical-align:top;padding:3px 0;font-family:").append(FONT).append(";font-size:14px;color:").append(ACCENT).append(";\">&#9679;</td><td style=\"padding:3px 0;font-family:").append(FONT).append(";font-size:14px;line-height:1.55;color:").append(INK).append(";\">").append(i).append("</td></tr>");
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 16px;\">" + rows + "</table>";
        }
        public String text() { List<String> o = new ArrayList<>(); for (String i : items) o.add("  - " + textOf(i)); return String.join("\n", o); }
    }
    static final class Steps extends Block {
        final List<Mail.Step> steps; Steps(List<Mail.Step> s) { steps = s; }
        public String html() {
            StringBuilder rows = new StringBuilder(); int n = 1;
            for (Mail.Step s : steps) rows.append("<tr><td style=\"width:30px;vertical-align:top;padding:4px 10px 4px 0;font-family:").append(FONT).append(";font-size:13px;font-weight:700;color:").append(PRIMARY).append(";\">").append(n++).append(".</td><td style=\"padding:4px 0;font-family:").append(FONT).append(";font-size:14px;line-height:1.5;color:").append(INK).append(";\"><b>").append(s.heading).append("</b><br><span style=\"color:").append(MUTED).append(";\">").append(s.text).append("</span></td></tr>");
            return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 16px;\">" + rows + "</table>";
        }
        public String text() { List<String> o = new ArrayList<>(); int n = 1; for (Mail.Step s : steps) o.add("  " + (n++) + ". " + textOf(s.heading) + " — " + textOf(s.text)); return String.join("\n", o); }
    }
    static final class Table extends Block {
        final String[] header; final List<String[]> rows; Table(String[] h, List<String[]> r) { header = h; rows = r; }
        public String html() {
            StringBuilder th = new StringBuilder();
            for (String h : header) th.append("<th align=\"left\" style=\"padding:7px 10px;font-family:").append(FONT).append(";font-size:12px;font-weight:700;color:").append(MUTED).append(";background:").append(PANEL).append(";border-bottom:1px solid ").append(BORDER).append(";\">").append(esc(h)).append("</th>");
            StringBuilder trs = new StringBuilder();
            for (String[] r : rows) { trs.append("<tr>"); for (String c : r) trs.append("<td style=\"padding:7px 10px;font-family:").append(FONT).append(";font-size:13.5px;color:").append(INK).append(";border-bottom:1px solid ").append(BORDER).append(";vertical-align:top;\">").append(esc(c)).append("</td>"); trs.append("</tr>"); }
            return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border:1px solid " + BORDER + ";border-radius:4px;margin:4px 0 18px;\"><tr>" + th + "</tr>" + trs + "</table>";
        }
        public String text() { List<String> o = new ArrayList<>(); o.add("  " + String.join(" | ", header)); for (String[] r : rows) o.add("  " + String.join(" | ", r)); return String.join("\n", o); }
    }
    static final class Signature extends Block {
        public String html() { return "<p style=\"margin:22px 0 0;font-family:" + FONT + ";font-size:15px;line-height:1.6;color:" + INK + ";\">Regards,<br><b>Career-9 Team</b></p>"; }
        public String text() { return "Regards,\nCareer-9 Team"; }
    }
}
