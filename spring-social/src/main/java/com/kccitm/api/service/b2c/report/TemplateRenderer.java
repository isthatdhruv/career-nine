package com.kccitm.api.service.b2c.report;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

/**
 * Pure string substitution: every {@code {{key}}} occurrence in the template
 * is replaced by the corresponding map value (or {@code ""} when missing).
 * Lifted from {@code FourPagerEngineService.fillTemplate} (lines 403-430) so
 * BET / Legacy / Pager renderers all run identical placeholder semantics.
 */
@Component
public class TemplateRenderer {

    public String fill(String template, Map<String, Object> data) {
        if (template == null) return "";
        Map<String, String> str = stringify(data);
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
                out.append(v != null ? v : "");
            } else {
                out.append(template, open, close + 2);
            }
            i = close + 2;
        }
        return out.toString();
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
