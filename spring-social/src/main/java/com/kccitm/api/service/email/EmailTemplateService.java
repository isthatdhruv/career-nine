package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;

/**
 * CRUD + single-default-per-type enforcement + preview/test for {@link EmailTemplate}, plus
 * the {@link EmailType} catalog the editor reads for its type list and placeholder palette.
 */
@Service
public class EmailTemplateService {

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Autowired
    private EmailDispatchService dispatchService;

    @Autowired
    private EmailTemplateRenderer renderer;

    @Autowired
    private InstituteBrandingService brandingService;

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

    // ─── preview / test ──────────────────────────────────────────────────

    /** Server-side render of a (possibly unsaved) template with sample values, for the editor preview. */
    public Map<String, Object> preview(EmailTemplateForm form) {
        EmailType type = EmailType.from(form.emailType);
        Map<String, String> ctx = sampleContext(type);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subject", renderer.render(form.subjectTemplate, ctx));
        out.put("html", renderer.render(form.bodyTemplate, ctx));
        return out;
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
        req.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        req.setTemplateContext(sampleContext(type));
        return dispatchService.send(req);
    }

    // ─── catalog ─────────────────────────────────────────────────────────

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
    }

    private void apply(EmailTemplate t, EmailTemplateForm f, Long userId, boolean isCreate) {
        if (f.name != null) {
            t.setName(f.name.trim());
        }
        if (f.emailType != null) {
            t.setEmailType(f.emailType.trim().toUpperCase());
        }
        if (f.subjectTemplate != null) {
            t.setSubjectTemplate(f.subjectTemplate);
        }
        if (f.bodyTemplate != null) {
            t.setBodyTemplate(f.bodyTemplate);
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
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("emailType", t.getEmailType());
        m.put("subjectTemplate", t.getSubjectTemplate());
        m.put("bodyTemplate", t.getBodyTemplate());
        m.put("isDefault", t.getIsDefault());
        m.put("deliveryMode", t.getDeliveryMode() != null ? t.getDeliveryMode().name() : null);
        m.put("active", t.getActive());
        m.put("createdAt", t.getCreatedAt());
        m.put("updatedAt", t.getUpdatedAt());
        return m;
    }

    private Map<String, String> sampleContext(EmailType type) {
        Map<String, String> ctx = new LinkedHashMap<>();
        BrandingDto brand = BrandingDto.standard();
        if (type != null) {
            for (EmailPlaceholder p : type.placeholders()) {
                ctx.put(p.key(), sampleValue(p, brand));
            }
        }
        ctx.putIfAbsent(EmailPlaceholder.EMAIL_HEADER.key(), brandingService.emailHeaderHtml(brand));
        ctx.putIfAbsent(EmailPlaceholder.EMAIL_FOOTER.key(), brandingService.emailFooterHtml(brand));
        ctx.putIfAbsent(EmailPlaceholder.SCHOOL_NAME.key(), "Career-9");
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
            case LOGO_URL:       return "";
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
            default:             return p.label();
        }
    }
}
