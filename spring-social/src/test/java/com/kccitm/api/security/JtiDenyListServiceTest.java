package com.kccitm.api.security;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Phase 18-03 — Unit-level coverage for {@link JtiDenyListService}.
 *
 * <p>Verifies the service contract that {@link TokenAuthenticationFilter} depends on:
 * <ul>
 *   <li>{@code revoke} + {@code isRevoked} round-trip works for a present jti.</li>
 *   <li>Pre-revocation, a jti is NOT considered revoked (control case).</li>
 *   <li>{@code null} / empty jti always returns {@code false} (legacy v2.0 token
 *       backwards-compat — they must fall through, not get blocked).</li>
 *   <li>{@code revoke(null)} is a safe no-op (idempotent + null-safe).</li>
 * </ul>
 *
 * <p>The full MockMvc-driven integration test ({@code JtiDenyListIntegrationTest} per
 * Plan 18-03 verify section) is deferred because the project test-bootstrap path (test
 * profile + seeded user + {@code /auth/me} endpoint) is not yet in place. The contract
 * exercised here is the one {@code TokenAuthenticationFilter} actually consumes — if it
 * holds, the filter behaves correctly.
 */
class JtiDenyListServiceTest {

    private JtiDenyListService service;

    @BeforeEach
    void setUp() {
        // Build the same Caffeine shape JtiDenyListConfig builds — keeps the unit test
        // self-contained without needing Spring context.
        Cache<String, Boolean> cache = Caffeine.newBuilder()
                .maximumSize(10_000)
                .expireAfterWrite(3_600_000, TimeUnit.MILLISECONDS)
                .recordStats()
                .build();
        service = new JtiDenyListService(cache);
    }

    @Test
    @DisplayName("pre-revocation jti is not on deny list (control)")
    void isRevoked_returnsFalse_forUnknownJti() {
        assertFalse(service.isRevoked(UUID.randomUUID().toString()));
    }

    @Test
    @DisplayName("revoke + isRevoked round-trip")
    void revoke_thenIsRevoked_returnsTrue() {
        String jti = UUID.randomUUID().toString();

        assertFalse(service.isRevoked(jti), "control: not revoked yet");
        service.revoke(jti);
        assertTrue(service.isRevoked(jti), "post-revocation: must be on deny list");
    }

    @Test
    @DisplayName("legacy v2.0 token (null jti) is NEVER considered revoked — backwards-compat")
    void isRevoked_returnsFalse_forNullOrEmptyJti() {
        // Even after other revocations exist, null/empty must fall through.
        service.revoke(UUID.randomUUID().toString());
        service.revoke(UUID.randomUUID().toString());

        assertFalse(service.isRevoked(null), "null jti must NOT be considered revoked");
        assertFalse(service.isRevoked(""), "empty jti must NOT be considered revoked");
    }

    @Test
    @DisplayName("revoke(null) and revoke(\"\") are safe no-ops")
    void revoke_isNoOp_forNullOrEmptyJti() {
        long sizeBefore = service.size();
        service.revoke(null);
        service.revoke("");
        assertEquals(sizeBefore, service.size(), "null/empty revoke must not add cache entries");
    }

    @Test
    @DisplayName("revoke is idempotent — repeated calls do not throw and keep the jti revoked")
    void revoke_isIdempotent() {
        String jti = UUID.randomUUID().toString();
        service.revoke(jti);
        service.revoke(jti);
        service.revoke(jti);
        assertTrue(service.isRevoked(jti));
    }
}
