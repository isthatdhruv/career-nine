package com.kccitm.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Server-side Google reCAPTCHA <strong>v3</strong> verification for public,
 * anonymous endpoints (e.g. {@code POST /leads/capture}).
 *
 * <p>reCAPTCHA v3 is score-based and invisible: the website calls
 * {@code grecaptcha.execute(siteKey, {action})} to obtain a short-lived token,
 * sends it with the form payload, and THIS service exchanges that token with
 * Google's {@code siteverify} API for a success flag + a 0.0–1.0 score. A
 * client-side widget alone protects nothing here because the endpoint is public
 * — only this server-side check actually gates bot traffic.
 *
 * <h3>Feature flag</h3>
 * Verification is <strong>disabled until {@code app.recaptcha.secret} is set</strong>.
 * With a blank secret {@link #verify} returns a passing "skipped" result, so dev
 * and existing traffic are unaffected until you configure the key.
 *
 * <h3>Failure semantics</h3>
 * A definitive negative from Google (success=false, low score, or action
 * mismatch) FAILS closed → the caller rejects the request. A transport error
 * (Google unreachable / timeout) follows {@code app.recaptcha.fail-open}
 * (default true) so a Google outage doesn't take the public form down.
 */
@Service
public class RecaptchaService {

    private static final Logger logger = LoggerFactory.getLogger(RecaptchaService.class);

    private static final String VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

    /** Blank = verification disabled (skipped). */
    @Value("${app.recaptcha.secret:}")
    private String secret;

    /** Minimum acceptable v3 score (0.0–1.0). Google's default guidance is 0.5. */
    @Value("${app.recaptcha.min-score:0.5}")
    private double minScore;

    /** Optional: require the token's action to equal this. Blank = don't check. */
    @Value("${app.recaptcha.expected-action:}")
    private String expectedAction;

    /** On a transport error (Google unreachable), allow the request through. */
    @Value("${app.recaptcha.fail-open:true}")
    private boolean failOpen;

    private final WebClient webClient = WebClient.builder().build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** True only when a secret is configured, i.e. verification is enforced. */
    public boolean isEnabled() {
        return secret != null && !secret.isBlank();
    }

    /**
     * Verify a reCAPTCHA v3 token. When disabled, returns a passing result.
     *
     * @param token    the {@code recaptchaToken} sent by the form (g-recaptcha-response)
     * @param remoteIp best-effort client IP (optional; may be null)
     */
    public RecaptchaResult verify(String token, String remoteIp) {
        if (!isEnabled()) {
            return RecaptchaResult.skipped();
        }
        if (token == null || token.isBlank()) {
            return RecaptchaResult.failed(0.0, "missing-token");
        }
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("secret", secret);
            form.add("response", token);
            if (remoteIp != null && !remoteIp.isBlank()) {
                form.add("remoteip", remoteIp);
            }

            String body = webClient.post()
                    .uri(VERIFY_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(form))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(body);
            boolean success = root.path("success").asBoolean(false);
            double score = root.path("score").asDouble(0.0);
            String action = root.path("action").asText("");

            if (!success) {
                return RecaptchaResult.failed(score, "verify-unsuccessful:" + root.path("error-codes"));
            }
            if (expectedAction != null && !expectedAction.isBlank() && !expectedAction.equals(action)) {
                return RecaptchaResult.failed(score, "action-mismatch:" + action);
            }
            if (score < minScore) {
                return RecaptchaResult.failed(score, "low-score");
            }
            return RecaptchaResult.passed(score);

        } catch (Exception e) {
            // Transport/parse error talking to Google — not a definitive bot signal.
            logger.warn("reCAPTCHA verify error ({}): {}", failOpen ? "failing open" : "failing closed", e.getMessage());
            return failOpen
                    ? RecaptchaResult.passed(0.0)
                    : RecaptchaResult.failed(0.0, "verify-error");
        }
    }

    /** Outcome of a verification: passed flag, whether it was enforced, score, and a reason. */
    public static final class RecaptchaResult {
        public final boolean passed;
        public final boolean enforced;
        public final double score;
        public final String reason;

        private RecaptchaResult(boolean passed, boolean enforced, double score, String reason) {
            this.passed = passed;
            this.enforced = enforced;
            this.score = score;
            this.reason = reason;
        }

        static RecaptchaResult skipped() {
            return new RecaptchaResult(true, false, 0.0, "disabled");
        }

        static RecaptchaResult passed(double score) {
            return new RecaptchaResult(true, true, score, "ok");
        }

        static RecaptchaResult failed(double score, String reason) {
            return new RecaptchaResult(false, true, score, reason);
        }
    }
}
