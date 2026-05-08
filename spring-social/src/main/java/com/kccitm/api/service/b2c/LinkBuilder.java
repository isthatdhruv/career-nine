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

    public String onePager(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/report/one-pager?t=" + accessToken + "&e=" + entitlementId;
    }

    public String finalReport(String accessToken, Long entitlementId) {
        // Backend-hosted: token is validated server-side and a PDF is streamed
        // back. No frontend page hop needed.
        return apiBaseUrl + "/bet-report-data/public/final?t=" + accessToken + "&e=" + entitlementId;
    }

    public String dashboard(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/dashboard?t=" + accessToken + "&e=" + entitlementId;
    }

    public String counsellingBook(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/counselling/book?t=" + accessToken + "&e=" + entitlementId;
    }

    public String counsellingMySessions(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/counselling/my-sessions?t=" + accessToken + "&e=" + entitlementId;
    }

    public String lmsLaunch(String accessToken, Long entitlementId) {
        return frontendBaseUrl + "/lms/launch?t=" + accessToken + "&e=" + entitlementId;
    }

    public String upgradeFromOnePager(String slug, Long entitlementId) {
        return assessmentBaseUrl + "/c/" + slug + "/upgrade?e=" + entitlementId;
    }
}
