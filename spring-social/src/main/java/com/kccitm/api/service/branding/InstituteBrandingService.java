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
}
