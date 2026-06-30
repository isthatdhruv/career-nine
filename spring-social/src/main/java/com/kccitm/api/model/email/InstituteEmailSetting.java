package com.kccitm.api.model.email;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

/**
 * Per-institute default sending account (whitelabel routing). One row per institute_code.
 * The dispatcher resolves the account as: manual override → this institute default →
 * global default. A null {@code defaultAccountId} (or no row) means "fall back to global".
 */
@Entity
@Table(name = "institute_email_setting")
public class InstituteEmailSetting implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "institute_code", nullable = false, unique = true)
    private Integer instituteCode;

    @Column(name = "default_account_id")
    private Long defaultAccountId;

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
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }
    public Long getDefaultAccountId() { return defaultAccountId; }
    public void setDefaultAccountId(Long defaultAccountId) { this.defaultAccountId = defaultAccountId; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
