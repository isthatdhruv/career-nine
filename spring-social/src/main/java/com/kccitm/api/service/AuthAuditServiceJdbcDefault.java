package com.kccitm.api.service;

import java.sql.Timestamp;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * JDBC-backed fallback implementation of {@link AuthAuditService}. Used only
 * when no other bean named {@code authAuditServiceImpl} is present on the
 * classpath — i.e., when Phase 15-06's {@link AuthAuditServiceImpl} has NOT
 * yet shipped.
 *
 * <p>Plan 20-02 created this class so the sensitive-op aspect can ship
 * independently of Plan 15-06's full JPA-based implementation. In the
 * current codebase 15-06 has already shipped, so this class is effectively
 * dormant — Spring resolves to {@link AuthAuditServiceImpl} because
 * {@code @ConditionalOnMissingBean(name = "authAuditServiceImpl")} suppresses
 * registration when that bean is present.
 *
 * <p>Kept on the classpath as a defensive fallback: if a future refactor
 * removes or renames {@code AuthAuditServiceImpl} we still write audit rows
 * via raw JDBC instead of failing wiring.
 *
 * <p>Bean-name contract: this class is named such that
 * {@code @ConditionalOnMissingBean(name = "authAuditServiceImpl")} is the
 * authoritative supersede trigger. Plan 15-06's {@code AuthAuditServiceImpl}
 * registers with the default bean-name {@code authAuditServiceImpl} (Spring's
 * lower-camel-cased simple class name).
 */
@Service
@ConditionalOnMissingBean(name = "authAuditServiceImpl")
public class AuthAuditServiceJdbcDefault implements AuthAuditService {

    private static final Logger log = LoggerFactory.getLogger(AuthAuditServiceJdbcDefault.class);

    @Autowired
    private JdbcTemplate jdbc;

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
            jdbc.update(
                "INSERT INTO auth_audit (ts, user_id, permission, scope, resource_id, decision, reason, request_id) "
              + "VALUES (?, ?, ?, ?, ?, 'DENY', ?, ?)",
                Timestamp.from(Instant.now()),
                userId,
                permission,
                encodeScope(instituteId, sessionId, courseCode, sectionId),
                null,
                reason,
                requestId);
        } catch (Throwable t) {
            // Never let an audit write break the request path.
            log.warn("auth_audit DENY insert failed perm={} user={}: {}", permission, userId, t.toString());
        }
    }

    @Override
    public void recordSensitiveOp(Long userId,
                                  String permission,
                                  String decision,
                                  String reason,
                                  String requestId) {
        String safeDecision = normalizeDecision(decision);
        try {
            jdbc.update(
                "INSERT INTO auth_audit (ts, user_id, permission, scope, resource_id, decision, reason, request_id) "
              + "VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)",
                Timestamp.from(Instant.now()),
                userId,
                permission,
                safeDecision,
                reason,
                requestId);
        } catch (Throwable t) {
            // Never let an audit write break the request path.
            log.warn("auth_audit {} insert failed perm={} user={}: {}",
                    safeDecision, permission, userId, t.toString());
        }
    }

    /**
     * Encodes the 4-dim scope tuple as {@code "i=<v>,s=<v>,c=<v>,x=<v>"}
     * omitting null dimensions. Returns {@code null} when every dim is null.
     * Matches the encoding used by {@link AuthAuditServiceImpl} so rows
     * written by either impl are queryable consistently.
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
        if (sb.length() > 128) {
            return sb.substring(0, 128);
        }
        return sb.toString();
    }

    /**
     * Accept {@code "ALLOW"} or {@code "DENY"} (any case). Anything else is
     * coerced to {@code "DENY"} so a typo at the call site cannot silently
     * record an ALLOW. The auth_audit.decision column is an ENUM('ALLOW','DENY')
     * — passing any other literal would fail the INSERT.
     */
    private String normalizeDecision(String decision) {
        if (decision == null) return "DENY";
        String up = decision.trim().toUpperCase();
        return ("ALLOW".equals(up) || "DENY".equals(up)) ? up : "DENY";
    }
}
