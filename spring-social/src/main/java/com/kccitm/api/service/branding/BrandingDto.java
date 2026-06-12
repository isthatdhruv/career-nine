package com.kccitm.api.service.branding;

/**
 * Per-school whitelabel branding payload. Resolved once by
 * {@link InstituteBrandingService} and reused across every student-facing
 * surface (registration page, assessment legend, thank-you page) and emails.
 *
 * <p>Serialised to JSON on the public token-info / prefetch endpoints so the
 * frontend can co-brand without a separate fetch. {@code whitelabel} is the
 * single gate the UI checks; {@code schoolName}/{@code logoUrl} are populated
 * only when whitelabel is effective (flag on AND a logo URL exists).
 */
public class BrandingDto {

    private boolean whitelabel;
    private String schoolName;
    private String logoUrl;

    public BrandingDto() {
    }

    public BrandingDto(boolean whitelabel, String schoolName, String logoUrl) {
        this.whitelabel = whitelabel;
        this.schoolName = schoolName;
        this.logoUrl = logoUrl;
    }

    /** Standard (non-whitelabel) Career-9 experience. */
    public static BrandingDto standard() {
        return new BrandingDto(false, null, null);
    }

    public boolean isWhitelabel() {
        return whitelabel;
    }

    public void setWhitelabel(boolean whitelabel) {
        this.whitelabel = whitelabel;
    }

    public String getSchoolName() {
        return schoolName;
    }

    public void setSchoolName(String schoolName) {
        this.schoolName = schoolName;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }
}
