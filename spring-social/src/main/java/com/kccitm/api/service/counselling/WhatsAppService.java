package com.kccitm.api.service.counselling;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Reusable WhatsApp sender backed by AiSensy (the same provider already wired in
 * ContactPersonController). Counselling reminders / OTP / confirmations call
 * {@link #sendTemplate} and treat the boolean result as "delivered to the
 * provider"; callers fall back to email when it returns false (no API key, or
 * the send failed), so a missing/unapproved WhatsApp template never drops a
 * notification.
 *
 * AiSensy campaigns map to Meta-approved message templates and must exist in the
 * AiSensy dashboard. The campaign names are overridable via env so they can be
 * renamed without a redeploy.
 */
@Service
public class WhatsAppService {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppService.class);

    private static final String AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

    private final RestTemplate restTemplate = new RestTemplate();

    /** AiSensy campaign (template) names — overridable via environment. */
    public String reminderCampaign() {
        return envOr("AISENSY_COUNSELLING_REMINDER_CAMPAIGN", "counselling_reminder");
    }

    public String otpCampaign() {
        return envOr("AISENSY_COUNSELLING_OTP_CAMPAIGN", "counselling_otp");
    }

    public String confirmationCampaign() {
        return envOr("AISENSY_COUNSELLING_CONFIRMATION_CAMPAIGN", "counselling_confirmation");
    }

    public String counsellorDigestCampaign() {
        return envOr("AISENSY_COUNSELLOR_DIGEST_CAMPAIGN", "counsellor_daily_digest");
    }

    public String bookingNudgeCampaign() {
        return envOr("AISENSY_COUNSELLING_NUDGE_CAMPAIGN", "counselling_booking_nudge");
    }

    public boolean isConfigured() {
        String key = apiKey();
        return key != null && !key.isEmpty();
    }

    /**
     * Sends a templated WhatsApp message. Returns true only if the provider
     * accepted the request. Never throws — failures are logged and reported as
     * false so the caller can fall back to email.
     */
    public boolean sendTemplate(String phone, String campaignName, List<String> templateParams) {
        String apiKey = apiKey();
        if (apiKey == null || apiKey.isEmpty()) {
            logger.info("WhatsApp not sent (AISENSY_API_KEY not configured) — caller should fall back to email");
            return false;
        }
        String destination = normalizePhone(phone);
        if (destination == null) {
            logger.warn("WhatsApp not sent — invalid/empty phone");
            return false;
        }
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("apiKey", apiKey);
            payload.put("campaignName", campaignName);
            payload.put("destination", destination);
            payload.put("userName", "Career-9");
            if (templateParams != null && !templateParams.isEmpty()) {
                payload.put("templateParams", templateParams);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            restTemplate.postForEntity(AISENSY_URL, request, String.class);
            logger.info("WhatsApp '{}' sent to {}", campaignName, destination);
            return true;
        } catch (Exception e) {
            logger.warn("WhatsApp send failed for campaign '{}' to {}: {}", campaignName, destination, e.getMessage());
            return false;
        }
    }

    /** Normalises an Indian phone to AiSensy's 91XXXXXXXXXX form. */
    private String normalizePhone(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;
        if (digits.length() == 10) {
            return "91" + digits;
        }
        // Already includes a country code (e.g. 9198..., or 0091...) — drop a
        // leading 00 if present and return as-is.
        if (digits.startsWith("00")) {
            digits = digits.substring(2);
        }
        return digits;
    }

    private String apiKey() {
        return System.getenv("AISENSY_API_KEY");
    }

    private String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isEmpty()) ? fallback : v;
    }
}
