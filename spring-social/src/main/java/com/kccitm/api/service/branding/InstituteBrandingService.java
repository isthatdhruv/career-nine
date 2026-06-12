package com.kccitm.api.service.branding;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

/**
 * Single resolution point for per-school whitelabel branding (the "Career-9 x
 * School" feature). Every student-facing surface and every co-branded email
 * goes through here so the "is this whitelabel, and with what logo/name" rule
 * lives in exactly one place.
 *
 * <p>Whitelabel is <em>effective</em> only when the institute's
 * {@code is_whitelabel} flag is TRUE <strong>and</strong> a {@code logo_url}
 * exists — otherwise there is nothing to replace the Career-9 mark with, so we
 * fall back to {@link BrandingDto#standard()}. Null institute (B2C / lead
 * students with no school) → standard.
 *
 * <p>This service also owns the email header/footer HTML so the credential and
 * completion emails (which previously hand-rolled an identical "C9" badge each)
 * share one definition and pick up co-branding for free.
 */
@Service
public class InstituteBrandingService {

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    /** Core resolver. Null-safe: null institute → standard Career-9. */
    public BrandingDto forInstitute(InstituteDetail institute) {
        if (institute == null) {
            return BrandingDto.standard();
        }
        boolean flag = Boolean.TRUE.equals(institute.getIsWhitelabel());
        String logo = institute.getLogoUrl();
        String name = sanitizeName(institute.getInstituteName());
        // Whitelabel is effective only with the flag, a logo to show, AND a name to show.
        if (!flag || logo == null || logo.isBlank() || name == null || name.isBlank()) {
            return BrandingDto.standard();
        }
        return new BrandingDto(true, name, logo);
    }

    /**
     * Strip control characters (CR/LF/tab/…) from the school name and trim it. The name flows
     * into email subjects and the From display name, so neutralising control characters here is
     * the single-point defense against header/subject injection via a maliciously-set name.
     */
    private String sanitizeName(String name) {
        if (name == null) {
            return null;
        }
        return name.replaceAll("\\p{Cntrl}", " ").trim();
    }

    /**
     * Resolve by institute code (used by the public registration token-info
     * endpoints). Uses {@code findById(int)}, which intentionally bypasses the
     * Hibernate scope filter so anonymous/student callers still resolve the row.
     */
    public BrandingDto forInstituteCode(Integer instituteCode) {
        if (instituteCode == null) {
            return BrandingDto.standard();
        }
        return forInstitute(instituteDetailRepository.findById(instituteCode.intValue()));
    }

    /** Resolve by student (used post-login by the assessment prefetch / me endpoints). */
    public BrandingDto forUserStudent(Long userStudentId) {
        if (userStudentId == null) {
            return BrandingDto.standard();
        }
        return userStudentRepository.findById(userStudentId)
                .map(us -> forInstitute(us.getInstitute()))
                .orElseGet(BrandingDto::standard);
    }

    // ───────────────────────────────────────────────────── email branding ──

    /**
     * Inner HTML for the email "logo row" {@code <td align="center">}. Whitelabel →
     * school logo + name + grey "Powered by Career-9" subline; otherwise the
     * standard Career-9 "C9" gradient badge. Shared by every transactional email.
     */
    public String emailHeaderHtml(BrandingDto brand) {
        if (brand != null && brand.isWhitelabel()) {
            String name = escapeHtml(brand.getSchoolName());
            String logo = escapeHtml(brand.getLogoUrl());
            return "<img src=\"" + logo + "\" alt=\"" + name + " logo\" height=\"48\" "
                    + "style=\"max-height:48px;max-width:200px;display:block;margin:0 auto 8px;\" />\n"
                    + "<div style=\"font-size:18px;font-weight:700;color:#1a2a3a;letter-spacing:-0.3px;\">" + name + "</div>\n"
                    + "<div style=\"margin-top:3px;font-size:11px;color:#90a4ae;font-weight:500;letter-spacing:0.3px;\">Powered by Career-9</div>";
        }
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
                + "  <td style=\"background:linear-gradient(135deg,#4ECDC4,#44B78B);width:42px;height:42px;border-radius:12px;text-align:center;vertical-align:middle;\">\n"
                + "    <span style=\"color:#fff;font-size:20px;font-weight:700;line-height:42px;\">C9</span>\n"
                + "  </td>\n"
                + "  <td style=\"padding-left:12px;font-size:20px;font-weight:700;color:#1a2a3a;letter-spacing:-0.3px;\">Career-9</td>\n"
                + "</tr></table>";
    }

    /** Inner HTML for the email footer {@code <p>}. Keeps Career-9 attribution in both modes. */
    public String emailFooterHtml(BrandingDto brand) {
        if (brand != null && brand.isWhitelabel()) {
            return escapeHtml(brand.getSchoolName()) + " &middot; Powered by Career-9<br/>"
                    + "&copy; 2026 Career-9. All rights reserved.";
        }
        return "Career-9 &mdash; AI-Powered &middot; NEP-Aligned &middot; Science-Backed<br/>"
                + "&copy; 2026 Career-9. All rights reserved.";
    }

    private String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
