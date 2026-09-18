package com.kccitm.api.service.counselling;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.kccitm.api.service.whatsapp.WhatsAppCampaigns;

/**
 * The WhatsApp transport: one HTTP call to AiSensy, one boolean back.
 *
 * <p>Deliberately knows nothing about who is being written to or why. Deciding which template a
 * notification goes out on, who should receive it and what the parameters are belongs to
 * {@code WhatsAppDispatchService}, which is called from the email dispatcher so that both
 * channels leave together. This class is what that one ends up calling.
 *
 * <p>AiSensy campaigns map to Meta-approved message templates and must exist in the AiSensy
 * dashboard. {@link #sendTemplate} never throws: a missing key, an unapproved template or a
 * provider outage comes back as {@code false} and is logged, because the email carrying the
 * same message has already gone out and a WhatsApp failure must not turn into an application
 * one.
 *
 * <p><b>No API key is configured yet.</b> That is expected. Every send then returns false after
 * a single log line, with no network call — the routing above it still runs in full, so the
 * only thing standing between this and live messages is the key.
 */
@Service
public class WhatsAppService {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppService.class);

    private static final String AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

    /**
     * Short by design. This runs on a shared pool and a provider that has stopped answering
     * must not hold threads that other notifications need.
     */
    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 10_000;

    private final RestTemplate restTemplate = buildRestTemplate();

    /**
     * The AiSensy key. Settable as {@code app.whatsapp.api-key} (which itself defaults to the
     * {@code AISENSY_API_KEY} environment variable in application.yml), so it can be supplied
     * either way without touching code. Blank until one is issued — see the class note.
     */
    @Value("${app.whatsapp.api-key:}")
    private String configuredApiKey;

    /**
     * The sender label AiSensy records against the campaign. Not shown to the recipient — the
     * WhatsApp Business display name is what they see.
     */
    @Value("${app.whatsapp.sender-name:Career-9}")
    private String senderName;

    /** AiSensy campaign (template) names — overridable via environment. */
    public String reminderCampaign() {
        return envOr("AISENSY_COUNSELLING_REMINDER_CAMPAIGN", WhatsAppCampaigns.COUNSELLING_REMINDER);
    }

    public String otpCampaign() {
        return envOr("AISENSY_COUNSELLING_OTP_CAMPAIGN", WhatsAppCampaigns.COUNSELLING_OTP);
    }

    public String confirmationCampaign() {
        return envOr("AISENSY_COUNSELLING_CONFIRMATION_CAMPAIGN", WhatsAppCampaigns.COUNSELLING_CONFIRMATION);
    }

    public String counsellorDigestCampaign() {
        return envOr("AISENSY_COUNSELLOR_DIGEST_CAMPAIGN", WhatsAppCampaigns.COUNSELLOR_DIGEST);
    }

    public String bookingNudgeCampaign() {
        return envOr("AISENSY_COUNSELLING_NUDGE_CAMPAIGN", WhatsAppCampaigns.COUNSELLING_NUDGE);
    }

    public boolean isConfigured() {
        String key = apiKey();
        return key != null && !key.isEmpty();
    }

    /**
     * Sends a templated WhatsApp message. Returns true only if the provider accepted the
     * request. Never throws — failures are logged and reported as false.
     */
    public boolean sendTemplate(String phone, String campaignName, List<String> templateParams) {
        String apiKey = apiKey();
        if (apiKey == null || apiKey.isEmpty()) {
            logger.info("WhatsApp '{}' not sent: no API key configured (set app.whatsapp.api-key "
                    + "or AISENSY_API_KEY). The email for this notification was still sent.",
                    campaignName);
            return false;
        }
        String destination = normalizePhone(phone);
        if (destination == null) {
            logger.warn("WhatsApp '{}' not sent — invalid/empty phone", campaignName);
            return false;
        }
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("apiKey", apiKey);
            payload.put("campaignName", campaignName);
            payload.put("destination", destination);
            payload.put("userName", senderName);
            List<String> params = sanitize(templateParams);
            if (!params.isEmpty()) {
                payload.put("templateParams", params);
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

    /**
     * AiSensy rejects a template parameter containing a newline or a tab, and rejects the whole
     * message with it — so a value carrying either is flattened rather than allowed to cost the
     * send. Nulls become empty strings: positions are significant in a WhatsApp template, so a
     * missing value must still occupy its slot.
     */
    private List<String> sanitize(List<String> params) {
        List<String> out = new ArrayList<>();
        if (params == null) return out;
        for (String p : params) {
            out.add(p == null ? "" : p.replaceAll("\\s+", " ").trim());
        }
        return out;
    }

    /**
     * Normalises an Indian phone to AiSensy's 91XXXXXXXXXX form.
     *
     * <p>Public because it is also the definition of "the same number" used when deciding
     * whether two recipients are one person. A student who gave {@code 98111 11111} at booking
     * and whose record holds {@code +91 9811111111} must be recognised as one person and written
     * to once — and she is only recognised as one if the comparison normalises exactly the way
     * the send does. Two definitions of that, drifting apart, is two messages.
     */
    public String normalizePhone(String phone) {
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

    /** Configured property first, then the raw environment variable it defaults from. */
    private String apiKey() {
        if (configuredApiKey != null && !configuredApiKey.trim().isEmpty()) {
            return configuredApiKey.trim();
        }
        return System.getenv("AISENSY_API_KEY");
    }

    private String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isEmpty()) ? fallback : v;
    }

    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return new RestTemplate(factory);
    }
}
