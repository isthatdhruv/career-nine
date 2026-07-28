package com.kccitm.api.service.email;

import java.util.Map;

import org.springframework.stereotype.Service;

/**
 * Minimal {{token}} interpolation for email subjects and HTML bodies. Generalizes
 * {@code ReminderTemplateRenderer}: tokens are looked up in a context map and substituted
 * verbatim. Unknown tokens are left in place so they stay visible during preview.
 */
@Service
public class EmailTemplateRenderer {

    public String render(String template, Map<String, String> context) {
        if (template == null) {
            return "";
        }
        if (context == null || context.isEmpty()) {
            return template;
        }
        String out = template;
        for (Map.Entry<String, String> e : context.entrySet()) {
            if (e.getKey() == null) {
                continue;
            }
            out = out.replace("{{" + e.getKey() + "}}", e.getValue() == null ? "" : e.getValue());
        }
        return out;
    }
}
