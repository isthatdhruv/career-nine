package com.kccitm.api.service.b2c;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Single source of truth for every outbound URL we put in B2C emails / SMSes.
 * Reads the frontend base URL from app.b2c.frontendBaseUrl with a sensible default.
 */
@Service
public class LinkBuilder {

    @Value("${app.b2c.frontendBaseUrl:https://dashboard.career-9.com}")
    private String frontendBaseUrl;

    @Value("${app.b2c.assessmentBaseUrl:https://assessment.career-9.com}")
    private String assessmentBaseUrl;

    /**
     * Used for backend-served tokenized links (e.g. final report PDF download).
     * Defaults to the production API host; override per-profile in application.yml.
     */
    @Value("${app.b2c.apiBaseUrl:https://api.career-9.com}")
    private String apiBaseUrl;

    public String campaignLanding(String slug) {
        return assessmentBaseUrl + "/c/" + slug;
    }

    public String assessmentStart(String accessToken, Long entitlementId) {
        return assessmentBaseUrl + "/assessment/start?t=" + accessToken + "&e=" + entitlementId;
    }

    /**
     * The manual sign-in URL we surface in the welcome email as the fallback to
     * the one-click magic link. Students log in here with username + DOB if the
     * magic link is unavailable.
     */
    public String manualLogin() {
        return assessmentBaseUrl + "/student-login";
    }

    /**
     * The student sign-in page (username + DOB) at {@code /auth}, surfaced in the
     * login-credentials email. Built from app.b2c.frontendBaseUrl so the link is
     * environment-correct (dev → localhost, sandbox → staging-dashboard,
     * prod → dashboard) instead of a hardcoded production URL.
     */
    public String studentLogin() {
        return frontendBaseUrl + "/auth";
    }

    public String onePager(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/report/one-pager?t=" + accessToken + "&e=" + entitlementId;
    }

    public String finalReport(String accessToken, Long entitlementId) {
        // Backend-hosted: token is validated server-side and a PDF is streamed
        // back. No frontend page hop needed.
        return apiBaseUrl + "/bet-report-data/public/final?t=" + accessToken + "&e=" + entitlementId;
    }

    public String dashboard(String accessToken, Long entitlementId) {
        // Lands on the student SSO bridge, which POSTs /entitlement/redeem-dashboard-token
        // to trade the entitlement accessToken for cn_at + cn_csrf cookies, then
        // navigates the browser to /student/dashboard. Without this hop the dashboard
        // route would 401 — it requires the cookie session set by /user/student-auth,
        // and the magic-link student doesn't have one.
        return frontendBaseUrl + "/student/sso?t=" + accessToken + "&e=" + entitlementId;
    }

    public String counsellingBook(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/counselling/book?t=" + accessToken + "&e=" + entitlementId;
    }

    public String counsellingMySessions(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/counselling/my-sessions?t=" + accessToken + "&e=" + entitlementId;
    }

    /**
     * Public, no-login self-reschedule page (assessment SPA) reached from the tokenized link we
     * email a student when their counsellor becomes unavailable. The token is validated server-side.
     */
    public String counsellingReschedule(String token) {
        return assessmentBaseUrl + "/counselling-reschedule/" + token;
    }

    public String lmsLaunch(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/lms/launch?t=" + accessToken + "&e=" + entitlementId;
    }

    public String upgradeFromOnePager(String slug, Long entitlementId) {
        return assessmentBaseUrl + "/c/" + slug + "/upgrade?e=" + entitlementId;
    }
}
