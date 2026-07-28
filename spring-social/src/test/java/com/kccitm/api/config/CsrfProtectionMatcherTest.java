package com.kccitm.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CsrfProtectionMatcherTest {

    private static final String[] PUBLIC = { "/auth/login", "/entitlement/redeem-dashboard-token",
            "/oauth2/**", "/payment/webhook/**" };

    @Test
    void safeMethodsAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/student-portal/my-info/1");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void bearerAuthenticatedWritesAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("PUT", "/student-portal/update-info/1");
        req.addHeader("Authorization", "Bearer abc.def.ghi");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void publicPathWritesAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/auth/login");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void cookieAuthenticatedWritesAreProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("PUT", "/student-portal/update-info/1");
        assertTrue(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void wildcardPublicPathWritesAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/payment/webhook/razorpay");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }
}
