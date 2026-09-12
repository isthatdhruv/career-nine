package com.kccitm.api.service.email.theme;

import java.time.Year;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;

/** Rule 11: the shell decides branding. Callers pass an institute or a student; nobody passes header HTML. */
@Service
public class BrandResolver {
    @Autowired private InstituteBrandingService brandingService;
    @Value("${app.mail.logo-url:https://storage-c9.sgp1.cdn.digitaloceanspaces.com/branding/career-9-email-v1.png}") private String logoUrl;
    @Value("${app.mail.site-url:https://career-9.com}") private String siteUrl;
    @Value("${app.support.email:support@career-9.net}") private String supportEmail;

    public Brand standard() { return Brand.standard(logoUrl, supportEmail, siteUrl, Year.now().getValue()); }
    public Brand of(BrandingDto dto) {
        if (dto == null || !dto.isWhitelabel()) return standard();
        return Brand.whitelabel(dto.getSchoolName(), dto.getLogoUrl(), logoUrl, supportEmail, siteUrl, Year.now().getValue());
    }
    public Brand forInstitute(InstituteDetail institute) { return of(brandingService.forInstitute(institute)); }
    public Brand forInstituteCode(Integer code) { return code == null ? standard() : of(brandingService.forInstituteCode(code)); }
    public Brand forUserStudent(Long userStudentId) { return userStudentId == null ? standard() : of(brandingService.forUserStudent(userStudentId)); }
    public Brand forRequest(EmailSendRequest req) {
        if (req.getBrand() != null) return req.getBrand();
        if (req.getInstituteCode() != null) return forInstituteCode(req.getInstituteCode());
        if (req.getUserStudentId() != null) return forUserStudent(req.getUserStudentId());
        return standard();
    }
}
