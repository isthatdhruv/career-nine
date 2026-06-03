package com.kccitm.api.service.b2c.report.pdf;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

/** Thin wrapper over Gotenberg's Chromium URL→PDF endpoint. */
@Component
public class GotenbergClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final int waitDelaySeconds;

    public GotenbergClient(
            @Qualifier("gotenbergRestTemplate") RestTemplate restTemplate,
            @Value("${app.gotenberg.url}") String baseUrl,
            @Value("${app.gotenberg.wait-delay:2}") int waitDelaySeconds) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.waitDelaySeconds = waitDelaySeconds;
    }

    /** Render a publicly-reachable HTML URL to PDF bytes. Throws on non-2xx. */
    public byte[] renderUrl(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("url", url);
        form.add("printBackground", "true");
        form.add("preferCssPageSize", "true");
        form.add("marginTop", "0");
        form.add("marginBottom", "0");
        form.add("marginLeft", "0");
        form.add("marginRight", "0");
        // Give client-side chart scripts time to paint before capture.
        form.add("waitDelay", waitDelaySeconds + "s");

        HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(form, headers);
        ResponseEntity<byte[]> resp = restTemplate.postForEntity(
                baseUrl + "/forms/chromium/convert/url", req, byte[].class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new IllegalStateException("Gotenberg render failed: HTTP " + resp.getStatusCode());
        }
        return resp.getBody();
    }
}
