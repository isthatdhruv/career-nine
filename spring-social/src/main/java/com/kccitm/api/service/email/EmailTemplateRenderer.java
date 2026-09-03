package com.kccitm.api.service.email;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

/**
 * {{token}} interpolation for email subjects, HTML bodies and plain-text bodies, with
 * Mustache-style sections so one template can carry the branches an inline Java builder
 * used to express with if/else:
 *
 * <ul>
 *   <li>{@code {{#flag}}…{{/flag}}} renders its content when {@code flag} is truthy;</li>
 *   <li>{@code {{^flag}}…{{/flag}}} renders its content when {@code flag} is falsy;</li>
 *   <li>{@code {{key}}} is replaced by the context value.</li>
 * </ul>
 *
 * <p>Truthy means a non-blank value other than {@code false}, {@code 0} or {@code no}. Sections
 * nest. Tokens and sections whose key is missing from the context are left in place for
 * tokens (so they stay visible in preview) and treated as falsy for sections. Generalizes
 * {@code ReminderTemplateRenderer}.
 */
@Service
public class EmailTemplateRenderer {

    private static final Pattern SECTION_OPEN = Pattern.compile("\\{\\{([#^])([A-Za-z0-9_]+)\\}\\}");

    public String render(String template, Map<String, String> context) {
        if (template == null) {
            return "";
        }
        String out = renderSections(template, context);
        if (context == null || context.isEmpty()) {
            return out;
        }
        for (Map.Entry<String, String> e : context.entrySet()) {
            if (e.getKey() == null) {
                continue;
            }
            out = out.replace("{{" + e.getKey() + "}}", e.getValue() == null ? "" : e.getValue());
        }
        return out;
    }

    /** True when {@code value} would render a {@code {{#key}}} section. */
    public static boolean isTruthy(String value) {
        if (value == null) {
            return false;
        }
        String v = value.trim();
        return !v.isEmpty()
                && !"false".equalsIgnoreCase(v)
                && !"0".equals(v)
                && !"no".equalsIgnoreCase(v);
    }

    private String renderSections(String s, Map<String, String> ctx) {
        Matcher m = SECTION_OPEN.matcher(s);
        StringBuilder sb = new StringBuilder(s.length());
        int pos = 0;
        while (m.find(pos)) {
            String kind = m.group(1);
            String key = m.group(2);
            int innerStart = m.end();
            int innerEnd = findClose(s, innerStart, key);
            if (innerEnd < 0) {
                break; // unmatched opener: leave the rest untouched so the problem stays visible
            }
            sb.append(s, pos, m.start());
            boolean truthy = isTruthy(ctx == null ? null : ctx.get(key));
            boolean wantTruthy = "#".equals(kind);
            if (truthy == wantTruthy) {
                sb.append(renderSections(s.substring(innerStart, innerEnd), ctx));
            }
            pos = innerEnd + ("{{/" + key + "}}").length();
        }
        sb.append(s, pos, s.length());
        return sb.toString();
    }

    /** Index of the {@code {{/key}}} that closes a section opened just before {@code from}, honouring nesting of the same key. */
    private static int findClose(String s, int from, String key) {
        String open1 = "{{#" + key + "}}";
        String open2 = "{{^" + key + "}}";
        String close = "{{/" + key + "}}";
        int depth = 1;
        int i = from;
        while (i < s.length()) {
            int c = s.indexOf(close, i);
            if (c < 0) {
                return -1;
            }
            int o1 = s.indexOf(open1, i);
            int o2 = s.indexOf(open2, i);
            int o = (o1 < 0) ? o2 : (o2 < 0 ? o1 : Math.min(o1, o2));
            if (o >= 0 && o < c) {
                depth++;
                i = o + open1.length();
                continue;
            }
            depth--;
            if (depth == 0) {
                return c;
            }
            i = c + close.length();
        }
        return -1;
    }
}
