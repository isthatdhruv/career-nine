package com.kccitm.api.service.b2c.report;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Pure string substitution: every {@code {{key}}} occurrence in the template
 * is replaced by the corresponding map value (or {@code ""} when missing).
 * Lifted from {@code FourPagerEngineService.fillTemplate} (lines 403-430) so
 * BET / Legacy / Pager renderers all run identical placeholder semantics.
 *
 * <p>Bundled pages (exported designs whose real markup lives as a JSON string in
 * {@code <script type="__bundler/template">}) are filled context-aware: the JSON is
 * decoded, filled, and re-encoded, so a value carrying quotes, backslashes or line
 * breaks (an SVG, a row of HTML) cannot break the JSON and blank the page. Inside
 * the decoded markup, placeholders that sit in a {@code <script>} block are
 * additionally escaped for a JavaScript string literal. Plain HTML templates are
 * filled exactly as before.
 */
@Component
public class TemplateRenderer {

    private static final Pattern BUNDLED_TEMPLATE = Pattern.compile(
            "(<script type=\"__bundler/template\">)(.*?)(</script>)", Pattern.DOTALL);
    private static final Pattern SCRIPT_BLOCK = Pattern.compile("<script\\b[^>]*>.*?</script>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final ObjectMapper JSON = new ObjectMapper();

    public String fill(String template, Map<String, Object> data) {
        if (template == null) return "";
        Map<String, String> str = stringify(data);
        Matcher m = BUNDLED_TEMPLATE.matcher(template);
        if (!m.find()) return fillPlain(template, str, false);

        StringBuilder out = new StringBuilder(template.length());
        int last = 0;
        do {
            out.append(fillPlain(template.substring(last, m.start()), str, false));
            out.append(m.group(1)).append(fillBundled(m.group(2), str)).append(m.group(3));
            last = m.end();
        } while (m.find());
        out.append(fillPlain(template.substring(last), str, false));
        return out.toString();
    }

    /** Decodes the JSON-string template, fills it (JS-escaping inside inner scripts), re-encodes it. */
    private String fillBundled(String jsonBody, Map<String, String> str) {
        String markup;
        try {
            markup = JSON.readValue(jsonBody.trim(), String.class);
        } catch (JsonProcessingException e) {
            // Not a JSON string after all — fill as-is rather than fail the report.
            return fillPlain(jsonBody, str, false);
        }
        StringBuilder filled = new StringBuilder(markup.length());
        Matcher s = SCRIPT_BLOCK.matcher(markup);
        int last = 0;
        while (s.find()) {
            filled.append(fillPlain(markup.substring(last, s.start()), str, false));
            filled.append(fillPlain(s.group(), str, true));
            last = s.end();
        }
        filled.append(fillPlain(markup.substring(last), str, false));
        try {
            // "</" is escaped so the encoded string can never close the outer <script>.
            return "\n" + JSON.writeValueAsString(filled.toString()).replace("</", "<\\/") + "\n";
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("could not re-encode bundled template", e);
        }
    }

    private static String fillPlain(String template, Map<String, String> str, boolean jsString) {
        StringBuilder out = new StringBuilder(template.length());
        int i = 0;
        while (i < template.length()) {
            int open = template.indexOf("{{", i);
            if (open < 0) {
                out.append(template, i, template.length());
                break;
            }
            out.append(template, i, open);
            int close = template.indexOf("}}", open + 2);
            if (close < 0) {
                out.append(template, open, template.length());
                break;
            }
            String key = template.substring(open + 2, close).trim();
            // '%' is allowed so career-percentage keys like {{p1%}} resolve.
            if (key.matches("[a-zA-Z0-9_%]+") && str.containsKey(key)) {
                String v = str.get(key);
                v = v != null ? v : "";
                out.append(jsString ? jsEscape(v) : v);
            } else {
                out.append(template, open, close + 2);
            }
            i = close + 2;
        }
        return out.toString();
    }

    /** Safe inside a single- or double-quoted JavaScript string literal within a script block. */
    static String jsEscape(String v) {
        StringBuilder b = new StringBuilder(v.length() + 8);
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            switch (c) {
                case '\\': b.append("\\\\"); break;
                case '\'': b.append("\\'"); break;
                case '"':  b.append("\\\""); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case ' ': b.append("\\u2028"); break;
                case ' ': b.append("\\u2029"); break;
                case '<':
                    if (i + 1 < v.length() && v.charAt(i + 1) == '/') b.append("<\\"); else b.append(c);
                    break;
                default: b.append(c);
            }
        }
        return b.toString();
    }

    private static Map<String, String> stringify(Map<String, Object> in) {
        Map<String, String> out = new HashMap<>();
        if (in == null) return out;
        for (Map.Entry<String, Object> e : in.entrySet()) {
            Object v = e.getValue();
            out.put(e.getKey(), v == null ? "" : String.valueOf(v));
        }
        return out;
    }
}
