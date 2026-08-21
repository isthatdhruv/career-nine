package com.kccitm.api.service.counselling;

import java.util.ArrayList;
import java.util.List;

/**
 * The house style for counselling emails — one branded HTML shell every counselling mail is
 * poured into, plus the few blocks those mails actually need.
 *
 * <p>These emails used to go out as plain text wrapped in {@code <pre>}, which put the two
 * things a student opens the mail <em>for</em> — the check-in code and the meeting link — on an
 * indented line in the middle of a paragraph, in the same weight as the school name. On a phone,
 * minutes before a session, that is the wrong place for them. The blocks below exist to lift
 * exactly those two out of the prose: {@link #otpBlock} and {@link #joinBlock} are the visual
 * centre of their emails, and everything else is arranged around them.
 *
 * <h3>Why it is written like 2005</h3>
 * Tables for layout, styles inline on every element, no flexbox/grid, no {@code <style>} block,
 * no web fonts, no background images. Not nostalgia — Outlook renders through Word, and Gmail
 * strips {@code <head>} styles outright. Anything cleverer than this degrades to unstyled text
 * in the clients schools and parents actually read mail in. Keep additions to the same
 * vocabulary.
 *
 * <p>Every caller also supplies a plain-text alternative, so the mail still reads correctly in
 * a client that shows no HTML at all. Nothing here is the only copy of anything.
 */
final class CounsellingEmailHtml {

    // ─── palette ──────────────────────────────────────────────────────────────────
    private static final String PAGE_BG   = "#f1f4f9";
    private static final String CARD_BG   = "#ffffff";
    private static final String BRAND     = "#1b3a6b";
    private static final String INK       = "#101828";
    private static final String MUTED     = "#667085";
    private static final String BORDER    = "#e4e7ec";
    private static final String TINT      = "#f5f8ff";
    private static final String TINT_EDGE = "#c7d7fe";

    private static final String FONT =
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

    private CounsellingEmailHtml() {
    }

    /**
     * Wraps assembled blocks in the branded shell: masthead, white card, footer.
     *
     * @param preheader the grey line the inbox shows next to the subject. Worth setting per
     *                  mail — left empty the client scrapes the first words of the body, which
     *                  for these is "Dear &lt;name&gt;" and tells the reader nothing.
     * @param title     the heading inside the card
     * @param bodyHtml  blocks from this class, concatenated
     */
    static String page(String preheader, String title, String bodyHtml) {
        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
             + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
             + "<title>" + esc(title) + "</title></head>"
             + "<body style=\"margin:0;padding:0;background:" + PAGE_BG + ";\">"
             // Hidden preheader: shown in the inbox list, never in the opened mail. The spacer
             // run stops the client back-filling it with body text.
             + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">"
             + esc(preheader) + "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>"
             + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"background:" + PAGE_BG + ";padding:24px 12px;\"><tr><td align=\"center\">"
             + "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"width:100%;max-width:600px;\">"

             // masthead
             + "<tr><td style=\"padding:0 4px 14px 4px;\">"
             + "<span style=\"font-family:" + FONT + ";font-size:17px;font-weight:700;"
             + "letter-spacing:1.5px;color:" + BRAND + ";\">CAREER&#8209;9</span>"
             + "<span style=\"font-family:" + FONT + ";font-size:12px;color:" + MUTED + ";"
             + "padding-left:10px;\">Career Counselling</span>"
             + "</td></tr>"

             // card
             + "<tr><td style=\"background:" + CARD_BG + ";border:1px solid " + BORDER + ";"
             + "border-radius:12px;padding:32px 28px;\">"
             + "<h1 style=\"margin:0 0 18px 0;font-family:" + FONT + ";font-size:21px;"
             + "line-height:1.35;font-weight:600;color:" + INK + ";\">" + esc(title) + "</h1>"
             + bodyHtml
             + "</td></tr>"

             // footer
             + "<tr><td style=\"padding:18px 8px 4px 8px;font-family:" + FONT + ";font-size:11px;"
             + "line-height:1.7;color:" + MUTED + ";\">"
             + "This is an automated message from Career-9. Please do not reply to this address &mdash; "
             + "write to us through the portal if anything above looks wrong.<br>"
             + "&copy; Career-9. All rights reserved."
             + "</td></tr>"

             + "</table></td></tr></table></body></html>";
    }

    /** A body paragraph. */
    static String p(String text) {
        return "<p style=\"margin:0 0 14px 0;font-family:" + FONT + ";font-size:15px;"
             + "line-height:1.65;color:" + INK + ";\">" + esc(text) + "</p>";
    }

    /** A quieter paragraph, for the closing note under a block. */
    static String small(String text) {
        return "<p style=\"margin:0 0 14px 0;font-family:" + FONT + ";font-size:13px;"
             + "line-height:1.6;color:" + MUTED + ";\">" + esc(text) + "</p>";
    }

    /** Sign-off. */
    static String signature() {
        return "<p style=\"margin:22px 0 0 0;font-family:" + FONT + ";font-size:15px;"
             + "line-height:1.6;color:" + INK + ";\">Regards,<br>"
             + "<strong style=\"color:" + BRAND + ";\">Career-Nine Team</strong></p>";
    }

    /**
     * The check-in code, as the largest thing on the page.
     *
     * <p>Set wide and monospaced because it gets read aloud to a counsellor over a call: the
     * digits have to be separable at a glance on a phone held at arm's length, and 6 and 8 have
     * to look different. Nothing else in the mail is allowed to compete with it.
     */
    static String otpBlock(String code, String caption) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td align=\"center\" style=\"background:" + TINT + ";border:1px dashed " + TINT_EDGE + ";"
             + "border-radius:12px;padding:24px 16px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";\">"
             + esc(caption) + "</div>"
             + "<div style=\"font-family:'SFMono-Regular',Consolas,'Courier New',monospace;"
             + "font-size:40px;line-height:1.2;font-weight:700;letter-spacing:12px;"
             // Left padding balances the trailing letter-space, which would otherwise sit the
             // digits visibly left of centre.
             + "color:" + BRAND + ";padding:12px 0 4px 12px;\">" + esc(code) + "</div>"
             + "</td></tr></table>";
    }

    /**
     * The meeting link, as a button with the address spelt out under it.
     *
     * <p>Both, deliberately. The button is what a reader taps; the plain address under it is
     * what survives a client that strips links, a forwarded copy, and a student reading the mail
     * on one device while joining on another. A button on its own leaves those readers with no
     * way in.
     */
    static String joinBlock(String url, String label, String note) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td align=\"center\" style=\"background:" + TINT + ";border:1px solid " + TINT_EDGE + ";"
             + "border-radius:12px;padding:24px 18px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";"
             + "padding-bottom:14px;\">" + esc(label) + "</div>"
             + "<a href=\"" + escAttr(url) + "\" style=\"display:inline-block;background:" + BRAND + ";"
             + "color:#ffffff;font-family:" + FONT + ";font-size:15px;font-weight:600;"
             + "text-decoration:none;padding:14px 34px;border-radius:8px;\">Join the session</a>"
             + "<div style=\"font-family:" + FONT + ";font-size:12px;line-height:1.6;"
             + "color:" + MUTED + ";padding-top:14px;word-break:break-all;\">"
             + "Or open this link:<br><a href=\"" + escAttr(url) + "\" "
             + "style=\"color:" + BRAND + ";text-decoration:underline;\">" + esc(url) + "</a></div>"
             + (note == null || note.isEmpty() ? ""
                : "<div style=\"font-family:" + FONT + ";font-size:12px;color:" + MUTED + ";"
                  + "padding-top:10px;\">" + esc(note) + "</div>")
             + "</td></tr></table>";
    }

    /** The same panel for an in-person session, where the venue is what the student needs. */
    static String venueBlock(String venue) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td style=\"background:" + TINT + ";border:1px solid " + TINT_EDGE + ";"
             + "border-radius:12px;padding:20px 18px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";\">Venue</div>"
             + "<div style=\"font-family:" + FONT + ";font-size:16px;line-height:1.55;"
             + "font-weight:600;color:" + INK + ";padding-top:8px;\">" + esc(venue) + "</div>"
             + "</td></tr></table>";
    }

    /**
     * The panel used when there is nothing to link to yet — a session with no meeting link on
     * it. Said plainly and in the same place the link would have been, because a student who
     * finds no join panel at all assumes the mail is broken and writes in.
     */
    static String pendingBlock(String label, String message) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:6px 0 18px 0;\"><tr>"
             + "<td style=\"background:#fbfbfc;border:1px dashed " + BORDER + ";"
             + "border-radius:12px;padding:20px 18px;\">"
             + "<div style=\"font-family:" + FONT + ";font-size:11px;font-weight:600;"
             + "letter-spacing:1.6px;text-transform:uppercase;color:" + MUTED + ";\">"
             + esc(label) + "</div>"
             + "<div style=\"font-family:" + FONT + ";font-size:14px;line-height:1.55;"
             + "color:" + INK + ";padding-top:8px;\">" + esc(message) + "</div>"
             + "</td></tr></table>";
    }

    /** A secondary action — report link, calendar link — below the hero block. */
    static String outlineButton(String url, String label) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" "
             + "style=\"margin:0 0 12px 0;\"><tr><td style=\"border:1px solid " + BRAND + ";"
             + "border-radius:8px;\">"
             + "<a href=\"" + escAttr(url) + "\" style=\"display:inline-block;font-family:" + FONT + ";"
             + "font-size:14px;font-weight:600;color:" + BRAND + ";text-decoration:none;"
             + "padding:11px 22px;\">" + esc(label) + "</a>"
             + "</td></tr></table>";
    }

    /** One label/value row of the details table. */
    static final class Row {
        final String label;
        /** What the plain-text alternative prints — for a link row, the address in full. */
        final String value;
        /** Set to render the value as a link; null for plain text. */
        final String href;
        /**
         * Anchor text for the HTML side, when the address itself is too long to read as one.
         * The text part still gets {@link #value}, because a reader with no HTML has to be able
         * to copy the address out.
         */
        final String display;

        Row(String label, String value) {
            this(label, value, null, null);
        }

        Row(String label, String value, String href) {
            this(label, value, href, null);
        }

        Row(String label, String value, String href, String display) {
            this.label = label;
            this.value = value;
            this.href = href;
            this.display = display;
        }
    }

    /**
     * The session facts, as a two-column table.
     *
     * <p>Labels are fixed and left-aligned so the eye runs down one column — the same reason
     * the plain-text version is written as labelled lines rather than prose.
     */
    static String detailsTable(List<Row> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" ")
          .append("style=\"margin:4px 0 18px 0;border:1px solid ").append(BORDER)
          .append(";border-radius:10px;\">");
        boolean first = true;
        for (Row r : rows) {
            if (r == null || r.value == null || r.value.isEmpty()) continue;
            String top = first ? "" : "border-top:1px solid " + BORDER + ";";
            first = false;
            sb.append("<tr>")
              .append("<td width=\"34%\" style=\"").append(top)
              .append("padding:11px 14px;font-family:").append(FONT)
              .append(";font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;")
              .append("color:").append(MUTED).append(";vertical-align:top;\">")
              .append(esc(r.label)).append("</td>")
              .append("<td style=\"").append(top)
              .append("padding:11px 14px;font-family:").append(FONT)
              .append(";font-size:14px;line-height:1.55;color:").append(INK)
              .append(";vertical-align:top;word-break:break-word;\">");
            if (r.href != null && !r.href.isEmpty()) {
                String text = r.display != null && !r.display.isEmpty() ? r.display : r.value;
                sb.append("<a href=\"").append(escAttr(r.href)).append("\" style=\"color:")
                  .append(BRAND).append(";text-decoration:underline;\">").append(esc(text))
                  .append("</a>");
            } else {
                sb.append(esc(r.value));
            }
            sb.append("</td></tr>");
        }
        sb.append("</table>");
        return sb.toString();
    }

    /**
     * The same rows as the indented plain-text block, for the text alternative.
     *
     * <p>A row with an empty label prints its value alone — the attendance line arrives already
     * carrying its own "Venue: " / "Join online: " prefix.
     */
    static String detailsText(List<Row> rows) {
        StringBuilder sb = new StringBuilder();
        for (Row r : rows) {
            if (r == null || r.value == null || r.value.isEmpty()) continue;
            sb.append("  ");
            if (r.label != null && !r.label.isEmpty()) sb.append(r.label).append(": ");
            sb.append(r.value).append("\n");
        }
        return sb.toString();
    }

    static List<Row> rows() {
        return new ArrayList<Row>();
    }

    // ─── escaping ─────────────────────────────────────────────────────────────────

    /**
     * Names, school names and venues are user-entered and land inside markup, so they are
     * escaped rather than trusted. An unescaped ampersand in a school name is the common case;
     * the rest is why it is done properly.
     */
    static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    /** As {@link #esc}, plus the single quote, for values going into an attribute. */
    static String escAttr(String s) {
        return esc(s).replace("'", "&#39;");
    }
}
