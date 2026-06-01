package com.kccitm.api.security;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.config.AppProperties;
import com.kccitm.api.model.JwtTokenAudit.TokenType;
import com.kccitm.api.model.RefreshToken;
import com.kccitm.api.repository.RefreshTokenRepository;

import java.util.Collections;
import java.util.Date;

/**
 * Server-side lifecycle for the OPAQUE refresh tokens introduced in Phase 18.
 *
 * <h3>Token shape</h3>
 * A refresh token is a UUID v4 string. It is NOT a JWT — there is no signature,
 * no claims, no exp embedded in the value. All state lives server-side in the
 * {@code refresh_token} table (Phase 14 migration V20260511001). The plaintext
 * UUID returned to the client IS the row's primary key ({@code jti}).
 *
 * <h3>Rotation race contract</h3>
 * When a browser has two tabs open, both can hit {@code POST /auth/refresh}
 * near-simultaneously after an access-token expiry. Both cookies carry the same
 * {@code cn_rt} value. Without race protection, both rotation calls would issue
 * NEW refresh tokens and leave two parallel chains active — a serious anomaly.
 *
 * <p>This service protects against that with
 * {@link RefreshTokenRepository#revokeIfLive} — an atomic JPQL UPDATE with
 * {@code WHERE revoked_at IS NULL}. Exactly one of N concurrent calls sees
 * {@code affected_rows == 1}; the rest see {@code 0} and {@link #rotate} throws
 * {@link RefreshTokenReuseException}. Plan 18-02 maps that exception to HTTP 401.
 *
 * <p>Alternative considered ({@code SELECT … FOR UPDATE}) is correct but holds
 * a row lock for the entire {@code @Transactional} block including the new-row
 * INSERT — needlessly so since the only mutation is a conditional UPDATE.
 *
 * <h3>Replay detection</h3>
 * If a caller presents a token whose row already has {@code revoked_at != NULL},
 * that means EITHER (a) we lost the rotation race against a sibling tab, OR
 * (b) an attacker is replaying a token that was already rotated. Both cases:
 * reject and log. Aggressive chain-revocation ({@link #revokeAllForUser}) on
 * detected replays may land in Phase 20.
 */
@Service
public class RefreshTokenService {

    private static final Logger logger = LoggerFactory.getLogger(RefreshTokenService.class);

    @Autowired
    private RefreshTokenRepository repo;

    @Autowired
    private AppProperties appProperties;

    @Autowired(required = false)
    private JwtTokenAuditService auditService;

    @Autowired(required = false)
    private com.kccitm.api.repository.UserRepository userRepository;

    /**
     * Issue a fresh refresh token for a user and return its jti.
     * The jti IS the cookie value the client sees — opaque, UUID v4.
     *
     * @param userId    owner of the token
     * @param userAgent client User-Agent header (truncated to 255 chars), null-safe
     * @param ip        client IP (truncated to 45 chars to fit IPv6), null-safe
     * @return the freshly minted jti
     */
    @Transactional
    public String issue(Long userId, String userAgent, String ip) {
        String jti = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime exp = now.plusNanos(
                appProperties.getAuth().getRefreshTokenExpirationMsec() * 1_000_000L);

        RefreshToken row = new RefreshToken();
        row.setJti(jti);
        row.setUserId(userId);
        row.setIssuedAt(now);
        row.setExpiresAt(exp);
        row.setRevokedAt(null);
        row.setReplacedBy(null);
        row.setUserAgent(safeTrim(userAgent, 255));
        row.setIp(safeTrim(ip, 45));
        repo.save(row);

        if (auditService != null) {
            String email = null;
            if (userRepository != null) {
                try {
                    email = userRepository.findById(userId).map(u -> u.getEmail()).orElse(null);
                } catch (Exception ignored) { }
            }
            Date issued = Date.from(now.atZone(java.time.ZoneId.systemDefault()).toInstant());
            Date expires = Date.from(exp.atZone(java.time.ZoneId.systemDefault()).toInstant());
            auditService.record(jti, userId, email, Collections.emptyList(), false,
                    issued, expires, TokenType.REFRESH);
        }
        return jti;
    }

    /**
     * Validate a refresh token presented by a client.
     *
     * @return {@code Optional.of(row)} when the row exists, is not revoked, and is
     *         not past {@code expires_at}; {@code Optional.empty()} otherwise.
     */
    @Transactional(readOnly = true)
    public Optional<RefreshToken> validate(String jti) {
        if (jti == null || jti.isEmpty()) {
            return Optional.empty();
        }
        return repo.findByJti(jti)
                .filter(r -> r.getRevokedAt() == null)
                .filter(r -> r.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    /**
     * Atomic rotation. Returns the new jti on success.
     *
     * @throws RefreshTokenReuseException if the old token is unknown, expired, already
     *         revoked, or its rotation race was lost.
     */
    @Transactional
    public String rotate(String oldJti, String userAgent, String ip) {
        if (oldJti == null || oldJti.isEmpty()) {
            throw new RefreshTokenReuseException("Missing refresh token");
        }
        Optional<RefreshToken> existing = repo.findByJti(oldJti);
        if (!existing.isPresent()) {
            throw new RefreshTokenReuseException("Unknown refresh token");
        }
        RefreshToken old = existing.get();
        if (old.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RefreshTokenReuseException("Refresh token expired");
        }
        if (old.getRevokedAt() != null) {
            // Already revoked — either we lost a previous rotation race OR this is a
            // replay of an already-rotated token. Both cases: reject. Log loudly so
            // security can correlate against the auth_audit stream (Phase 15).
            logger.warn("Attempted reuse of revoked refresh token jti={} userId={}",
                    oldJti, old.getUserId());
            throw new RefreshTokenReuseException("Refresh token already used");
        }

        // 1) Issue the new row first so we have its jti to write into replaced_by.
        String newJti = issue(old.getUserId(), userAgent, ip);

        // 2) Atomically revoke the old row IFF it's still live. THIS is the race-deciding
        //    step. If two callers race here, exactly one sees rowCount==1; the others
        //    see 0 and we throw. The @Transactional rollback then unwinds the new row
        //    we optimistically inserted in step 1 — no orphan.
        int updated = repo.revokeIfLive(oldJti, LocalDateTime.now(), newJti);
        if (updated != 1) {
            logger.warn("Lost rotation race for jti={} userId={}", oldJti, old.getUserId());
            throw new RefreshTokenReuseException("Refresh token already rotated");
        }
        if (auditService != null) {
            auditService.revoke(oldJti, null, "Rotated to " + newJti);
        }
        return newJti;
    }

    /**
     * Revoke a single refresh token. Idempotent — safe to call on already-revoked rows.
     * Used by {@code /auth/logout} (Plan 18-02). Pass {@code replaced_by = null} so the
     * audit trail distinguishes "explicit logout" from "rotation".
     */
    @Transactional
    public void revoke(String jti) {
        if (jti == null || jti.isEmpty()) {
            return;
        }
        repo.revokeIfLive(jti, LocalDateTime.now(), null);
        if (auditService != null) {
            auditService.revoke(jti, null, "User logout");
        }
    }

    /**
     * Revoke every still-live refresh token for a user. Used by
     * {@code /auth/logout-all} (Plan 18-02) and by admin-driven force-logout. Returns
     * the number of rows revoked.
     */
    @Transactional
    public int revokeAllForUser(Long userId) {
        if (userId == null) {
            return 0;
        }
        return repo.revokeAllForUser(userId, LocalDateTime.now());
    }

    /**
     * Phase 18 Plan 02 helper. Returns the {@code user_id} owning a refresh-token row
     * by {@code jti}, or {@code null} when no such row exists.
     *
     * <p>Used by {@code /auth/refresh} to mint the new access token BEFORE the
     * rotation UPDATE — once the rotate succeeds we already have the user id in
     * hand without a second round-trip.
     */
    @Transactional(readOnly = true)
    public Long getUserIdForJti(String jti) {
        if (jti == null || jti.isEmpty()) {
            return null;
        }
        return repo.findByJti(jti).map(RefreshToken::getUserId).orElse(null);
    }

    private static String safeTrim(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    /**
     * Thrown when a client presents a refresh token that is unknown, expired, revoked,
     * or whose rotation race was lost. Plan 18-02's {@code /auth/refresh} maps this
     * to HTTP 401.
     */
    public static class RefreshTokenReuseException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public RefreshTokenReuseException(String message) {
            super(message);
        }
    }
}
