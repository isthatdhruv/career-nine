package com.kccitm.api.security;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import com.kccitm.api.service.UserActivityLogService;

public class TokenAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Autowired
    private JtiDenyListService jtiDenyListService;

    @Autowired(required = false)
    private UserActivityLogService userActivityLogService;

    private static final Logger logger = LoggerFactory.getLogger(TokenAuthenticationFilter.class);

    // URL patterns to skip logging (static assets, activity-log endpoints to avoid recursion)
    private static final List<String> SKIP_LOG_PATTERNS = Arrays.asList(
            "/activity-log/", ".png", ".jpg", ".gif", ".svg", ".css", ".js",
            ".html", ".ico", ".woff", ".woff2", ".ttf", ".map");

    /**
     * Phase 19 Plan 01 route allow-list for the assessment-scoped session cookie
     * ({@link AuthCookieService#ASSESSMENT_SESSION_COOKIE} = {@code cn_at_asmnt}).
     *
     * <p>Two purposes:
     * <ol>
     *   <li>In {@link #getJwtFromRequest}, on a request whose URI starts with one of
     *       these prefixes, the filter prefers the {@code cn_at_asmnt} cookie over the
     *       admin {@code cn_at} cookie (so an invigilator's admin tab and the student
     *       assessment tab can co-exist in the same browser without collision).</li>
     *   <li>In {@link #doFilterInternal}, a token whose {@code scope} claim is
     *       {@code "assessment"} is REJECTED on any URI NOT starting with one of these
     *       prefixes — preventing cross-scope use of the short-lived assessment JWT.</li>
     * </ol>
     *
     * <p>Sourced from {@code docs/AUTH_REDESIGN_PLAN.md} §9 + the controllers that
     * currently honour {@code X-Assessment-Session} (Heartbeat at /assessments,
     * AssessmentProctoring at /assessment-proctoring, LiveTracking at /assessments,
     * AssessmentTable at /assessments, StudentDemographicResponse at
     * /student-demographics, AssessmentAnswer at /assessment-answer, StudentInfo
     * at /student-info).
     */
    private static final List<String> ASSESSMENT_SCOPE_PATHS = Arrays.asList(
            "/assessments/",
            "/assessment-answer/",
            "/student-demographics/",
            "/assessment-proctoring/",
            "/student-info/");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                // Phase 18: consult the jti deny list AFTER signature/expiry validation
                // and BEFORE populating the security context. A revoked jti causes us to
                // skip setAuthentication entirely — the unauthenticated request falls
                // through to RestAuthenticationEntryPoint, which returns 401.
                //
                // Legacy v2.0 tokens (no `jti` claim) surface as null from getJtiFromToken
                // and isRevoked(null) returns false, so they pass through to natural expiry.
                String jti = tokenProvider.getJtiFromToken(jwt);
                if (jtiDenyListService.isRevoked(jti)) {
                    logger.warn("Rejected request — jti is on deny list (jti={})", jti);
                    filterChain.doFilter(request, response);
                    return;
                }

                // Phase 19 Plan 01: route-vs-scope guard. An assessment-scoped JWT
                // (scope=assessment, minted by /auth/assessment-session) may only be
                // used on assessment routes. A session-scoped JWT (scope=session OR
                // the claim is absent — legacy/admin tokens) is accepted on every
                // route. Cross-scope use of the assessment cookie outside the
                // allow-list is refused: we skip setAuthentication and the request
                // falls through unauthenticated, returning 401 via the entry point.
                String scope = tokenProvider.getScopeFromToken(jwt);
                if ("assessment".equals(scope)) {
                    if (!isAssessmentScopePath(request.getRequestURI())) {
                        logger.warn("Refusing assessment-scoped token on non-assessment path uri={}",
                                request.getRequestURI());
                        filterChain.doFilter(request, response);
                        return;
                    }
                    // On the allow-listed path: surface the (userStudentId, assessmentId)
                    // pair as request attributes so downstream controllers/interceptors
                    // can read them without re-parsing the JWT, and populate a minimal
                    // Authentication so Spring Security's .anyRequest().authenticated()
                    // gate passes. We deliberately do NOT load a full UserPrincipal — the
                    // assessment JWT subject is a userStudentId (NOT a user id) and
                    // Phase 15's permission-based authorisation surface does not apply to
                    // assessment flows. They remain ABAC-checked via StudentAssessmentMapping
                    // at the service layer, exactly as the v2.0 X-Assessment-Session path did.
                    Long aUserStudentId = tokenProvider.getStudentIdFromToken(jwt);
                    Long aAssessmentId = tokenProvider.getAssessmentIdFromToken(jwt);
                    request.setAttribute("assessmentScope", "assessment");
                    request.setAttribute("assessmentUserStudentId", aUserStudentId);
                    request.setAttribute("assessmentAssessmentId", aAssessmentId);

                    // Minimal authenticated token: principal is the userStudentId string,
                    // authorities empty. Sufficient for .authenticated() to pass on the
                    // assessment routes; controllers needing the student id read the
                    // request attribute (typed Long, no string-parse round-trip).
                    UsernamePasswordAuthenticationToken assessmentAuth =
                            new UsernamePasswordAuthenticationToken(
                                    String.valueOf(aUserStudentId),
                                    null,
                                    Collections.<org.springframework.security.core.GrantedAuthority>emptyList());
                    assessmentAuth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(assessmentAuth);
                    filterChain.doFilter(request, response);
                    return;
                }

                // Phase 15: parse the full claim shape (roles/perms/scopes/sa/jti).
                TokenProvider.TokenClaims claims = tokenProvider.parseClaims(jwt);
                UserDetails userDetails = customUserDetailsService.loadUserById(claims.userId);

                // Hydrate the principal with the JWT-carried RBAC + ABAC state so
                // @auth.allows(...) doesn't have to round-trip to the DB per request.
                if (userDetails instanceof UserPrincipal) {
                    UserPrincipal up = (UserPrincipal) userDetails;
                    // Permissions are NOT carried in the JWT (would blow the 4 KB cookie
                    // limit for admin users with 400+ codes). loadUserById above already
                    // hydrated up.permissions from the DB via the role_permission walk,
                    // so we deliberately leave that value alone. Scopes / sa / jti still
                    // come from the JWT claim since those are small and the existing
                    // filter design treats them as authoritative.
                    if (claims.isLegacyShape) {
                        // Pre-Phase-15 token: scopes claim absent too. Keep DB-loaded
                        // scopes/sa (already populated by hydrate()); just clear jti so
                        // the deny-list lookup doesn't match a stale UUID.
                        logger.warn("LEGACY_TOKEN: keeping DB-loaded perms/scopes/sa for userId={}",
                                claims.userId);
                        up.setJti(null);
                    } else {
                        up.setScopes(claims.scopes);
                        up.setSuperAdmin(claims.superAdmin);
                        up.setJti(claims.jti);
                    }
                }

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);

                // Async URL access logging - fire-and-forget, never blocks the request
                try {
                    if (userActivityLogService != null && shouldLogUrl(request.getRequestURI())) {
                        userActivityLogService.logUrlAccess(claims.userId, request.getRequestURI(), request.getMethod());
                    }
                } catch (Exception logEx) {
                    logger.error("Failed to initiate URL access logging", logEx);
                }
            }
        } catch (Exception ex) {
            logger.error("Could not set user authentication in security context", ex);
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        // Cookie-first: prefer the HttpOnly cn_at cookie (Phase 16). An HttpOnly
        // cookie cannot be set or read by JS, so it has a smaller attack surface
        // than an Authorization header that a phishing form or malicious script
        // could plant. The Bearer-header fallback below keeps the v2.0 assessment
        // app, external curl scripts, and the legacy admin frontend working through
        // the cookie-rollout overlap window.
        //
        // Phase 19 Plan 01: extends cookie-first to TWO cookies:
        //   - On assessment-route requests, prefer cn_at_asmnt (assessment-scoped JWT);
        //     fall through to cn_at if the assessment cookie is absent / empty.
        //   - On every other request, ONLY cn_at is honoured — cn_at_asmnt is ignored
        //     (it would also be rejected later by the scope guard in doFilterInternal,
        //     but reading it here lets us avoid the unnecessary parse/validate path).
        // The Bearer header is the final fallback so external admin scripts keep working.
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            String uri = request.getRequestURI() == null ? "" : request.getRequestURI();
            boolean isAssessmentPath = isAssessmentScopePath(uri);

            // On assessment paths, prefer cn_at_asmnt first.
            if (isAssessmentPath) {
                for (Cookie c : cookies) {
                    if (AuthCookieService.ASSESSMENT_SESSION_COOKIE.equals(c.getName())) {
                        String value = c.getValue();
                        if (StringUtils.hasText(value)) {
                            return value;
                        }
                    }
                }
            }

            // Admin/staff/student/counsellor session cookie — accepted on every route.
            for (Cookie c : cookies) {
                if (AuthCookieService.ACCESS_COOKIE.equals(c.getName())) {
                    String value = c.getValue();
                    if (StringUtils.hasText(value)) {
                        return value;
                    }
                }
            }
        }

        // Fallback: Authorization: Bearer <jwt>
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    /**
     * Phase 19 Plan 01 helper. Returns true iff the request URI starts with one of
     * the {@link #ASSESSMENT_SCOPE_PATHS} prefixes. Used both by
     * {@link #getJwtFromRequest} (to pick the right cookie) and by the scope guard
     * in {@link #doFilterInternal} (to enforce route-vs-scope coupling).
     */
    private boolean isAssessmentScopePath(String uri) {
        if (uri == null) return false;
        for (String prefix : ASSESSMENT_SCOPE_PATHS) {
            if (uri.startsWith(prefix)) return true;
        }
        return false;
    }

    private boolean shouldLogUrl(String uri) {
        if (uri == null) return false;
        String uriLower = uri.toLowerCase();
        for (String pattern : SKIP_LOG_PATTERNS) {
            if (uriLower.contains(pattern)) {
                return false;
            }
        }
        return true;
    }
}
