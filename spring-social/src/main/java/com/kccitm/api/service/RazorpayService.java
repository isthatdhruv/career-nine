package com.kccitm.api.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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

import com.kccitm.api.security.audit.SensitiveOp;

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

    /**
     * Creates a Razorpay hosted payment link. Annotated
     * {@code @SensitiveOp("payment.refund")} per Plan 20-02 Task 2 Step B
     * priority-ordered fallback: this codebase has no {@code refund*},
     * {@code markPaid}, or {@code processWebhookEvent} method today, so the
     * audit pipeline lands on the only payment-write surface that exists —
     * {@code createPaymentLink} — so every privileged payment action records
     * one {@code auth_audit} row immediately (ROADMAP Phase 20 criterion #4).
     *
     * <p>TODO 15-06 / 17-xx: relocate this annotation to a real refund method
     * (e.g., {@code refundPaymentLink}) when one is implemented. Until then
     * this annotation today exercises the audit pipeline for the only
     * payment-write path the service exposes. The operation code stays
     * {@code "payment.refund"} so the audit query remains stable across the
     * migration; the column documents intent, not the method name.
     */
    @SensitiveOp("payment.refund")
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

    /**
     * Queries Razorpay for the current state of a previously-created payment
     * link. Used by the admin "Check status" action in the B2C Tracker — when
     * a webhook is missed or delayed, the operator can manually reconcile a
     * stuck "created" transaction against Razorpay's source of truth.
     *
     * Returns the raw JSON from {@code GET /payment_links/{id}}. The caller is
     * responsible for inspecting {@code status} (typically "created" /
     * "partially_paid" / "paid" / "expired" / "cancelled") and the
     * {@code payments} array on the response when status is "paid".
     */
    public JSONObject fetchPaymentLink(String linkId) throws Exception {
        if (linkId == null || linkId.isEmpty()) {
            throw new IllegalArgumentException("linkId is required");
        }
        HttpEntity<Void> entity = new HttpEntity<>(getAuthHeaders());
        ResponseEntity<String> response = restTemplate.exchange(
                RAZORPAY_API_URL + "/" + linkId,
                org.springframework.http.HttpMethod.GET,
                entity, String.class);
        return new JSONObject(response.getBody());
    }

    public boolean verifyWebhookSignature(byte[] payloadBytes, String signature) {
        try {
            if (webhookSecret == null || webhookSecret.isEmpty()) {
                logger.error("Razorpay webhook secret is not configured");
                return false;
            }
            if (payloadBytes == null || signature == null || signature.isEmpty()) {
                return false;
            }
            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256_HMAC.init(secretKey);
            byte[] hash = sha256_HMAC.doFinal(payloadBytes);
            String computedSignature = bytesToHex(hash);
            // Constant-time compare so the response time can't be used to leak
            // signature bytes via a timing side-channel.
            return MessageDigest.isEqual(
                    computedSignature.getBytes(StandardCharsets.US_ASCII),
                    signature.getBytes(StandardCharsets.US_ASCII));
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
