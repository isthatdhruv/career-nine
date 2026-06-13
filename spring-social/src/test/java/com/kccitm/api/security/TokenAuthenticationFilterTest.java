package com.kccitm.api.security;

import java.util.Collections;

import javax.servlet.http.Cookie;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Token-carrier selection contract of {@link TokenAuthenticationFilter}.
 *
 * <p>Production regression this guards: all cookies are issued with
 * {@code Domain=career-9.com}, so an assessment session ({@code cn_at_asmnt})
 * minted on assessment.career-9.com is also sent by the browser on the admin
 * dashboard's requests to api.career-9.com. The admin Live Tracking page lives
 * on assessment-scope paths ({@code /assessments/**}), where the filter prefers
 * the assessment cookie — an expired one used to leave the request
 * unauthenticated (401) even though a valid admin {@code cn_at} was present,
 * and a valid one authenticated the admin AS the student. The filter now
 * (a) falls through to the next carrier when a candidate fails validation, and
 * (b) honours {@code X-Auth-Scope: session} to skip the assessment-cookie
 * preference entirely.
 */
class TokenAuthenticationFilterTest {

    private static final String ASMNT_JWT = "asmnt-jwt";
    private static final String ADMIN_JWT = "admin-jwt";

    private TokenAuthenticationFilter filter;
    private TokenProvider tokenProvider;
    private CustomUserDetailsService userDetailsService;
    private JtiDenyListService jtiDenyListService;

    private final UserDetails adminDetails =
            new User("admin", "n/a", Collections.emptyList());

    @BeforeEach
    void setUp() {
        filter = new TokenAuthenticationFilter();
        tokenProvider = mock(TokenProvider.class);
        userDetailsService = mock(CustomUserDetailsService.class);
        jtiDenyListService = mock(JtiDenyListService.class);
        ReflectionTestUtils.setField(filter, "tokenProvider", tokenProvider);
        ReflectionTestUtils.setField(filter, "customUserDetailsService", userDetailsService);
        ReflectionTestUtils.setField(filter, "jtiDenyListService", jtiDenyListService);
        // Optional collaborators (activity log, student repo) stay null — the
        // filter null-guards both.

        when(jtiDenyListService.isRevoked(any())).thenReturn(false);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletRequest request(String uri, Cookie... cookies) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        req.setRequestURI(uri); // MockHttpServletRequest doesn't derive this from the ctor path on all versions
        if (cookies.length > 0) {
            req.setCookies(cookies);
        }
        return req;
    }

    private void runFilter(MockHttpServletRequest req) throws Exception {
        ReflectionTestUtils.invokeMethod(filter, "doFilterInternal",
                req, new MockHttpServletResponse(), new MockFilterChain());
    }

    private void stubAdminSession() {
        when(tokenProvider.validateToken(ADMIN_JWT)).thenReturn(true);
        when(tokenProvider.getJtiFromToken(ADMIN_JWT)).thenReturn("jti-admin");
        when(tokenProvider.getScopeFromToken(ADMIN_JWT)).thenReturn("session");
        TokenProvider.TokenClaims claims = new TokenProvider.TokenClaims();
        claims.userId = 1L;
        claims.jti = "jti-admin";
        when(tokenProvider.parseClaims(ADMIN_JWT)).thenReturn(claims);
        when(userDetailsService.loadUserById(1L)).thenReturn(adminDetails);
    }

    private void stubAssessmentSession() {
        when(tokenProvider.validateToken(ASMNT_JWT)).thenReturn(true);
        when(tokenProvider.getJtiFromToken(ASMNT_JWT)).thenReturn("jti-asmnt");
        when(tokenProvider.getScopeFromToken(ASMNT_JWT)).thenReturn("assessment");
        when(tokenProvider.getStudentIdFromToken(ASMNT_JWT)).thenReturn(55L);
        when(tokenProvider.getAssessmentIdFromToken(ASMNT_JWT)).thenReturn(9L);
    }

    @Test
    @DisplayName("expired cn_at_asmnt no longer shadows a valid cn_at on assessment paths")
    void expiredAssessmentCookieFallsBackToAdminCookie() throws Exception {
        when(tokenProvider.validateToken(ASMNT_JWT)).thenReturn(false); // expired
        stubAdminSession();

        MockHttpServletRequest req = request("/assessments/12/live-tracking",
                new Cookie(AuthCookieService.ASSESSMENT_SESSION_COOKIE, ASMNT_JWT),
                new Cookie(AuthCookieService.ACCESS_COOKIE, ADMIN_JWT));
        runFilter(req);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth, "request must authenticate via the still-valid admin cookie");
        assertSame(adminDetails, auth.getPrincipal());
        assertNull(req.getAttribute("assessmentScope"),
                "must not be treated as an assessment-scoped request");
    }

    @Test
    @DisplayName("valid cn_at_asmnt still wins on assessment paths without the opt-out header")
    void validAssessmentCookiePreferredWithoutHeader() throws Exception {
        stubAssessmentSession();
        stubAdminSession();

        MockHttpServletRequest req = request("/assessments/9/live-tracking",
                new Cookie(AuthCookieService.ASSESSMENT_SESSION_COOKIE, ASMNT_JWT),
                new Cookie(AuthCookieService.ACCESS_COOKIE, ADMIN_JWT));
        runFilter(req);

        assertEquals("assessment", req.getAttribute("assessmentScope"));
        assertEquals(55L, req.getAttribute("assessmentUserStudentId"));
        assertEquals(9L, req.getAttribute("assessmentAssessmentId"));
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    @DisplayName("X-Auth-Scope: session skips the assessment cookie even when it is valid")
    void authScopeHeaderPrefersAdminSession() throws Exception {
        stubAssessmentSession();
        stubAdminSession();

        MockHttpServletRequest req = request("/assessments/12/live-tracking",
                new Cookie(AuthCookieService.ASSESSMENT_SESSION_COOKIE, ASMNT_JWT),
                new Cookie(AuthCookieService.ACCESS_COOKIE, ADMIN_JWT));
        req.addHeader("X-Auth-Scope", "session");
        runFilter(req);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertSame(adminDetails, auth.getPrincipal(),
                "dashboard request must authenticate as the admin, not the student");
        assertNull(req.getAttribute("assessmentScope"));
    }

    @Test
    @DisplayName("cn_at_asmnt is ignored on non-assessment paths")
    void assessmentCookieIgnoredOffAssessmentPaths() throws Exception {
        stubAssessmentSession();

        MockHttpServletRequest req = request("/user/me",
                new Cookie(AuthCookieService.ASSESSMENT_SESSION_COOKIE, ASMNT_JWT));
        runFilter(req);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "assessment cookie alone must not authenticate non-assessment routes");
    }

    @Test
    @DisplayName("no carriers at all leaves the request unauthenticated")
    void noTokenLeavesRequestUnauthenticated() throws Exception {
        when(tokenProvider.validateToken(anyString())).thenReturn(false);

        MockHttpServletRequest req = request("/assessments/12/live-tracking");
        runFilter(req);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
