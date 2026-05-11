package com.kccitm.api.service;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import javax.annotation.PostConstruct;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class RazorpayService {

    private static final Logger logger = LoggerFactory.getLogger(RazorpayService.class);
    private static final String RAZORPAY_API_URL = "https://api.razorpay.com/v1/payment_links";

    @Value("${app.razorpay.key-id:}")
    private String keyId;

    @Value("${app.razorpay.key-secret:}")
    private String keySecret;

    @Value("${app.razorpay.webhook-secret:}")
    private String webhookSecret;

    @Autowired
    private Environment environment;

    private final RestTemplate restTemplate;

    public RazorpayService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000); // 10 seconds
        factory.setReadTimeout(30000);    // 30 seconds
        this.restTemplate = new RestTemplate(factory);
    }

    private void validateConfig() {
        if (keyId == null || keyId.isEmpty() || keySecret == null || keySecret.isEmpty()) {
            throw new IllegalStateException("Razorpay is not configured. Set app.razorpay.key-id and app.razorpay.key-secret.");
        }
    }

    /**
     * Fail-fast startup check: in any production-grade profile (production,
     * staging, sandbox), the Razorpay webhook secret MUST be set to a
     * non-empty value. Otherwise the webhook signature check would silently
     * always return false and every callback would 401 — masking a real
     * misconfiguration. The dev profile is exempt so engineers can run the
     * app locally without Razorpay credentials.
     *
     * Wired via Phase 13, success criterion #4.
     */
    @PostConstruct
    public void validateWebhookSecret() {
        boolean isProductionGrade = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> "production".equals(p)
                        || "staging".equals(p)
                        || "sandbox".equals(p));
        if (isProductionGrade && (webhookSecret == null || webhookSecret.isEmpty())) {
            throw new IllegalStateException(
                    "RAZORPAY_WEBHOOK_SECRET env var is required in profile '"
                            + String.join(",", environment.getActiveProfiles())
                            + "'. Set the env var before starting the app.");
        }
        if (!isProductionGrade && (webhookSecret == null || webhookSecret.isEmpty())) {
            logger.warn("Razorpay webhook secret is empty in profile '{}'. "
                    + "Webhook signature verification will reject every callback "
                    + "until RAZORPAY_WEBHOOK_SECRET is set.",
                    String.join(",", environment.getActiveProfiles()));
        }
    }

    private HttpHeaders getAuthHeaders() {
        validateConfig();
        HttpHeaders headers = new HttpHeaders();
        String auth = keyId + ":" + keySecret;
        String encoded = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encoded);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    public Map<String, String> createPaymentLink(
            long amountInr,
            String currency,
            String description,
            String callbackUrl,
            String referenceId,
            Map<String, String> notes) throws Exception {

        JSONObject request = new JSONObject();
        // Razorpay's API expects amount in paise — convert at the edge so the
        // rest of the codebase can stay consistently in rupees.
        request.put("amount", amountInr * 100L);
        request.put("currency", currency != null ? currency : "INR");
        request.put("description", description);
        request.put("reference_id", referenceId);

        if (callbackUrl != null) {
            request.put("callback_url", callbackUrl);
            request.put("callback_method", "get");
        }

        JSONObject notify = new JSONObject();
        notify.put("sms", false);
        notify.put("email", false);
        request.put("notify", notify);

        if (notes != null && !notes.isEmpty()) {
            JSONObject notesJson = new JSONObject();
            notes.forEach(notesJson::put);
            request.put("notes", notesJson);
        }

        request.put("reminder_enable", true);

        HttpEntity<String> entity = new HttpEntity<>(request.toString(), getAuthHeaders());
        ResponseEntity<String> response = restTemplate.postForEntity(RAZORPAY_API_URL, entity, String.class);

        JSONObject responseBody = new JSONObject(response.getBody());

        String linkId = responseBody.getString("id");
        String shortUrl = responseBody.getString("short_url");
        String status = responseBody.getString("status");

        logger.info("Razorpay payment link created: {}", linkId);

        Map<String, String> result = new HashMap<>();
        result.put("linkId", linkId);
        result.put("shortUrl", shortUrl);
        result.put("paymentLinkUrl", shortUrl);
        result.put("status", status);
        return result;
    }

    public boolean verifyWebhookSignature(String payload, String signature) {
        try {
            if (webhookSecret == null || webhookSecret.isEmpty()) {
                logger.error("Razorpay webhook secret is not configured");
                return false;
            }
            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(webhookSecret.getBytes(), "HmacSHA256");
            sha256_HMAC.init(secretKey);
            byte[] hash = sha256_HMAC.doFinal(payload.getBytes());
            String computedSignature = bytesToHex(hash);
            return computedSignature.equals(signature);
        } catch (Exception e) {
            logger.error("Webhook signature verification failed", e);
            return false;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    public String getKeyId() {
        return keyId;
    }
}
