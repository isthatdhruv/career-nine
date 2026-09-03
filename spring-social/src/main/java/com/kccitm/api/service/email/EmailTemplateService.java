package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.email.EmailDeliveryMode;
import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailTemplateForm;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;
import com.kccitm.api.model.email.PortState;
import com.kccitm.api.model.email.ReviewStatus;
import com.kccitm.api.model.email.SeedOrigin;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;

/**
 * CRUD + single-default-per-type enforcement + preview/test for {@link EmailTemplate}, plus
 * the {@link EmailType} catalog the editor reads for its type list and placeholder palette,
 * and the mail catalogue: every template with its provenance, live state, edit state, lint
 * findings and review verdict.
 */
@Service
public class EmailTemplateService {

    private static final Pattern TOKEN = Pattern.compile("\\{\\{([#^/]?)([A-Za-z0-9_]+)\\}\\}");

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Autowired
    private EmailDispatchService dispatchService;

    @Autowired
    private EmailTemplateRenderer renderer;

    @Autowired
    private InstituteBrandingService brandingService;

    @Autowired
    private EmailTemplateLinter linter;

    // ─── CRUD ────────────────────────────────────────────────────────────

    public List<Map<String, Object>> list(String emailType) {
        List<EmailTemplate> rows = (emailType == null || emailType.trim().isEmpty())
                ? templateRepository.findAllByOrderByEmailTypeAscNameAsc()
                : templateRepository.findByEmailTypeOrderByNameAsc(emailType.trim().toUpperCase());
        List<Map<String, Object>> out = new ArrayList<>();
        for (EmailTemplate t : rows) {
            out.add(toDto(t));
        }
        return out;
    }

    public Map<String, Object> get(Long id) {
        return templateRepository.findById(id).map(this::toDto).orElse(null);
    }

    @Transactional
    public Map<String, Object> create(EmailTemplateForm form, Long userId) {
        validate(form, true);
        EmailTemplate t = new EmailTemplate();
        if (form.mailKey == null || form.mailKey.trim().isEmpty()) {
            form.mailKey = null;
        }
        t.setSeedOrigin(SeedOrigin.MANUAL);
        t.setPortState(PortState.PORTED);
        apply(t, form, userId, true);
        t = templateRepository.save(t);
        enforceSingleDefault(t);
        return toDto(t);
    }

    @Transactional
    public Map<String, Object> update(Long id, EmailTemplateForm form, Long userId) {
        EmailTemplate t = templateRepository.findById(id).orElse(null);
        if (t == null) {
            return null;
        }
        validate(form, false);
        apply(t, form, userId, false);
        t = templateRepository.save(t);
        enforceSingleDefault(t);
        return toDto(t);
    }

    @Transactional
    public boolean delete(Long id) {
        if (!templateRepository.existsById(id)) {
            return false;
        }
        templateRepository.deleteById(id);
        return true;
    }

    // ─── review ──────────────────────────────────────────────────────────

    /** Record the admin's verdict on a catalogue row. Null status keeps the current one. */
    @Transactional
    public Map<String, Object> review(Long id, String status, String notes, Long userId) {
        EmailTemplate t = templateRepository.findById(id).orElse(null);
        if (t == null) {
            return null;
        }
        if (status != null) {
            ReviewStatus rs = ReviewStatus.from(status);
            if (rs == null) {
                throw new IllegalArgumentException("unknown reviewStatus: " + status);
            }
            t.setReviewStatus(rs);
        }
        if (notes != null) {
            t.setReviewNotes(notes.trim().isEmpty() ? null : notes);
        }
        t.setReviewedBy(userId);
        t.setReviewedAt(new Date());
        return toDto(templateRepository.save(t));
    }

    // ─── preview / lint / test ───────────────────────────────────────────

    /**
     * Server-side render of a (possibly unsaved) template with sample values, for the editor
     * preview. Every {{token}} the template uses gets a value: the type's palette first, then
     * a sample derived from the key name for anything not in the palette yet, then the
     * template's variant flags (default on), then the caller's {@code previewOverrides}.
     */
    public Map<String, Object> preview(EmailTemplateForm form) {
        EmailType type = EmailType.from(form.emailType);
        BrandingDto brand = Boolean.TRUE.equals(form.whitelabel) ? whitelabelSample() : BrandingDto.standard();
        Map<String, String> ctx = previewContext(type, brand, form.subjectTemplate, form.bodyTemplate,
                form.textTemplate, form.variantFlags, form.previewOverrides);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subject", renderer.render(form.subjectTemplate, ctx));
        out.put("html", renderer.render(form.bodyTemplate, ctx));
        out.put("text", renderer.render(form.textTemplate, ctx));
        return out;
    }

    /** Lint a (possibly unsaved) template. */
    public List<Map<String, Object>> lint(EmailTemplateForm form) {
        EmailType type = EmailType.from(form.emailType);
        return EmailTemplateLinter.toMaps(linter.lint(form.subjectTemplate, form.bodyTemplate,
                form.textTemplate, MailClass.from(form.mailClass), type, form.variantFlags));
    }

    /** Send a real test email through a saved template (sample placeholder values). */
    public EmailSendResult sendTest(Long id, String to) {
        EmailTemplate t = templateRepository.findById(id).orElse(null);
        if (t == null) {
            return null;
        }
        if (to == null || to.trim().isEmpty()) {
            return EmailSendResult.skipped(null, "No recipient");
        }
        EmailType type = EmailType.from(t.getEmailType());
        EmailSendRequest req = new EmailSendRequest();
        req.setEmailType(type != null ? type : EmailType.GENERIC);
        req.setTo(new ArrayList<>(java.util.Collections.singletonList(to.trim())));
        req.setOverrideTemplateId(t.getId());
        req.setAllowContentOnlyTemplate(true);
        req.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        req.setTemplateContext(previewContext(type, BrandingDto.standard(), t.getSubjectTemplate(),
                t.getBodyTemplate(), t.getTextTemplate(), t.variantFlagList(), null));
        return dispatchService.send(req);
    }

    // ─── catalog (EmailType palette) ─────────────────────────────────────

    /** The EmailType catalog the editor reads: every send-scenario + its placeholder palette. */
    public List<Map<String, Object>> catalog() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (EmailType type : EmailType.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", type.name());
            m.put("label", type.label());
            m.put("category", type.category());
            m.put("defaultDeliveryMode", type.defaultDeliveryMode().name());
            List<Map<String, Object>> ph = new ArrayList<>();
            for (EmailPlaceholder p : type.placeholders()) {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("key", p.key());
                pm.put("label", p.label());
                pm.put("group", p.group());
                ph.add(pm);
            }
            m.put("placeholders", ph);
            out.add(m);
        }
        return out;
    }

    // ─── catalogue (every mail, with provenance and review state) ────────

    public Map<String, Object> catalogue() {
        List<EmailTemplate> rows = templateRepository.findAllByOrderByEmailTypeAscNameAsc();
        List<Map<String, Object>> out = new ArrayList<>();
        int live = 0, contentOnly = 0, manual = 0, unedited = 0, notReviewed = 0, approved = 0,
                needsChange = 0, withFindings = 0;
        for (EmailTemplate t : rows) {
            Map<String, Object> dto = toDto(t);
            EmailType type = EmailType.from(t.getEmailType());
            dto.put("typeLabel", type != null ? type.label() : t.getEmailType());
            dto.put("category", type != null ? type.category() : "Other");
            dto.put("hasText", t.getTextTemplate() != null && !t.getTextTemplate().trim().isEmpty());
            dto.remove("bodyTemplate");
            dto.remove("textTemplate");
            dto.remove("subjectTemplate");
            out.add(dto);

            if (Boolean.TRUE.equals(dto.get("live"))) live++;
            if (t.getPortState() == PortState.CONTENT_ONLY) contentOnly++;
            if (t.getSeedOrigin() == SeedOrigin.MANUAL || t.getSeedOrigin() == null) manual++;
            if (t.getSeededHash() != null && !Boolean.TRUE.equals(dto.get("edited"))) unedited++;
            ReviewStatus rs = t.getReviewStatus() != null ? t.getReviewStatus() : ReviewStatus.NOT_REVIEWED;
            if (rs == ReviewStatus.NOT_REVIEWED) notReviewed++;
            if (rs == ReviewStatus.APPROVED) approved++;
            if (rs == ReviewStatus.NEEDS_CHANGE) needsChange++;
            List<?> findings = (List<?>) dto.get("findings");
            if (findings != null && !findings.isEmpty()) withFindings++;
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", rows.size());
        summary.put("live", live);
        summary.put("contentOnly", contentOnly);
        summary.put("manual", manual);
        summary.put("unedited", unedited);
        summary.put("notReviewed", notReviewed);
        summary.put("approved", approved);
        summary.put("needsChange", needsChange);
        summary.put("withFindings", withFindings);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("rows", out);
        result.put("unlisted", unlisted());
        return result;
    }

    /** Mails that exist in the system but have no fixed copy to show, with the reason. */
    private static List<Map<String, Object>> unlisted() {
        List<Map<String, Object>> out = new ArrayList<>();
        out.add(unlisted("Contact-person report compose box",
                "Subject and body are typed by the admin at send time (send-report-email). Those sends appear in the email log only."));
        out.add(unlisted("Lead export mail",
                "Subject and body are typed by the admin at send time (leads email-export), with the spreadsheet attached. Log only."));
        out.add(unlisted("Send-with-attachment endpoint",
                "Free-text admin mail (email send-with-attachment). Log only."));
        out.add(unlisted("Legacy KCCITM student and faculty mails",
                "Their sender is a no-op stub; nothing is sent today."));
        out.add(unlisted("Student ID / details, Email verification OTP",
                "Scenario slots exist but nothing in the code sends them yet."));
        return out;
    }

    private static Map<String, Object> unlisted(String what, String why) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("what", what);
        m.put("why", why);
        return m;
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private void validate(EmailTemplateForm form, boolean isCreate) {
        if (isCreate) {
            if (form.name == null || form.name.trim().isEmpty()) {
                throw new IllegalArgumentException("name is required");
            }
            if (EmailType.from(form.emailType) == null) {
                throw new IllegalArgumentException("a valid emailType is required");
            }
        } else if (form.emailType != null && EmailType.from(form.emailType) == null) {
            throw new IllegalArgumentException("unknown emailType: " + form.emailType);
        }
        if (form.mailClass != null && !form.mailClass.trim().isEmpty() && MailClass.from(form.mailClass) == null) {
            throw new IllegalArgumentException("unknown mailClass: " + form.mailClass);
        }
    }

    private void apply(EmailTemplate t, EmailTemplateForm f, Long userId, boolean isCreate) {
        if (f.name != null) {
            t.setName(f.name.trim());
        }
        if (f.emailType != null) {
            t.setEmailType(f.emailType.trim().toUpperCase());
        }
        if (f.mailKey != null) {
            String k = f.mailKey.trim();
            t.setMailKey(k.isEmpty() ? null : k);
        }
        if (f.subjectTemplate != null) {
            t.setSubjectTemplate(f.subjectTemplate);
        }
        if (f.bodyTemplate != null) {
            t.setBodyTemplate(f.bodyTemplate);
        }
        if (f.textTemplate != null) {
            t.setTextTemplate(f.textTemplate.trim().isEmpty() ? null : f.textTemplate);
        }
        if (f.mailClass != null) {
            t.setMailClass(MailClass.from(f.mailClass)); // blank clears it
        }
        if (f.variantFlags != null) {
            t.setVariantFlagList(f.variantFlags);
        }
        if (f.deliveryMode != null) {
            t.setDeliveryMode(f.deliveryMode);
        }
        if (f.isDefault != null) {
            t.setIsDefault(f.isDefault);
        } else if (isCreate) {
            t.setIsDefault(false);
        }
        if (f.active != null) {
            t.setActive(f.active);
        } else if (isCreate) {
            t.setActive(true);
        }
        if (Boolean.TRUE.equals(t.getIsDefault()) && t.getPortState() == PortState.CONTENT_ONLY) {
            throw new IllegalArgumentException("This template was ported from code for review only. "
                    + "Its sender still builds the mail in Java, so it cannot be made the default "
                    + "until that sender is migrated; its placeholders would render empty.");
        }
        t.setUpdatedBy(userId);
    }

    /** At most one default template per email_type. */
    private void enforceSingleDefault(EmailTemplate saved) {
        if (!Boolean.TRUE.equals(saved.getIsDefault())) {
            return;
        }
        for (EmailTemplate other : templateRepository.findByEmailTypeAndIsDefaultTrue(saved.getEmailType())) {
            if (!other.getId().equals(saved.getId())) {
                other.setIsDefault(false);
                templateRepository.save(other);
            }
        }
    }

    private Map<String, Object> toDto(EmailTemplate t) {
        EmailType type = EmailType.from(t.getEmailType());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("emailType", t.getEmailType());
        m.put("mailKey", t.getMailKey());
        m.put("subjectTemplate", t.getSubjectTemplate());
        m.put("bodyTemplate", t.getBodyTemplate());
        m.put("textTemplate", t.getTextTemplate());
        m.put("mailClass", t.getMailClass() != null ? t.getMailClass().name() : null);
        m.put("seedOrigin", t.getSeedOrigin() != null ? t.getSeedOrigin().name() : null);
        m.put("sourceRef", t.getSourceRef());
        m.put("portState", (t.getPortState() != null ? t.getPortState() : PortState.PORTED).name());
        m.put("variantFlags", t.variantFlagList());
        m.put("reviewStatus", (t.getReviewStatus() != null ? t.getReviewStatus() : ReviewStatus.NOT_REVIEWED).name());
        m.put("reviewNotes", t.getReviewNotes());
        m.put("reviewedBy", t.getReviewedBy());
        m.put("reviewedAt", t.getReviewedAt());
        m.put("isDefault", t.getIsDefault());
        m.put("deliveryMode", t.getDeliveryMode() != null ? t.getDeliveryMode().name() : null);
        m.put("active", t.getActive());
        m.put("createdAt", t.getCreatedAt());
        m.put("updatedAt", t.getUpdatedAt());
        m.put("updatedBy", t.getUpdatedBy());
        m.put("edited", isEdited(t));
        m.put("live", isLive(t));
        m.put("findings", EmailTemplateLinter.toMaps(linter.lint(t.getSubjectTemplate(), t.getBodyTemplate(),
                t.getTextTemplate(), t.getMailClass(), type, t.variantFlagList())));
        return m;
    }

    /** Live means the dispatcher will render this template for automatic sends of its type. */
    private static boolean isLive(EmailTemplate t) {
        return Boolean.TRUE.equals(t.getIsDefault())
                && Boolean.TRUE.equals(t.getActive())
                && t.getPortState() != PortState.CONTENT_ONLY;
    }

    /** Edited means the content differs from what was seeded; false when nothing was seeded. */
    private static boolean isEdited(EmailTemplate t) {
        if (t.getSeededHash() == null) {
            return false;
        }
        return !t.getSeededHash().equals(TemplateContentHash.of(t.getSubjectTemplate(), t.getBodyTemplate(),
                t.getTextTemplate()));
    }

    // ─── sample data ─────────────────────────────────────────────────────

    private Map<String, String> previewContext(EmailType type, BrandingDto brand, String subject, String body,
                                               String text, List<String> variantFlags,
                                               Map<String, String> overrides) {
        Map<String, String> ctx = sampleContext(type, brand);
        for (String key : tokensOf(subject, body, text)) {
            if (!ctx.containsKey(key)) {
                ctx.put(key, derivedSample(key));
            }
        }
        if (variantFlags != null) {
            for (String flag : variantFlags) {
                if (flag != null && !flag.trim().isEmpty()) {
                    ctx.put(flag.trim(), "true");
                }
            }
        }
        if (overrides != null) {
            for (Map.Entry<String, String> e : overrides.entrySet()) {
                if (e.getKey() != null) {
                    ctx.put(e.getKey(), e.getValue() == null ? "" : e.getValue());
                }
            }
        }
        return ctx;
    }

    private Map<String, String> sampleContext(EmailType type, BrandingDto brand) {
        Map<String, String> ctx = new LinkedHashMap<>();
        if (type != null) {
            for (EmailPlaceholder p : type.placeholders()) {
                ctx.put(p.key(), sampleValue(p, brand));
            }
        }
        ctx.put(EmailPlaceholder.EMAIL_HEADER.key(), brandingService.emailHeaderHtml(brand));
        ctx.put(EmailPlaceholder.EMAIL_FOOTER.key(), brandingService.emailFooterHtml(brand));
        ctx.put(EmailPlaceholder.SCHOOL_NAME.key(), brand.isWhitelabel() ? brand.getSchoolName() : "Career-9");
        ctx.put(EmailPlaceholder.LOGO_URL.key(), brand.getLogoUrl() != null ? brand.getLogoUrl() : "");
        return ctx;
    }

    private String sampleValue(EmailPlaceholder p, BrandingDto brand) {
        switch (p) {
            case STUDENT_NAME:   return "Aanya Sharma";
            case FIRST_NAME:     return "Aanya";
            case STUDENT_EMAIL:  return "aanya@example.com";
            case USERNAME:       return "aanya01";
            case PASSWORD:       return "12-05-2008";
            case DASHBOARD_LINK:
            case ACTION_LINK:
            case RESET_LINK:     return "https://app.career-9.net/login";
            case SCHOOL_NAME:    return brand.isWhitelabel() ? brand.getSchoolName() : "Career-9";
            case LOGO_URL:       return brand.getLogoUrl() != null ? brand.getLogoUrl() : "";
            case EMAIL_HEADER:   return brandingService.emailHeaderHtml(brand);
            case EMAIL_FOOTER:   return brandingService.emailFooterHtml(brand);
            case REPORT_LINK:    return "https://app.career-9.net/report/sample";
            case REPORT_PDF_LINK:return "https://app.career-9.net/report/sample.pdf";
            case REPORT_TYPE:    return "Career Discovery Report";
            case ASSESSMENT_NAME:return "Career Discovery Assessment";
            case AMOUNT:         return "₹499";
            case PLAN_NAME:      return "Career Discovery";
            case INVOICE_ID:     return "INV-2026-00123";
            case PAYMENT_DATE:   return "29 Jun 2026";
            case OTP_CODE:       return "482913";
            case LEAD_NAME:      return "Rohan Verma";
            case LEAD_EMAIL:     return "rohan@example.com";
            case LEAD_PHONE:     return "+91 98765 43210";
            case LEAD_TYPE:      return "STUDENT";
            case LEAD_SOURCE:    return "career-9.com";
            case LEAD_SCHOOL:    return "Sunrise Public School";
            case LEAD_CITY:      return "Pune";
            case LEAD_DESIGNATION: return "Principal";
            case LEAD_DETAILS:   return "<table><tr><td>Name</td><td>Rohan Verma</td></tr><tr><td>City</td><td>Pune</td></tr></table>";
            case LEAD_RECEIVED_AT: return "7 Sep 2026, 10:14";
            case LEAD_ID:        return "1042";
            case LEAD_CRM_LINK:  return "";
            default:             return derivedSample(p.key());
        }
    }

    /**
     * A plausible sample for a placeholder we have no fixed value for, from the shape of its
     * name, so a ported template previews as a finished mail instead of raw tokens.
     */
    static String derivedSample(String key) {
        String k = key == null ? "" : key.toLowerCase();
        switch (k) {
            case "counsellor_name":      return "Priya Menon";
            case "counsellor_email":     return "priya@career-9.net";
            case "parent_name":          return "Rohan Sharma";
            case "contact_person_name":  return "Mr. Anil Verma";
            case "admin_name":           return "Career-9 Admin";
            case "account_name":         return "Career-9 Default (Gmail API)";
            case "checkin_code":         return "4821";
            case "support_email":        return "support@career-9.net";
            case "remaining_sessions":   return "2";
            case "student_class":        return "Class 10";
            case "cancellation_reason":  return "Counsellor unavailable";
            case "dispute_outcome":      return "Accepted";
            case "failed_students":      return "Riya Patel, Kabir Rao";
            default:                     break;
        }
        if (k.startsWith("has_") || k.startsWith("is_")) return "true";
        if (k.endsWith("_html")) {
            return "<ul style=\"margin:0;padding-left:18px\"><li>Sample item one</li><li>Sample item two</li>"
                    + "<li>Sample item three</li></ul>";
        }
        if (k.endsWith("_link") || k.endsWith("_url") || k.equals("link")) {
            return "https://app.career-9.net/sample/" + k.replace("_link", "").replace("_url", "");
        }
        if (k.endsWith("_datetime") || (k.contains("date") && k.contains("time"))) return "Mon, 7 Sep 2026, 4:00 PM";
        if (k.endsWith("_date") || k.endsWith("_day")) return "7 Sep 2026";
        if (k.endsWith("_time")) return "4:00 PM";
        if (k.endsWith("_count") || k.endsWith("_total")) return "12";
        if (k.endsWith("_minutes") || k.endsWith("_mins")) return "15";
        if (k.endsWith("_email")) return "sample@example.com";
        if (k.endsWith("_phone") || k.endsWith("_mobile")) return "+91 98765 43210";
        if (k.endsWith("_code") || k.endsWith("_otp")) return "482913";
        if (k.endsWith("_id")) return "10421";
        if (k.endsWith("_name")) return "Sample " + humanize(k.substring(0, k.length() - "_name".length()));
        return humanize(k);
    }

    private static String humanize(String key) {
        StringBuilder sb = new StringBuilder();
        for (String part : key.split("_")) {
            if (part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }

    private static Set<String> tokensOf(String... parts) {
        Set<String> out = new LinkedHashSet<>();
        for (String s : parts) {
            if (s == null) continue;
            Matcher m = TOKEN.matcher(s);
            while (m.find()) {
                if (m.group(1).isEmpty()) {
                    out.add(m.group(2));
                }
            }
        }
        return out;
    }

    private static BrandingDto whitelabelSample() {
        String logo = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='48'%3E"
                + "%3Crect width='120' height='48' rx='8' fill='%231a2a3a'/%3E"
                + "%3Ctext x='60' y='30' font-family='sans-serif' font-size='14' text-anchor='middle' fill='white'%3ESCHOOL LOGO%3C/text%3E%3C/svg%3E";
        return new BrandingDto(true, "Sunrise Public School", logo);
    }
}
