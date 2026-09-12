package com.kccitm.api.service.email.theme;

public final class Brand {
    private final boolean whitelabel; private final String schoolName; private final String schoolLogoUrl;
    private final String logoUrl; private final String supportEmail; private final String siteUrl; private final int year;

    private Brand(boolean wl, String school, String schoolLogo, String logo, String support, String site, int year) {
        this.whitelabel = wl; this.schoolName = school; this.schoolLogoUrl = schoolLogo; this.logoUrl = logo;
        this.supportEmail = support; this.siteUrl = site; this.year = year;
    }
    public static Brand standard(String logoUrl, String support, String site, int year) { return new Brand(false, null, null, logoUrl, support, site, year); }
    public static Brand whitelabel(String school, String schoolLogo, String logoUrl, String support, String site, int year) { return new Brand(true, school, schoolLogo, logoUrl, support, site, year); }
    public boolean isWhitelabel() { return whitelabel; }
    public String getSchoolName() { return schoolName; }
    public String getSchoolLogoUrl() { return schoolLogoUrl; }
    public String getLogoUrl() { return logoUrl; }
    public String getSupportEmail() { return supportEmail; }
    public String getSiteUrl() { return siteUrl; }
    public String getSiteDisplay() { return siteUrl == null ? "" : siteUrl.replaceFirst("^https?://", "").replaceAll("/+$", ""); }
    public int getYear() { return year; }
    /** "Career-9" or the school name — what copy like "Your {brand} report" should say. */
    public String getName() { return whitelabel ? schoolName : "Career-9"; }
}
