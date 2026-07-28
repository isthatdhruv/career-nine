package com.kccitm.api.model.email;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Convert;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.kccitm.api.config.EncryptedStringConverter;

/**
 * A configurable sending identity (one provider account). Multiple accounts may exist
 * per provider; the dispatcher selects one per send (manual override → institute default
 * → global default). The {@code credentials} column is AES-encrypted at rest and never
 * serialized back to the API.
 */
@Entity
@Table(name = "email_account")
public class EmailAccount implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", length = 120, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 20, nullable = false)
    private EmailProvider provider;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", length = 20)
    private EmailMode mode;

    @Column(name = "from_email", length = 200, nullable = false)
    private String fromEmail;

    @Column(name = "from_name", length = 200)
    private String fromName;

    /** Provider secrets as a JSON blob ({@link EmailAccountCredentials}); encrypted at rest. */
    @JsonIgnore
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "credentials_encrypted", columnDefinition = "TEXT")
    private String credentials;

    @Column(name = "is_global_default", nullable = false)
    private Boolean isGlobalDefault = Boolean.FALSE;

    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at", nullable = false)
    private Date updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PrePersist
    public void prePersist() {
        Date now = new Date();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Date();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public EmailProvider getProvider() { return provider; }
    public void setProvider(EmailProvider provider) { this.provider = provider; }
    public EmailMode getMode() { return mode; }
    public void setMode(EmailMode mode) { this.mode = mode; }
    public String getFromEmail() { return fromEmail; }
    public void setFromEmail(String fromEmail) { this.fromEmail = fromEmail; }
    public String getFromName() { return fromName; }
    public void setFromName(String fromName) { this.fromName = fromName; }
    public String getCredentials() { return credentials; }
    public void setCredentials(String credentials) { this.credentials = credentials; }
    public Boolean getIsGlobalDefault() { return isGlobalDefault; }
    public void setIsGlobalDefault(Boolean isGlobalDefault) { this.isGlobalDefault = isGlobalDefault; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
