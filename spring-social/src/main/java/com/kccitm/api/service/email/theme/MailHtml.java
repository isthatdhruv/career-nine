package com.kccitm.api.service.email.theme;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class MailHtml {
    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    /** Numeric character references, decimal (&#127881;) or hex (&#x1F389;). */
    private static final Pattern NUMERIC = Pattern.compile("&#(x[0-9a-fA-F]+|[0-9]+);");
    private MailHtml() { }

    static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
    static String escAttr(String s) { return esc(s).replace("'", "&#39;"); }

    /** Visible text of authored HTML: tags removed, the handful of entities we write decoded. */
    static String textOf(String html) {
        if (html == null) return "";
        String t = html.replaceAll("(?i)<br\\s*/?>", "\n");
        t = TAGS.matcher(t).replaceAll("");
        t = decodeNumeric(t);
        t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", "\"").replace("&#39;", "'").replace("&rsquo;", "’").replace("&lsquo;", "‘")
             .replace("&ldquo;", "“").replace("&rdquo;", "”").replace("&ndash;", "–").replace("&mdash;", "—")
             .replace("&middot;", "·").replace("&hellip;", "…").replace("&rarr;", "→").replace("&harr;", "↔")
             .replace("&rsaquo;", "›").replace("&copy;", "©").replace("&#8377;", "₹");
        return t.replaceAll("[ \\t]+", " ").trim();
    }

    /**
     * Emoji and punctuation are authored as numeric references so the HTML travels safely; the
     * text part must show the character itself, not the escape. An unreadable reference is left
     * exactly as it was written rather than swallowed.
     */
    private static String decodeNumeric(String s) {
        Matcher m = NUMERIC.matcher(s);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            String ref = m.group(1);
            String replacement = m.group();
            try {
                int cp = ref.charAt(0) == 'x'
                        ? Integer.parseInt(ref.substring(1), 16)
                        : Integer.parseInt(ref, 10);
                if (Character.isValidCodePoint(cp)) {
                    replacement = new StringBuilder().appendCodePoint(cp).toString();
                }
            } catch (NumberFormatException e) {
                // Not a code point we can read — keep the reference as authored.
            }
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString();
    }
}
