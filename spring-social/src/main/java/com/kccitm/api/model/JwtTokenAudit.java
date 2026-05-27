package com.kccitm.api.model;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * JPA entity for the {@code jwt_token_audit} table (migration V20260527001).
 *
 * <p>Records one row per JWT minted by {@link com.kccitm.api.security.TokenProvider} —
 * subject, issued/expires timestamps, IP, User-Agent, roles snapshot, and revocation
 * state. Powers the super-admin token console.
 *
 * <p>Revocation model: {@code revoked_at IS NULL} means the row is the live, valid
 * audit entry. Once revoked, the audit row stays — we never delete history — and
 * {@code revoked_by} / {@code revocation_reason} explain who acted and why. The
 * in-memory deny list ({@link com.kccitm.api.security.JtiDenyListService}) is the
 * source of truth for "is this token rejectable RIGHT NOW" at the auth-filter
 * layer; this table is the durable record that survives JVM restarts.
 */
@Entity
@Table(name = "jwt_token_audit")
public class JwtTokenAudit implements Serializable {
    private static final long serialVersionUID = 1L;

    public enum TokenType { ACCESS, REFRESH, ASSESSMENT, LEGACY }

    @Id
    @Column(name = "jti", length = 36, nullable = false, updatable = false)
    private String jti;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "user_email", length = 255)
    private String userEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "token_type", length = 16, nullable = false)
    private TokenType tokenType;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "not_before")
    private LocalDateTime notBefore;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "revoked_by")
    private Long revokedBy;

    @Column(name = "revocation_reason", length = 255)
    private String revocationReason;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "roles_snapshot", length = 512)
    private String rolesSnapshot;

    @Column(name = "super_admin", nullable = false)
    private boolean superAdmin;

    @Column(name = "issuer", length = 64)
    private String issuer;

    public JwtTokenAudit() { }

    public String getJti() { return jti; }
    public void setJti(String jti) { this.jti = jti; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public TokenType getTokenType() { return tokenType; }
    public void setTokenType(TokenType tokenType) { this.tokenType = tokenType; }

    public LocalDateTime getIssuedAt() { return issuedAt; }
    public void setIssuedAt(LocalDateTime issuedAt) { this.issuedAt = issuedAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getNotBefore() { return notBefore; }
    public void setNotBefore(LocalDateTime notBefore) { this.notBefore = notBefore; }

    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }

    public Long getRevokedBy() { return revokedBy; }
    public void setRevokedBy(Long revokedBy) { this.revokedBy = revokedBy; }

    public String getRevocationReason() { return revocationReason; }
    public void setRevocationReason(String revocationReason) { this.revocationReason = revocationReason; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public String getRolesSnapshot() { return rolesSnapshot; }
    public void setRolesSnapshot(String rolesSnapshot) { this.rolesSnapshot = rolesSnapshot; }

    public boolean isSuperAdmin() { return superAdmin; }
    public void setSuperAdmin(boolean superAdmin) { this.superAdmin = superAdmin; }

    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }
}
