package com.kccitm.api.config;

import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * Phase 18 — Caffeine-backed deny list for revoked JWT {@code jti} values.
 *
 * <p>Consumed by {@link com.kccitm.api.security.JtiDenyListService} and indirectly by
 * {@link com.kccitm.api.security.TokenAuthenticationFilter}, which consults the deny list
 * on every authenticated request between {@code validateToken} and {@code setAuthentication}.
 *
 * <p><b>Memory budget:</b> 10_000 entries &times; ~36 bytes/UUID + map overhead &asymp; ~600 KB
 * worst case. Trivial. The bound prevents a hostile actor (or a misbehaving caller) from
 * filling memory with rapid revocations.
 *
 * <p><b>TTL coupling:</b> The cache TTL is driven by {@code app.auth.accessTokenExpirationMsec}
 * (Plan 18-01 — currently 60 min). A {@code jti} older than its access-token expiry is already
 * useless (signature still verifies but {@code exp} claim fails), so the deny list doesn't need
 * to retain it. The {@code @Value} binding keeps the cache TTL in lockstep with the access-token
 * TTL — if a future plan lengthens access-token TTL, the deny-list TTL lengthens with it.
 *
 * <p><b>JVM-restart caveat:</b> A restart drops the deny list. Acceptable because (a) access
 * tokens have a bounded 60-min TTL so the worst-case "revoked token revived by restart" window
 * is &lt;= 60 min, and (b) the project deploys single-instance via docker-compose. Phase 20 may
 * upgrade to a Redis-backed implementation if/when horizontal scaling lands.
 *
 * <p><b>Stats:</b> {@code recordStats()} is enabled so a future {@code /actuator/metrics}
 * integration (Phase 20) sees hit/miss/eviction counts.
 */
@Configuration
public class JtiDenyListConfig {

    @Bean(name = "jtiDenyList")
    public Cache<String, Boolean> jtiDenyList(
            @Value("${app.auth.accessTokenExpirationMsec:3600000}") long accessTokenTtlMsec) {
        return Caffeine.newBuilder()
                .maximumSize(10_000)
                .expireAfterWrite(accessTokenTtlMsec, TimeUnit.MILLISECONDS)
                .recordStats()
                .build();
    }
}
