package com.kccitm.api.payload;

import javax.validation.constraints.NotBlank;

/**
 * Phase 16-04: Request body for {@code POST /auth/oauth-exchange}.
 *
 * <p>The OAuth2 success handler (left intentionally untouched in Phase 16) redirects the
 * browser to {@code /oauth2/redirect?token=<jwt>}. The frontend extracts the URL token
 * and POSTs it here so the server can validate it and re-issue it as an HttpOnly
 * {@code cn_at} cookie (plus a fresh {@code cn_csrf}). The token never has to live in
 * {@code localStorage} or the URL beyond a single round-trip.
 */
public class OAuthExchangeRequest {

    @NotBlank
    private String token;

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }
}
