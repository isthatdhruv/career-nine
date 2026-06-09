package com.kccitm.api.service.b2c.report.pdf;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GotenbergClientTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private GotenbergClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.createServer(restTemplate);
        client = new GotenbergClient(restTemplate, "http://gotenberg:3000", 2);
    }

    @Test
    void renderUrl_postsToChromiumConvertUrl_andReturnsPdfBytes() {
        byte[] fakePdf = "%PDF-1.7 fake".getBytes();
        server.expect(requestTo("http://gotenberg:3000/forms/chromium/convert/url"))
              .andExpect(method(HttpMethod.POST))
              .andExpect(header("Content-Type", org.hamcrest.Matchers.startsWith("multipart/form-data")))
              .andRespond(withSuccess(fakePdf, MediaType.APPLICATION_PDF));

        byte[] out = client.renderUrl("https://cdn.example/report.html");

        assertThat(out).isEqualTo(fakePdf);
        server.verify();
    }
}
