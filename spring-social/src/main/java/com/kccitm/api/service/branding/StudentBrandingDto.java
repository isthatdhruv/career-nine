package com.kccitm.api.service.branding;

/**
 * {@link BrandingDto} plus the one per-assessment fact the assessment portal's thank-you
 * page needs next to it: whether the assessment's "email report" toggle is on.
 *
 * <p>Served only by {@code GET /assessments/branding/{userStudentId}?assessmentId=…}. The
 * portal combines {@code whitelabel} and {@code emailReportEnabled} to decide whether it may
 * tell the student "Report sent to your registered email" — the same rule the report
 * pipeline applies in {@code ReportGenerateConsumer}. Kept out of {@link BrandingDto}
 * itself, which is institute-scoped and reused by every email and registration surface.
 */
public class StudentBrandingDto extends BrandingDto {

    private boolean emailReportEnabled;

    public StudentBrandingDto() {
    }

    public StudentBrandingDto(boolean whitelabel, String schoolName, String logoUrl,
                              boolean emailReportEnabled) {
        super(whitelabel, schoolName, logoUrl);
        this.emailReportEnabled = emailReportEnabled;
    }

    /** Copy the institute branding and attach the assessment's email toggle. */
    public static StudentBrandingDto of(BrandingDto brand, boolean emailReportEnabled) {
        BrandingDto b = brand == null ? BrandingDto.standard() : brand;
        return new StudentBrandingDto(b.isWhitelabel(), b.getSchoolName(), b.getLogoUrl(),
                emailReportEnabled);
    }

    public boolean isEmailReportEnabled() {
        return emailReportEnabled;
    }

    public void setEmailReportEnabled(boolean emailReportEnabled) {
        this.emailReportEnabled = emailReportEnabled;
    }
}
