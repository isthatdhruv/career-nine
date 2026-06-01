package com.kccitm.api.service.reminder;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.kccitm.api.model.reminder.ReminderServiceType;

/**
 * Lightweight {{token}} interpolation for reminder subjects and HTML bodies.
 *
 * Intentionally minimal — no conditionals, no loops, no HTML escaping of
 * surrounding text. Tokens are looked up in a context map and substituted
 * verbatim. Unknown tokens are left in place so they're visible during preview.
 */
@Service
public class ReminderTemplateRenderer {

    /**
     * The set of tokens a template may reference for each service type. The
     * frontend uses this list to populate the "insert variable" sidebar and to
     * generate sample values for the preview/test-send.
     */
    public Map<String, String> sampleContext(ReminderServiceType type) {
        Map<String, String> ctx = new LinkedHashMap<>();
        ctx.put("studentName", "Aanya Sharma");
        ctx.put("studentEmail", "aanya@example.com");
        switch (type) {
            case ASSESSMENT_INVITE_B2C:
                ctx.put("assessmentName", "Career Discovery Assessment");
                ctx.put("link", "https://app.career-9.net/take/abcd1234");
                break;
            case COUNSELLING_24H:
            case COUNSELLING_1H:
                ctx.put("counsellorName", "Ms. Priya Iyer");
                ctx.put("appointmentTime", "Tomorrow, 4:30 PM IST");
                ctx.put("meetingUrl", "https://meet.career-9.net/abc");
                break;
            case ASSESSMENT_MAPPING:
                ctx.put("assessmentName", "Class 10 Aptitude Assessment");
                ctx.put("instituteName", "Demo Public School");
                ctx.put("link", "https://app.career-9.net/take/xyz789");
                break;
        }
        return ctx;
    }

    public List<String> tokensFor(ReminderServiceType type) {
        return new java.util.ArrayList<>(sampleContext(type).keySet());
    }

    public String render(String template, Map<String, ?> context) {
        if (template == null) return "";
        if (context == null) context = new HashMap<>();
        String out = template;
        for (Map.Entry<String, ?> e : context.entrySet()) {
            String key = e.getKey();
            Object val = e.getValue();
            out = out.replace("{{" + key + "}}", val == null ? "" : val.toString());
        }
        return out;
    }
}
