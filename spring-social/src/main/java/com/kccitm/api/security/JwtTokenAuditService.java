package com.kccitm.api.security;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.kccitm.api.model.JwtTokenAudit;
import com.kccitm.api.model.JwtTokenAudit.TokenType;
import com.kccitm.api.repository.JwtTokenAuditRepository;

/**
 * Records each JWT issuance and revocation. Single source of truth for the
 * super-admin token console.
 *
 * <h3>Best-effort semantics</h3>
 * {@link #record} catches every exception and only logs them. A DB outage must
 * never break login. The in-memory {@link JtiDenyListService} remains the
 * authoritative "is this token rejectable right now" check; this table is the
 * durable record that survives JVM restarts.
 *
 * <h3>IP / User-Agent capture</h3>
 * Pulled from the current request via {@link RequestContextHolder}. When no
 * request is in scope (e.g. async / system-initiated token mint) both fall back
 * to {@code null} rather than throwing.
 *
 * <h3>Revocation</h3>
 * {@link #revoke(String, Long, String)} performs an atomic conditional UPDATE
 * AND adds the jti to the in-memory deny list, so a subsequent request carrying
 * the still-live JWT is rejected at the auth filter without waiting for natural
 * expiry.
 */
@Service
public class JwtTokenAuditService {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenAuditService.class);

    private static final String DEFAULT_ISSUER = "career-nine";

    @Autowired
    private JwtTokenAuditRepository repo;

    @Autowired
    private JtiDenyListService jtiDenyListService;

    /**
     * Record a freshly minted JWT. Safe to call from inside an existing
     * transaction — uses {@code REQUIRES_NEW} so an audit failure cannot roll
     * back the parent (e.g. the login flow).
     *
     * <p>All parameters except {@code jti}, {@code userId}, {@code tokenType},
     * {@code issuedAt}, {@code expiresAt} may be {@code null}.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String jti, Long userId, String userEmail,
                       Collection<? extends GrantedAuthority> authorities,
                       boolean superAdmin, Date issuedAt, Date expiresAt,
                       TokenType tokenType) {
        if (jti == null || jti.isEmpty() || userId == null || tokenType == null) {
            return;
        }
        try {
            JwtTokenAudit row = new JwtTokenAudit();
            row.setJti(jti);
            row.setUserId(userId);
            row.setUserEmail(safeTrim(userEmail, 255));
            row.setTokenType(tokenType);
            row.setIssuedAt(toLocal(issuedAt));
            row.setExpiresAt(toLocal(expiresAt));
            row.setNotBefore(toLocal(issuedAt));
            row.setSuperAdmin(superAdmin);
            row.setIssuer(DEFAULT_ISSUER);
            row.setRolesSnapshot(joinRoles(authorities));

            HttpServletRequest req = currentRequest();
            if (req != null) {
                row.setIpAddress(safeTrim(readClientIp(req), 45));
                row.setUserAgent(safeTrim(req.getHeader("User-Agent"), 512));
            }
            repo.save(row);
        } catch (Exception ex) {
            // Audit failure must never break token issuance — log and move on.
            log.warn("Failed to record JWT audit for jti={} userId={}: {}",
                    jti, userId, ex.getMessage());
        }
    }

    /**
     * Mark an audit row revoked AND add the jti to the in-memory deny list so the
     * still-live JWT cannot be reused for its remaining TTL. Idempotent — repeated
     * calls on an already-revoked jti are no-ops on the DB side but still re-add
     * to the deny list (Caffeine resets the TTL window).
     *
     * @param jti        the JWT id to revoke
     * @param revokedBy  the user_id of the admin / actor triggering the revoke,
     *                   or {@code null} for system events (logout, rotation, etc.)
     * @param reason     short human-readable reason; truncated to 255 chars
     */
    @Transactional
    public void revoke(String jti, Long revokedBy, String reason) {
        if (jti == null || jti.isEmpty()) {
            return;
        }
        try {
            repo.markRevokedIfLive(jti, LocalDateTime.now(), revokedBy, safeTrim(reason, 255));
        } catch (Exception ex) {
            log.warn("Failed to mark JWT audit revoked for jti={}: {}", jti, ex.getMessage());
        }
        // Always feed the deny list — even if the DB update failed, we still want
        // the still-live JWT rejected at the auth filter.
        jtiDenyListService.revoke(jti);
    }

    /**
     * Force-logout every live token for a user. Used by the admin "revoke all
     * sessions" action. Returns the number of audit rows updated.
     */
    @Transactional
    public int revokeAllForUser(Long userId, Long revokedBy, String reason) {
        if (userId == null) {
            return 0;
        }
        LocalDateTime now = LocalDateTime.now();
        List<String> liveJtis;
        try {
            liveJtis = repo.findLiveJtisForUser(userId, now);
        } catch (Exception ex) {
            log.warn("Failed to query live jtis for userId={}: {}", userId, ex.getMessage());
            return 0;
        }
        int updated = 0;
        try {
            updated = repo.markRevokedForUser(userId, now, revokedBy, safeTrim(reason, 255));
        } catch (Exception ex) {
            log.warn("Failed to revoke audit rows for userId={}: {}", userId, ex.getMessage());
        }
        for (String j : liveJtis) {
            jtiDenyListService.revoke(j);
        }
        return updated;
    }

    private static String joinRoles(Collection<? extends GrantedAuthority> authorities) {
        if (authorities == null || authorities.isEmpty()) {
            return null;
        }
        String joined = authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.joining(","));
        return safeTrim(joined, 512);
    }

    private static LocalDateTime toLocal(Date d) {
        if (d == null) return null;
        return LocalDateTime.ofInstant(d.toInstant(), java.time.ZoneId.systemDefault());
    }

    private static HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs == null ? null : attrs.getRequest();
        } catch (Exception ex) {
            return null;
        }
    }

    /**
     * Honour the canonical proxy chain header before falling back to remote addr.
     * Mirrors {@code UserActivityLogService.getClientIp} so audit IPs line up
     * with the activity log.
     */
    private static String readClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            int comma = xff.indexOf(',');
            return comma > 0 ? xff.substring(0, comma).trim() : xff.trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private static String safeTrim(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
