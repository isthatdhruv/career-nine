package com.kccitm.api.service.email.theme;

import java.util.regex.Pattern;

final class MailHtml {
    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
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
        t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", "\"").replace("&#39;", "'").replace("&rsquo;", "'").replace("&lsquo;", "'")
             .replace("&ldquo;", "“").replace("&rdquo;", "”").replace("&ndash;", "–").replace("&mdash;", "—")
             .replace("&middot;", "·").replace("&hellip;", "…").replace("&rarr;", "→").replace("&harr;", "↔")
             .replace("&rsaquo;", "›").replace("&copy;", "©").replace("&#8377;", "₹");
        return t.replaceAll("[ \\t]+", " ").trim();
    }
}
