package com.kccitm.api.security.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Phase 20-01: Rate-limit configuration POJO.
 *
 * <p>Externalises rate-limit ceilings and toggles to {@code application.yml} under
 * the {@code app.rate-limit.*} prefix so per-environment tuning does not require
 * a code change.
 *
 * <p>Per-profile defaults (set in {@code application.yml}):
 * <ul>
 *   <li>dev/sandbox: {@code trust-xff: false} — no upstream proxy.</li>
 *   <li>staging/production: {@code trust-xff: true} — behind DigitalOcean proxy.</li>
 * </ul>
 */
@Configuration
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitConfig {

    /** Default: 10 requests per 60s per IP for the auth endpoint category. */
    private int ipPerMinute = 10;

    /** Default: 50 requests per 60s per user for the bulk endpoint category. */
    private int userPerMinute = 50;

    /** Default window: 60 seconds. Same window applies to both categories. */
    private int windowSeconds = 60;

    /** Master toggle. Disable per-env via {@code app.rate-limit.enabled: false} if rolling back. */
    private boolean enabled = true;

    /**
     * Whether to trust {@code X-Forwarded-For} for per-IP rate limiting.
     *
     * <p>Default: false (fail-safe). Without a known trusted upstream proxy, XFF is
     * client-controlled and can be spoofed to rotate per-IP buckets and bypass the
     * limit. Set to {@code true} ONLY in environments where a trusted reverse proxy
     * (DigitalOcean App Platform, nginx-ingress, Cloudflare) sets the header and
     * strips any incoming XFF before doing so.
     *
     * <p>Per-env defaults:
     * <ul>
     *   <li>dev:        false (no upstream proxy)</li>
     *   <li>sandbox:    false</li>
     *   <li>staging:    true  (behind DigitalOcean proxy)</li>
     *   <li>production: true  (behind DigitalOcean proxy)</li>
     * </ul>
     */
    private boolean trustXff = false;

    public int getIpPerMinute() { return ipPerMinute; }
    public void setIpPerMinute(int v) { this.ipPerMinute = v; }

    public int getUserPerMinute() { return userPerMinute; }
    public void setUserPerMinute(int v) { this.userPerMinute = v; }

    public int getWindowSeconds() { return windowSeconds; }
    public void setWindowSeconds(int v) { this.windowSeconds = v; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean v) { this.enabled = v; }

    public boolean isTrustXff() { return trustXff; }
    public void setTrustXff(boolean v) { this.trustXff = v; }
}
