package com.kccitm.api.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private final Auth auth = new Auth();
    private final OAuth2 oauth2 = new OAuth2();
    private Cookie cookie = new Cookie();

    public static class Auth {
        private String tokenSecret;
        /**
         * Legacy single-TTL field — retained for backwards-compat with v2.0 (pre-Phase-18)
         * tokens already issued and for any caller of {@link com.kccitm.api.security.TokenProvider#createToken}.
         * New code MUST call {@link #getAccessTokenExpirationMsec()} or
         * {@link #getRefreshTokenExpirationMsec()} instead.
         */
        private long tokenExpirationMsec;
        /** Phase 18 short-lived access-token TTL. Default: 60 minutes. */
        private long accessTokenExpirationMsec = 3_600_000L;
        /** Phase 18 refresh-token TTL. Default: 7 days. */
        private long refreshTokenExpirationMsec = 604_800_000L;
        /**
         * Phase 19 Plan 01 assessment-scoped JWT TTL. Default: 4 hours (14_400_000 ms).
         *
         * <p>Short enough that cookie loss has bounded blast radius, long enough that a
         * student finishing one or two assessments in a session does not have to
         * re-authenticate. No refresh path — Phase 18's refresh chain deliberately
         * excludes the assessment cookie.
         */
        private long assessmentTokenExpirationMsec = 14_400_000L;

        public String getTokenSecret() {
            return tokenSecret;
        }

        public void setTokenSecret(String tokenSecret) {
            this.tokenSecret = tokenSecret;
        }

        public long getTokenExpirationMsec() {
            return tokenExpirationMsec;
        }

        public void setTokenExpirationMsec(long tokenExpirationMsec) {
            this.tokenExpirationMsec = tokenExpirationMsec;
        }

        public long getAccessTokenExpirationMsec() {
            return accessTokenExpirationMsec;
        }

        public void setAccessTokenExpirationMsec(long accessTokenExpirationMsec) {
            this.accessTokenExpirationMsec = accessTokenExpirationMsec;
        }

        public long getRefreshTokenExpirationMsec() {
            return refreshTokenExpirationMsec;
        }

        public void setRefreshTokenExpirationMsec(long refreshTokenExpirationMsec) {
            this.refreshTokenExpirationMsec = refreshTokenExpirationMsec;
        }

        public long getAssessmentTokenExpirationMsec() {
            return assessmentTokenExpirationMsec;
        }

        public void setAssessmentTokenExpirationMsec(long assessmentTokenExpirationMsec) {
            this.assessmentTokenExpirationMsec = assessmentTokenExpirationMsec;
        }
    }

    public static final class OAuth2 {
        private List<String> authorizedRedirectUris = new ArrayList<>();

        public List<String> getAuthorizedRedirectUris() {
            return authorizedRedirectUris;
        }

        public OAuth2 authorizedRedirectUris(List<String> authorizedRedirectUris) {
            this.authorizedRedirectUris = authorizedRedirectUris;
            return this;
        }
    }

    /**
     * Cookie attributes for the Phase 16 cookie-based session migration.
     *
     * <p>{@code secure} defaults to true (fail-safe — every non-dev profile keeps the
     * Secure flag on). The dev profile in application.yml explicitly flips it to false
     * so http://localhost works without TLS.
     *
     * <p>{@code sameSite} is stored as a String (not an enum) to avoid coupling to a
     * servlet-spec type. Valid values: "Strict", "Lax", "None".
     *
     * <p>{@code accessMaxAgeSeconds} is currently 864000 (10 days) so the cookie expires
     * in lockstep with {@code app.auth.tokenExpirationMsec=864000000ms}. Phase 18 will
     * lower this to 3600 once short-lived access tokens land.
     */
    public static class Cookie {
        private boolean secure = true;
        private String sameSite = "Strict";
        private int accessMaxAgeSeconds = 864000;
        // Phase 18 Plan 02: cn_rt cookie Max-Age. Defaults to 7 days (refresh-token TTL).
        private int refreshMaxAgeSeconds = 604800;

        public boolean isSecure() {
            return secure;
        }

        public void setSecure(boolean secure) {
            this.secure = secure;
        }

        public String getSameSite() {
            return sameSite;
        }

        public void setSameSite(String sameSite) {
            this.sameSite = sameSite;
        }

        public int getAccessMaxAgeSeconds() {
            return accessMaxAgeSeconds;
        }

        public void setAccessMaxAgeSeconds(int accessMaxAgeSeconds) {
            this.accessMaxAgeSeconds = accessMaxAgeSeconds;
        }

        public int getRefreshMaxAgeSeconds() {
            return refreshMaxAgeSeconds;
        }

        public void setRefreshMaxAgeSeconds(int refreshMaxAgeSeconds) {
            this.refreshMaxAgeSeconds = refreshMaxAgeSeconds;
        }
    }

    public Auth getAuth() {
        return auth;
    }

    public OAuth2 getOauth2() {
        return oauth2;
    }

    public Cookie getCookie() {
        return cookie;
    }

    public void setCookie(Cookie cookie) {
        this.cookie = cookie;
    }
}
