package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;

/**
 * Objective checks that turn "what needs to change" into a list, per template, against
 * Google's sender guidelines and the audit findings: credentials in the body, emoji or
 * shouting in subject and headings, missing shared header/footer, no plain-text part,
 * subscribed mail without an unsubscribe line, hard-coded and off-domain links, unknown
 * placeholders, and "do not reply" copy on mail that has no Reply-To.
 *
 * <p>Findings are advisory. WARN is something a reviewer should decide on; INFO is worth
 * knowing. Nothing here blocks a save.
 */
@Service
public class EmailTemplateLinter {

    public static final String WARN = "WARN";
    public static final String INFO = "INFO";

    public static final class Finding {
        public final String code;
        public final String severity;
        public final String message;

        Finding(String code, String severity, String message) {
            this.code = code;
            this.severity = severity;
            this.message = message;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", code);
            m.put("severity", severity);
            m.put("message", message);
            return m;
        }
    }

    private static final Pattern TOKEN = Pattern.compile("\\{\\{([#^/]?)([A-Za-z0-9_]+)\\}\\}");
    private static final Pattern HREF = Pattern.compile("(?i)href\\s*=\\s*[\"']([^\"']+)[\"']");
    private static final Pattern IMG_SRC = Pattern.compile("(?i)<img[^>]*\\ssrc\\s*=\\s*[\"']([^\"']+)[\"']");
    private static final Pattern NUMERIC_ENTITY = Pattern.compile("&#(\\d+);");
    private static final Pattern HEADING = Pattern.compile("(?is)<h[1-3][^>]*>(.*?)</h[1-3]>");
    private static final Pattern CAPS_WORD = Pattern.compile("\\b[A-Z]{4,}\\b");
    private static final Pattern PASSWORD_TEXT = Pattern.compile("(?i)password\\s*(:|is\\b|-|—)");
    private static final Pattern DO_NOT_REPLY = Pattern.compile("(?i)(do not reply|don'?t reply|not monitored|please do not respond)");

    private static final Set<String> CAPS_ALLOWLIST = new HashSet<>(Arrays.asList(
            "INR", "OTP", "PDF", "URL", "LMS", "NEP", "DOB", "HTML", "FAQ", "NOTE", "KCCITM", "CBSE",
            "ICSE", "STEM", "DPDP", "CAREER", "TEAM", "HTTP", "HTTPS", "UTC", "IST", "SMS"));

    private static final Set<String> OWN_DOMAINS = new HashSet<>(Arrays.asList("career-9.net", "career-9.com"));

    public List<Finding> lint(String subject, String body, String text, MailClass mailClass, EmailType type,
                              Collection<String> variantFlags) {
        List<Finding> warn = new ArrayList<>();
        List<Finding> info = new ArrayList<>();
        String bodyHtml = body == null ? "" : body;
        String subj = subject == null ? "" : subject;
        String visible = stripTags(bodyHtml);

        if (subj.trim().isEmpty()) {
            warn.add(new Finding("MISSING_SUBJECT", WARN, "No subject line."));
        }

        // Credentials in the body.
        if (bodyHtml.contains("{{password}}") || PASSWORD_TEXT.matcher(visible).find()) {
            warn.add(new Finding("CREDENTIALS_IN_BODY", WARN,
                    "The body carries a password. Send a set-password link instead; \"your password is\" next to a login link also matches phishing heuristics."));
        }

        // Emoji in subject / headings.
        if (containsEmoji(subj)) {
            warn.add(new Finding("EMOJI_IN_SUBJECT", WARN, "The subject contains an emoji. Google's display-name and subject rules penalise decorative symbols."));
        }
        List<String> headingsWithEmoji = new ArrayList<>();
        Matcher h = HEADING.matcher(bodyHtml);
        while (h.find()) {
            if (containsEmoji(h.group(1))) {
                headingsWithEmoji.add(stripTags(h.group(1)).trim());
            }
        }
        if (!headingsWithEmoji.isEmpty()) {
            info.add(new Finding("EMOJI_IN_HEADING", INFO, "Headings contain emoji: " + join(headingsWithEmoji)));
        }

        // Shouting.
        Set<String> caps = new LinkedHashSet<>();
        Matcher c = CAPS_WORD.matcher(visible.replaceAll("\\{\\{[^}]*\\}\\}", " "));
        while (c.find()) {
            String w = c.group();
            if (!CAPS_ALLOWLIST.contains(w)) {
                caps.add(w);
            }
        }
        if (!caps.isEmpty()) {
            info.add(new Finding("ALL_CAPS_WORDS", INFO, "ALL-CAPS words in the body: " + join(caps)));
        }
        int bangsSubject = count(subj, '!');
        int bangsBody = count(visible, '!');
        if (bangsSubject > 0) {
            info.add(new Finding("EXCLAMATION_IN_SUBJECT", INFO, "The subject ends or contains an exclamation mark."));
        }
        if (bangsBody >= 2) {
            info.add(new Finding("EXCLAMATION_HEAVY", INFO, bangsBody + " exclamation marks in the body."));
        }

        // Shared chrome.
        boolean internal = mailClass == MailClass.INTERNAL;
        if (!internal && !bodyHtml.contains("{{email_header}}")) {
            info.add(new Finding("NO_SHARED_HEADER", INFO, "Does not use the shared branded header ({{email_header}})."));
        }
        if (!internal && !bodyHtml.contains("{{email_footer}}")) {
            warn.add(new Finding("NO_SHARED_FOOTER", WARN, "Uses its own footer or none. The shared footer ({{email_footer}}) is where the sender identity, contact and unsubscribe line will live."));
        }

        // Plain text.
        if (text == null || text.trim().isEmpty()) {
            info.add(new Finding("NO_TEXT_VERSION", INFO, "No plain-text version. HTML-only mail scores worse with spam filters and the Promotions classifier."));
        }

        // Unsubscribe on subscribed mail.
        if (mailClass == MailClass.SUBSCRIBED && !bodyHtml.toLowerCase().contains("unsubscribe")) {
            warn.add(new Finding("SUBSCRIBED_NO_UNSUBSCRIBE", WARN, "Classed as subscribed mail but has no unsubscribe link in the body."));
        }

        // Do-not-reply copy.
        if (DO_NOT_REPLY.matcher(visible).find()) {
            info.add(new Finding("DO_NOT_REPLY_TEXT", INFO, "Tells the reader not to reply. No message sets a Reply-To, so replies are lost; better to point at a monitored mailbox."));
        }

        // Links.
        Set<String> hardcodedHosts = new LinkedHashSet<>();
        Set<String> offDomainHosts = new LinkedHashSet<>();
        Matcher a = HREF.matcher(bodyHtml);
        while (a.find()) {
            classifyLink(a.group(1), hardcodedHosts, offDomainHosts);
        }
        Set<String> imageHosts = new LinkedHashSet<>();
        Matcher img = IMG_SRC.matcher(bodyHtml);
        while (img.find()) {
            String host = host(img.group(1));
            if (host != null && !isOwn(host)) {
                imageHosts.add(host);
            }
        }
        if (!offDomainHosts.isEmpty()) {
            warn.add(new Finding("OFF_DOMAIN_LINK", WARN, "Links to a domain other than the sending domain: " + join(offDomainHosts)));
        }
        if (!hardcodedHosts.isEmpty()) {
            info.add(new Finding("HARDCODED_LINK", INFO, "Hard-coded links instead of a link placeholder: " + join(hardcodedHosts)));
        }
        if (!imageHosts.isEmpty()) {
            info.add(new Finding("EXTERNAL_IMAGE", INFO, "Images hosted off-domain: " + join(imageHosts)));
        }

        // Unknown placeholders.
        Set<String> known = new HashSet<>();
        if (type != null) {
            for (EmailPlaceholder p : type.placeholders()) {
                known.add(p.key());
            }
        }
        for (EmailPlaceholder p : EmailPlaceholder.values()) {
            if (p.group().equals("Branding")) {
                known.add(p.key());
            }
        }
        if (variantFlags != null) {
            known.addAll(variantFlags);
        }
        Set<String> unknown = new LinkedHashSet<>();
        Set<String> sectionKeys = new HashSet<>();
        for (String s : new String[] {subj, bodyHtml, text == null ? "" : text}) {
            Matcher t = TOKEN.matcher(s);
            while (t.find()) {
                String key = t.group(2);
                if (!t.group(1).isEmpty()) {
                    sectionKeys.add(key);
                    continue;
                }
                if (!known.contains(key)) {
                    unknown.add(key);
                }
            }
        }
        if (!unknown.isEmpty()) {
            warn.add(new Finding("UNKNOWN_PLACEHOLDER", WARN, "Placeholders not in this type's palette (they would render empty or raw): " + join(unknown)));
        }
        Set<String> undeclaredFlags = new LinkedHashSet<>(sectionKeys);
        if (variantFlags != null) {
            undeclaredFlags.removeAll(variantFlags);
        }
        undeclaredFlags.removeAll(known);
        if (!undeclaredFlags.isEmpty()) {
            info.add(new Finding("UNDECLARED_SECTION_FLAG", INFO, "Section flags not declared as variants (preview cannot toggle them): " + join(undeclaredFlags)));
        }

        List<Finding> out = new ArrayList<>(warn);
        out.addAll(info);
        return out;
    }

    public static List<Map<String, Object>> toMaps(List<Finding> findings) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Finding f : findings) {
            out.add(f.toMap());
        }
        return out;
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private static void classifyLink(String href, Set<String> hardcoded, Set<String> offDomain) {
        if (href == null) return;
        String v = href.trim();
        if (v.contains("{{") || v.startsWith("mailto:") || v.startsWith("tel:") || v.startsWith("#")) {
            return;
        }
        String host = host(v);
        if (host == null) return;
        if (isOwn(host)) {
            hardcoded.add(host);
        } else {
            offDomain.add(host);
        }
    }

    private static boolean isOwn(String host) {
        String h = host.toLowerCase();
        for (String own : OWN_DOMAINS) {
            if (h.equals(own) || h.endsWith("." + own)) {
                return true;
            }
        }
        return false;
    }

    static String host(String url) {
        String v = url.trim();
        int scheme = v.indexOf("://");
        if (scheme < 0) return null;
        String rest = v.substring(scheme + 3);
        int end = rest.length();
        for (char stop : new char[] {'/', '?', '#', ':'}) {
            int i = rest.indexOf(stop);
            if (i >= 0 && i < end) end = i;
        }
        String host = rest.substring(0, end);
        return host.isEmpty() ? null : host;
    }

    static boolean containsEmoji(String s) {
        if (s == null) return false;
        if (s.codePoints().anyMatch(EmailTemplateLinter::isEmojiCodePoint)) {
            return true;
        }
        Matcher m = NUMERIC_ENTITY.matcher(s);
        while (m.find()) {
            try {
                if (isEmojiCodePoint(Integer.parseInt(m.group(1)))) return true;
            } catch (NumberFormatException ignored) {
                // not a code point
            }
        }
        return false;
    }

    private static boolean isEmojiCodePoint(int cp) {
        return (cp >= 0x1F000 && cp <= 0x1FAFF)   // pictographs, emoticons, transport, symbols
                || (cp >= 0x2600 && cp <= 0x27BF)  // misc symbols, dingbats (✨ ✅ ☀)
                || (cp >= 0x2B00 && cp <= 0x2BFF)  // arrows and stars (⭐)
                || cp == 0x2705 || cp == 0x274C;
    }

    static String stripTags(String html) {
        if (html == null) return "";
        String s = html.replaceAll("(?is)<style.*?</style>", " ")
                       .replaceAll("(?is)<script.*?</script>", " ")
                       .replaceAll("(?s)<!--.*?-->", " ")
                       .replaceAll("<[^>]+>", " ");
        return s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&mdash;", "—")
                .replace("&rsquo;", "'").replace("&hellip;", "…").replaceAll("\\s+", " ").trim();
    }

    private static int count(String s, char ch) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == ch) n++;
        }
        return n;
    }

    private static String join(Collection<String> items) {
        StringBuilder sb = new StringBuilder();
        int i = 0;
        for (String s : items) {
            if (i++ > 0) sb.append(", ");
            sb.append(s);
            if (i >= 8) {
                int rest = items.size() - i;
                if (rest > 0) sb.append(" and ").append(rest).append(" more");
                break;
            }
        }
        return sb.toString();
    }
}
