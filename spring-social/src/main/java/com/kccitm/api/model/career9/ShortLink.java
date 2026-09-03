package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One emailed short link: a 7-character code standing in for a full tokenized URL.
 *
 * <p>See {@code V20260903001__short_link.sql} for why this exists. In short: a counselling
 * booking link is a ~320-character string because of the JWT inside it, and that is what a
 * student sees in their inbox. This maps a short code onto the real address; the
 * {@code /s/{code}} endpoint redirects.
 *
 * <p>Deliberately <b>not</b> a security boundary. The code is random and unguessable in
 * practice, but the thing that actually decides whether a link works is the token in
 * {@link #targetUrl}, validated by whichever endpoint the redirect lands on. This row is a
 * lookup table, nothing more — which is also why it carries no expiry by default.
 */
@Entity
@Table(name = "short_link")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ShortLink implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 16, unique = true)
    private String code;

    @Column(name = "target_url", nullable = false, columnDefinition = "TEXT")
    private String targetUrl;

    /** SHA-256 of {@link #targetUrl} — a TEXT column cannot be indexed for lookup. */
    @Column(name = "target_hash", nullable = false, length = 64)
    private String targetHash;

    @Column(name = "purpose", length = 64)
    private String purpose;

    /** Null means "as long as the target token lasts", which is the normal case. */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "hit_count", nullable = false)
    private Integer hitCount = 0;

    @Column(name = "last_hit_at")
    private LocalDateTime lastHitAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (hitCount == null) hitCount = 0;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getTargetUrl() { return targetUrl; }
    public void setTargetUrl(String targetUrl) { this.targetUrl = targetUrl; }

    public String getTargetHash() { return targetHash; }
    public void setTargetHash(String targetHash) { this.targetHash = targetHash; }

    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public Integer getHitCount() { return hitCount; }
    public void setHitCount(Integer hitCount) { this.hitCount = hitCount; }

    public LocalDateTime getLastHitAt() { return lastHitAt; }
    public void setLastHitAt(LocalDateTime lastHitAt) { this.lastHitAt = lastHitAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
