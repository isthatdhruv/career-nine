package com.kccitm.api.security;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.config.AppProperties;

/**
 * Centralizes the issuance and clearing of the Phase 16 session cookies.
 *
 * <p>Two cookies are emitted as a pair on successful login:
 * <ul>
 *   <li><b>{@value #ACCESS_COOKIE}</b> — JWT access token. {@code HttpOnly; Secure; SameSite=Strict; Path=/}.
 *       Secure flag is conditional on {@code app.cookie.secure} (false in dev, true elsewhere).</li>
 *   <li><b>{@value #CSRF_COOKIE}</b> — CSRF double-submit token. NOT {@code HttpOnly} so the
 *       frontend JS can read it and echo it back as {@code X-CSRF-Token} header on
 *       every state-changing request. Spring's {@code CookieCsrfTokenRepository} (wired
 *       in {@code SecurityConfig}) is configured to use the same cookie name, so on
 *       subsequent responses Spring overwrites this cookie with its own token.</li>
 * </ul>
 *
 * <p>Spring Boot 2.5 ships Servlet API 4.0 which does NOT expose
 * {@code javax.servlet.http.Cookie.setSameSite()} (that landed in Servlet 6). We
 * therefore build the {@code Set-Cookie} header value by hand and call
 * {@code response.addHeader("Set-Cookie", value)} — the same approach
 * {@code CookieCsrfTokenRepository} uses internally.
 *
 * <p>No {@code Domain=} attribute is set: letting the browser default to the request
 * host means dev (localhost), sandbox, staging and prod all "just work" without
 * per-environment Domain config. A future split into {@code api.career-9.com} talking
 * to {@code dashboard.career-9.com} is a Phase 18+ concern.
 *
 * <p>{@code Max-Age=0} on the clear path triggers immediate browser-side deletion.
 * Full revocation (jti deny-list) lands in Phase 18.
 */
@Service
public class AuthCookieService {

    public static final String ACCESS_COOKIE = "cn_at";
    public static final String CSRF_COOKIE = "cn_csrf";
    /** Phase 18 Plan 02: refresh-token cookie name; Path scoped to /auth/refresh only. */
    public static final String REFRESH_COOKIE = "cn_rt";
    /** Path scoping for the refresh cookie — never sent on non-refresh requests. */
    public static final String REFRESH_COOKIE_PATH = "/auth/refresh";
    /**
     * Phase 19 Plan 01: assessment-scoped JWT cookie name. Distinct from the
     * admin/staff/student/counsellor {@link #ACCESS_COOKIE} so a single browser
     * can hold both an admin session and an assessment session simultaneously
     * without collision (e.g. counsellor admin tab + invigilator-launched
     * student assessment tab on a shared parent domain).
     */
    public static final String ASSESSMENT_SESSION_COOKIE = "cn_at_asmnt";

    @Autowired
    private AppProperties appProperties;

    /**
     * Writes both the access-token cookie ({@code cn_at}) and the CSRF cookie
     * ({@code cn_csrf}) to the response. Called from {@code AuthController.authenticateUser}
     * immediately before the {@code AuthResponse} body is returned.
     */
    public void issueAuthCookies(HttpServletResponse response, String jwt) {
        int maxAge = appProperties.getCookie().getAccessMaxAgeSeconds();
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();

        // cn_at — HttpOnly access token.
        response.addHeader("Set-Cookie",
                buildSetCookie(ACCESS_COOKIE, jwt, maxAge, /* httpOnly= */ true, secure, sameSite, "/"));

        // cn_csrf — non-HttpOnly so JS can read it for the double-submit pattern.
        // Seed it with a random value so the frontend has something to echo back
        // immediately after /auth/login completes. Spring's CookieCsrfTokenRepository
        // will overwrite this on the next state-changing response.
        String csrfValue = generateCsrfToken();
        response.addHeader("Set-Cookie",
                buildSetCookie(CSRF_COOKIE, csrfValue, maxAge, /* httpOnly= */ false, secure, sameSite, "/"));
    }

    /**
     * Writes both cookies with {@code Max-Age=0} to clear them. Called from
     * {@code AuthController.logout}.
     */
    public void clearAuthCookies(HttpServletResponse response) {
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();

        response.addHeader("Set-Cookie",
                buildSetCookie(ACCESS_COOKIE, "", 0, /* httpOnly= */ true, secure, sameSite, "/"));
        response.addHeader("Set-Cookie",
                buildSetCookie(CSRF_COOKIE, "", 0, /* httpOnly= */ false, secure, sameSite, "/"));
    }

    // ── Phase 18 Plan 02: split-token API (cn_at + cn_rt) ──────────────────

    /**
     * Phase 18 Plan 02. Writes ONLY the {@code cn_at} access-token cookie.
     * Used by {@code /auth/refresh} after rotation (the cn_rt is written by a
     * separate call to {@link #setRefreshToken}). Path=/, HttpOnly, SameSite from
     * properties, Secure conditional on profile.
     */
    public void setAccessToken(HttpServletResponse response, String accessJwt) {
        int maxAge = appProperties.getCookie().getAccessMaxAgeSeconds();
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();
        response.addHeader("Set-Cookie",
                buildSetCookie(ACCESS_COOKIE, accessJwt, maxAge, /* httpOnly= */ true, secure, sameSite, "/"));
    }

    /**
     * Phase 18 Plan 02. Writes the {@code cn_rt} refresh-token cookie, opaque UUID jti
     * as value. Path is scoped to {@value #REFRESH_COOKIE_PATH} so the browser never
     * sends the refresh token on regular API requests — only on the rotate endpoint.
     */
    public void setRefreshToken(HttpServletResponse response, String refreshJti) {
        int maxAge = appProperties.getCookie().getRefreshMaxAgeSeconds();
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();
        response.addHeader("Set-Cookie",
                buildSetCookie(REFRESH_COOKIE, refreshJti, maxAge, /* httpOnly= */ true, secure, sameSite,
                        REFRESH_COOKIE_PATH));
    }

    /**
     * Phase 18 Plan 02. Reads the {@code cn_rt} cookie value from the request, if present.
     */
    public Optional<String> readRefreshTokenCookie(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) {
            return Optional.empty();
        }
        for (Cookie c : request.getCookies()) {
            if (REFRESH_COOKIE.equals(c.getName())) {
                String v = c.getValue();
                if (v == null || v.isEmpty()) return Optional.empty();
                return Optional.of(v);
            }
        }
        return Optional.empty();
    }

    // ── Phase 19 Plan 01: assessment-scoped session cookie ─────────────────

    /**
     * Phase 19 Plan 01. Writes the {@code cn_at_asmnt} HttpOnly assessment-scoped
     * cookie. Distinct from {@link #setAccessToken}: a 4h TTL JWT scoped to
     * {@code /assessments/**}, {@code /assessment-answer/**},
     * {@code /student-demographics/**}, and friends (see
     * {@code TokenAuthenticationFilter.ASSESSMENT_SCOPE_PATHS} for the
     * canonical allow-list). Path is {@code /} so the assessment SPA can
     * hit any allow-listed route without per-path cookie thrash;
     * {@code TokenAuthenticationFilter}'s scope guard enforces the route
     * boundary in code rather than relying on the browser's path-match.
     *
     * <p>{@code SameSite} and {@code Secure} are pulled from the shared
     * {@code app.cookie.*} configuration so behaviour matches the admin
     * {@code cn_at} cookie per profile (dev: insecure / Strict;
     * staging+sandbox+production: Secure / Strict).
     */
    public void issueAssessmentSessionCookie(HttpServletResponse response, String jwt, int maxAgeSeconds) {
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();
        response.addHeader("Set-Cookie",
                buildSetCookie(ASSESSMENT_SESSION_COOKIE, jwt, maxAgeSeconds,
                        /* httpOnly= */ true, secure, sameSite, "/"));
    }

    /**
     * Phase 19 Plan 01. Clears the {@code cn_at_asmnt} cookie. Not currently
     * called by any handler in this plan — a future "abandon assessment"
     * endpoint or the assessment-app logout path will consume this.
     */
    public void clearAssessmentSessionCookie(HttpServletResponse response) {
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();
        response.addHeader("Set-Cookie",
                buildSetCookie(ASSESSMENT_SESSION_COOKIE, "", 0,
                        /* httpOnly= */ true, secure, sameSite, "/"));
    }

    /**
     * Phase 18 Plan 02. Convenience for {@code /auth/logout} and {@code /auth/refresh}
     * failure paths: clears {@code cn_at}, {@code cn_csrf}, AND {@code cn_rt} (the last
     * cleared at {@value #REFRESH_COOKIE_PATH} so the browser hits the correct match).
     */
    public void clearAll(HttpServletResponse response) {
        boolean secure = appProperties.getCookie().isSecure();
        String sameSite = appProperties.getCookie().getSameSite();

        response.addHeader("Set-Cookie",
                buildSetCookie(ACCESS_COOKIE, "", 0, /* httpOnly= */ true, secure, sameSite, "/"));
        response.addHeader("Set-Cookie",
                buildSetCookie(CSRF_COOKIE, "", 0, /* httpOnly= */ false, secure, sameSite, "/"));
        response.addHeader("Set-Cookie",
                buildSetCookie(REFRESH_COOKIE, "", 0, /* httpOnly= */ true, secure, sameSite,
                        REFRESH_COOKIE_PATH));
    }

    private static String buildSetCookie(String name, String value, int maxAge,
                                         boolean httpOnly, boolean secure,
                                         String sameSite, String path) {
        StringBuilder sb = new StringBuilder();
        sb.append(name).append('=').append(value == null ? "" : value);
        sb.append("; Path=").append(path);
        sb.append("; Max-Age=").append(maxAge);
        sb.append("; SameSite=").append(sameSite);
        if (httpOnly) {
            sb.append("; HttpOnly");
        }
        if (secure) {
            sb.append("; Secure");
        }
        return sb.toString();
    }

    private static String generateCsrfToken() {
        byte[] buf = new byte[32];
        new SecureRandom().nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
