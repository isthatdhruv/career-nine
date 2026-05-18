package com.kccitm.api.service;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.AuthAudit;
import com.kccitm.api.repository.AuthAuditRepository;

/**
 * Real implementation of {@link AuthAuditService} — persists DENY decisions
 * to the {@code auth_audit} table for forensic analysis and Phase 17's
 * "T+24h false-positive rate" exit gate.
 *
 * <p>The auth_audit DDL (Phase 14, V20260511001) stores the four scope
 * dimensions in a single encoded VARCHAR(128) column. This impl encodes the
 * tuple as {@code "i=1,s=2026,c=3,x=4"} omitting null dimensions — readable in
 * SQL queries and stable across rows.
 *
 * <p>Runs {@code @Async} so the audit write does NOT block the request thread.
 * {@code @EnableAsync} is present on {@link com.kccitm.api.SpringSocialApplication}.
 *
 * <p>Every exception path is swallowed: an audit-write failure must NEVER
 * cause the request itself to fail (the auth path is in log-only mode and
 * the request would have succeeded regardless).
 */
@Service
public class AuthAuditServiceImpl implements AuthAuditService {
    private static final Logger log = LoggerFactory.getLogger(AuthAuditServiceImpl.class);

    @Autowired
    private AuthAuditRepository repo;

    @Async
    @Override
    public void recordDeny(Long userId,
                           String permission,
                           Integer instituteId,
                           Integer sessionId,
                           Integer courseCode,
                           Long sectionId,
                           String requestId,
                           String reason) {
        try {
            AuthAudit row = new AuthAudit();
            row.setTs(LocalDateTime.now());
            row.setUserId(userId);
            row.setPermission(permission);
            row.setScope(encodeScope(instituteId, sessionId, courseCode, sectionId));
            row.setResourceId(null);
            row.setDecision(AuthAudit.Decision.DENY);
            row.setReason(reason);
            row.setRequestId(requestId);
            repo.save(row);
        } catch (Exception e) {
            // Never let an audit write break the request path.
            log.error("AuthAuditServiceImpl.recordDeny failed for user={} perm={} reason={}",
                    userId, permission, reason, e);
        }
    }

    /**
     * Plan 20-02 write path — owned by {@code SensitiveOpAspect}. Writes one
     * row per {@code @SensitiveOp}-annotated method invocation with no scope
     * encoded (the aspect runs at the method seam and doesn't know the target
     * resource's scope dims). {@code decision} is either {@code "ALLOW"} (on
     * success) or {@code "DENY"} (on exception); {@code reason} is null on
     * ALLOW and {@code "<ExceptionClass>: <message>"} on DENY.
     *
     * <p>Runs {@code @Async} like {@link #recordDeny} so the audit write never
     * blocks the request thread. All exceptions are swallowed — a failed audit
     * MUST NEVER fail the business operation.
     */
    @Async
    @Override
    public void recordSensitiveOp(Long userId,
                                  String permission,
                                  String decision,
                                  String reason,
                                  String requestId) {
        try {
            AuthAudit row = new AuthAudit();
            row.setTs(LocalDateTime.now());
            row.setUserId(userId);
            row.setPermission(permission);
            row.setScope(null);
            row.setResourceId(null);
            row.setDecision(parseDecision(decision));
            row.setReason(reason);
            row.setRequestId(requestId);
            repo.save(row);
        } catch (Exception e) {
            // Never let an audit write break the request path.
            log.error("AuthAuditServiceImpl.recordSensitiveOp failed for user={} perm={} decision={} reason={}",
                    userId, permission, decision, reason, e);
        }
    }

    /**
     * Defensive parse: accept "ALLOW" / "DENY" (any case). Unknown values
     * default to DENY so a typo at a call site doesn't silently insert an
     * ALLOW row.
     */
    private AuthAudit.Decision parseDecision(String decision) {
        if (decision == null) {
            return AuthAudit.Decision.DENY;
        }
        try {
            return AuthAudit.Decision.valueOf(decision.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("AuthAuditServiceImpl.recordSensitiveOp got unknown decision='{}', defaulting to DENY", decision);
            return AuthAudit.Decision.DENY;
        }
    }

    /**
     * Encodes the 4-dim scope tuple as {@code "i=<v>,s=<v>,c=<v>,x=<v>"} omitting
     * null dimensions. Returns {@code null} when every dimension is null.
     */
    private String encodeScope(Integer i, Integer s, Integer c, Long x) {
        if (i == null && s == null && c == null && x == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(32);
        if (i != null) sb.append("i=").append(i);
        if (s != null) { if (sb.length() > 0) sb.append(','); sb.append("s=").append(s); }
        if (c != null) { if (sb.length() > 0) sb.append(','); sb.append("c=").append(c); }
        if (x != null) { if (sb.length() > 0) sb.append(','); sb.append("x=").append(x); }
        // 128-char cap is the DDL's hard limit — defensive trim
        if (sb.length() > 128) {
            return sb.substring(0, 128);
        }
        return sb.toString();
    }
}
