package com.kccitm.api.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Sends server-side conversion events to Google Analytics 4 via the
 * Measurement Protocol (https://www.google-analytics.com/mp/collect).
 *
 * Why server-side: in this app the buyer is redirected off-site to Razorpay to
 * pay, and payment is confirmed asynchronously by the Razorpay webhook
 * ({@link com.kccitm.api.controller.career9.PaymentWebhookController}). The
 * browser may never return, so a browser-only gtag('purchase') would
 * under-count real paid sales. Firing the conversion from the webhook — the one
 * place where money is genuinely confirmed — captures 100% of paid sales for
 * both the B2C (campaign) and B2B (institute/school) funnels, which both flow
 * through the same webhook.
 *
 * Design notes:
 *   - Fire-and-forget (async) so analytics never adds latency to, or fails,
 *     the payment-provisioning transaction.
 *   - Silent no-op when {@code app.ga.api-secret} is blank, so dev/local runs
 *     (which have no secret) are unaffected.
 *   - Never throws — every failure is swallowed and logged at WARN.
 */
@Service
public class GoogleAnalyticsService {

    private static final Logger logger = LoggerFactory.getLogger(GoogleAnalyticsService.class);
    private static final String MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";

    @Value("${app.ga.measurement-id:}")
    private String measurementId;

    @Value("${app.ga.api-secret:}")
    private String apiSecret;

    @Value("${app.ga.b2c-measurement-id:}")
    private String b2cMeasurementId;

    @Value("${app.ga.b2c-api-secret:}")
    private String b2cApiSecret;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public boolean isConfigured() {
        return measurementId != null && !measurementId.isEmpty()
                && apiSecret != null && !apiSecret.isEmpty();
    }

    /**
     * Send a GA4 "purchase" conversion event to the primary property
     * (dashboard / B2B funnel).
     */
    public void sendPurchase(String clientId, String transactionId, Double valueRupees, Map<String, Object> params) {
        sendPurchase(clientId, transactionId, valueRupees, params, false);
    }

    /**
     * Send a GA4 "purchase" conversion event, routed to the property that
     * matches the funnel:
     *   - {@code isB2C == true}  → the B2C / assessment-app property
     *     (b2c-measurement-id), so it lines up with that app's page views.
     *   - {@code isB2C == false} → the primary / dashboard property.
     * If the B2C property has no API secret configured, it falls back to the
     * primary property so conversions are never silently dropped.
     *
     * @param clientId      a stable identifier for the buyer. When we have the
     *                      browser's GA client_id we should pass it (best
     *                      attribution); otherwise a transaction-derived value
     *                      still records the conversion.
     * @param transactionId your internal transaction id (dedup key in GA).
     * @param valueRupees   purchase value in rupees (major units), may be null.
     * @param params        extra event params (e.g. campaign, institute, funnel).
     * @param isB2C         whether this is a B2C (campaign) conversion.
     */
    public void sendPurchase(String clientId, String transactionId, Double valueRupees,
                             Map<String, Object> params, boolean isB2C) {

        // Resolve which property/secret to use, with fallback to primary.
        String useMeasurementId = measurementId;
        String useApiSecret = apiSecret;
        if (isB2C && b2cApiSecret != null && !b2cApiSecret.isEmpty()
                && b2cMeasurementId != null && !b2cMeasurementId.isEmpty()) {
            useMeasurementId = b2cMeasurementId;
            useApiSecret = b2cApiSecret;
        }

        if (useMeasurementId == null || useMeasurementId.isEmpty()
                || useApiSecret == null || useApiSecret.isEmpty()) {
            logger.debug("GA not configured (no api-secret) — skipping purchase event for txn {}", transactionId);
            return;
        }

        final String measurementIdFinal = useMeasurementId;
        final String apiSecretFinal = useApiSecret;

        try {
            JSONObject eventParams = new JSONObject();
            eventParams.put("currency", "INR");
            if (valueRupees != null) {
                eventParams.put("value", valueRupees);
            }
            if (transactionId != null) {
                eventParams.put("transaction_id", transactionId);
            }
            if (params != null) {
                for (Map.Entry<String, Object> e : params.entrySet()) {
                    if (e.getValue() != null) {
                        eventParams.put(e.getKey(), e.getValue());
                    }
                }
            }

            JSONObject event = new JSONObject();
            event.put("name", "purchase");
            event.put("params", eventParams);

            JSONObject body = new JSONObject();
            body.put("client_id", clientId != null && !clientId.isEmpty() ? clientId : "txn." + transactionId);
            body.put("events", new JSONArray().put(event));

            String url = MP_ENDPOINT
                    + "?measurement_id=" + measurementIdFinal
                    + "&api_secret=" + apiSecretFinal;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                    .build();

            // Fire-and-forget: never block or fail the caller (the payment webhook).
            CompletableFuture
                    .runAsync(() -> {
                        try {
                            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                            // GA Measurement Protocol returns 204 No Content on success.
                            if (resp.statusCode() != 204) {
                                logger.warn("GA purchase event for txn {} returned HTTP {} (body: {})",
                                        transactionId, resp.statusCode(), resp.body());
                            } else {
                                logger.info("GA purchase conversion sent for txn {}", transactionId);
                            }
                        } catch (Exception e) {
                            logger.warn("GA purchase event send failed for txn {}: {}", transactionId, e.getMessage());
                        }
                    });

        } catch (Exception e) {
            // Building the request should never fail, but guard anyway so
            // analytics can never break payment provisioning.
            logger.warn("GA purchase event could not be prepared for txn {}: {}", transactionId, e.getMessage());
        }
    }
}
