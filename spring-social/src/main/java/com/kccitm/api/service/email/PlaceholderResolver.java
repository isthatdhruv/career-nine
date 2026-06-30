package com.kccitm.api.service.email;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.service.b2c.LinkBuilder;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;

/**
 * Turns a send's context into a {{key}} → value map for template rendering. Branding
 * placeholders (header/footer/school_name/logo_url) and the dashboard link are derived
 * (whitelabel-aware) from the institute or student; per-send values (username, password,
 * amount, …) come from the request's {@code templateContext} and take precedence.
 */
@Service
public class PlaceholderResolver {

    @Autowired
    private InstituteBrandingService brandingService;

    @Autowired
    private LinkBuilder linkBuilder;

    public Map<String, String> resolve(EmailSendRequest req) {
        Map<String, String> ctx = new LinkedHashMap<>();

        // 1. Branding (whitelabel-aware) from the institute or student.
        BrandingDto brand = resolveBranding(req);
        ctx.put(EmailPlaceholder.SCHOOL_NAME.key(), brand.isWhitelabel() ? brand.getSchoolName() : "Career-9");
        ctx.put(EmailPlaceholder.LOGO_URL.key(), brand.getLogoUrl() != null ? brand.getLogoUrl() : "");
        ctx.put(EmailPlaceholder.EMAIL_HEADER.key(), brandingService.emailHeaderHtml(brand));
        ctx.put(EmailPlaceholder.EMAIL_FOOTER.key(), brandingService.emailFooterHtml(brand));

        // 2. Common links.
        ctx.put(EmailPlaceholder.DASHBOARD_LINK.key(), safe(linkBuilder.studentLogin()));

        // 3. Caller-supplied per-send values win over the derived defaults.
        if (req.getTemplateContext() != null) {
            for (Map.Entry<String, String> e : req.getTemplateContext().entrySet()) {
                if (e.getKey() != null) {
                    ctx.put(e.getKey(), e.getValue() == null ? "" : e.getValue());
                }
            }
        }

        // 4. Derive first_name from student_name when not explicitly supplied.
        if (!ctx.containsKey(EmailPlaceholder.FIRST_NAME.key())) {
            String full = ctx.get(EmailPlaceholder.STUDENT_NAME.key());
            if (full != null && !full.trim().isEmpty()) {
                String t = full.trim();
                ctx.put(EmailPlaceholder.FIRST_NAME.key(),
                        t.contains(" ") ? t.substring(0, t.indexOf(' ')) : t);
            }
        }

        // 5. HTML-escape every value except the known raw-HTML blocks, matching the escaping
        //    the original inline senders did on text fields (defense against injection).
        for (Map.Entry<String, String> e : ctx.entrySet()) {
            if (!RAW_HTML_KEYS.contains(e.getKey())) {
                e.setValue(escapeHtml(e.getValue()));
            }
        }
        return ctx;
    }

    /** Placeholders whose values are intentional HTML and must NOT be escaped. */
    private static final Set<String> RAW_HTML_KEYS = new HashSet<>(Arrays.asList(
            EmailPlaceholder.EMAIL_HEADER.key(), EmailPlaceholder.EMAIL_FOOTER.key()));

    private static String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }

    private BrandingDto resolveBranding(EmailSendRequest req) {
        if (req.getInstituteCode() != null) {
            return brandingService.forInstituteCode(req.getInstituteCode());
        }
        if (req.getUserStudentId() != null) {
            return brandingService.forUserStudent(req.getUserStudentId());
        }
        return BrandingDto.standard();
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
