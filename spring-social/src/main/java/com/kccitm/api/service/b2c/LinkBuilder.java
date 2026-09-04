package com.kccitm.api.service.b2c;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.kccitm.api.service.link.ShortLinkService;

/**
 * Single source of truth for every outbound URL we put in B2C emails / SMSes.
 * Reads the frontend base URL from app.b2c.frontendBaseUrl with a sensible default.
 *
 * <h3>Short links</h3>
 * The tokenized links below are shortened to {@code {apiBaseUrl}/s/{code}} before they leave
 * this class. Only the ones carrying a token are: an assessment-start link is ~140 characters
 * and a counselling booking link ~320, because of the JWT inside it, and that is what a student
 * sees wrapped over seven lines in their inbox. Plain page addresses ({@link #manualLogin},
 * {@link #campaignLanding}, …) are already short and are left exactly as they were — a redirect
 * hop that saves nothing is a redirect hop that can only break.
 *
 * <p>Shortening cannot fail a send. {@link ShortLinkService#codeFor} returns null on any
 * problem and {@link #shorten} then hands back the full URL, which is what these methods
 * returned before this existed.
 */
@Service
public class LinkBuilder {

    @Autowired
    private ShortLinkService shortLinkService;

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
        return shorten(assessmentBaseUrl + "/assessment/start?t=" + accessToken + "&e=" + entitlementId,
                "assessment_start");
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
        return shorten(frontendBaseUrl + "/report/one-pager?t=" + accessToken + "&e=" + entitlementId,
                "one_pager");
    }

    public String finalReport(String accessToken, Long entitlementId) {
        // Backend-hosted: token is validated server-side and a PDF is streamed
        // back. No frontend page hop needed.
        return shorten(apiBaseUrl + "/bet-report-data/public/final?t=" + accessToken
                + "&e=" + entitlementId, "final_report");
    }

    public String dashboard(String accessToken, Long entitlementId) {
        // Lands on the student SSO bridge, which POSTs /entitlement/redeem-dashboard-token
        // to trade the entitlement accessToken for cn_at + cn_csrf cookies, then
        // navigates the browser to /student/dashboard. Without this hop the dashboard
        // route would 401 — it requires the cookie session set by /user/student-auth,
        // and the magic-link student doesn't have one.
        return shorten(frontendBaseUrl + "/student/sso?t=" + accessToken + "&e=" + entitlementId,
                "dashboard");
    }

    public String counsellingBook(String accessToken, Long entitlementId) {
        return shorten(frontendBaseUrl + "/counselling/book?t=" + accessToken + "&e=" + entitlementId,
                "counselling_book");
    }

    public String counsellingMySessions(String accessToken, Long entitlementId) {
        return shorten(frontendBaseUrl + "/counselling/my-sessions?t=" + accessToken
                + "&e=" + entitlementId, "counselling_my_sessions");
    }

    /**
     * Public, no-login self-reschedule page (assessment SPA) reached from the tokenized link we
     * email a student when their counsellor becomes unavailable. The token is validated server-side.
     */
    public String counsellingReschedule(String token) {
        return shorten(assessmentBaseUrl + "/counselling-reschedule/" + token,
                "counselling_reschedule");
    }

    /**
     * Public, no-login booking page (assessment SPA) reached from the tokenized link emailed to a
     * student who completed an assessment but never booked counselling.
     */
    public String counsellingBooking(String token) {
        return shorten(assessmentBaseUrl + "/counselling-booking/" + token, "counselling_booking");
    }

    /** The assessment SPA root — the referral share link when no campaign applies. */
    public String assessmentHome() {
        return assessmentBaseUrl;
    }

    public String lmsLaunch(String accessToken, Long entitlementId) {
        return shorten(frontendBaseUrl + "/lms/launch?t=" + accessToken + "&e=" + entitlementId,
                "lms_launch");
    }

    public String upgradeFromOnePager(String slug, Long entitlementId) {
        return assessmentBaseUrl + "/c/" + slug + "/upgrade?e=" + entitlementId;
    }

    /**
     * {@code {apiBaseUrl}/s/{code}} for a long URL, or the long URL itself when no code could be
     * made. Both are valid addresses for the same page, so a fallback costs a student nothing
     * beyond the ugliness we started with.
     */
    private String shorten(String longUrl, String purpose) {
        String code = shortLinkService.codeFor(longUrl, purpose);
        return code == null ? longUrl : apiBaseUrl + "/s/" + code;
    }
}
