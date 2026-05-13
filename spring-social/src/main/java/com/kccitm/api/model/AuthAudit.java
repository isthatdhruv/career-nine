package com.kccitm.api.model;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * JPA entity for the {@code auth_audit} table created in Plan 14-01
 * (migration V20260511001).
 *
 * <p>Phase 14 only creates the entity + repository. Phase 15 will start
 * writing rows on every DENY decision (in log-only mode) and on sensitive
 * ALLOWs (role.assign, user.write, payment.refund).
 */
@Entity
@Table(name = "auth_audit")
public class AuthAudit implements Serializable {
    private static final long serialVersionUID = 1L;

    public enum Decision { ALLOW, DENY }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Millisecond-precision timestamp — matches DDL {@code DATETIME(3)}. */
    @Column(name = "ts", nullable = false)
    private LocalDateTime ts;

    /** Nullable — anonymous (pre-auth) requests have no user. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "permission", length = 64)
    private String permission;

    /** Encoded scope, e.g. "i=5,s=2026". */
    @Column(name = "scope", length = 128)
    private String scope;

    @Column(name = "resource_id", length = 64)
    private String resourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 5)
    private Decision decision;

    @Column(name = "reason", length = 255)
    private String reason;

    @Column(name = "request_id", length = 36)
    private String requestId;

    public AuthAudit() { }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getTs() { return ts; }
    public void setTs(LocalDateTime ts) { this.ts = ts; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getPermission() { return permission; }
    public void setPermission(String permission) { this.permission = permission; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }

    public Decision getDecision() { return decision; }
    public void setDecision(Decision decision) { this.decision = decision; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
}
