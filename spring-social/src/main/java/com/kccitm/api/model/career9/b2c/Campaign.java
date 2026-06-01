package com.kccitm.api.model.career9.b2c;

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

import org.hibernate.annotations.Filter;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Phase 15-06 — ABAC row-level filter (scopeFilter). The campaigns table
 * carries an {@code institute_code} column (FK to institute_detail.institute_code).
 * The other scope dimensions are not represented on this table.
 *
 * <p>NULL-tolerant: legacy campaigns may have null institute_code (b2c campaigns
 * pre-date the institute backfill); those rows are treated as wildcard and
 * remain visible to every caller.
 */
@Filter(name = "scopeFilter", condition =
        "(institute_code IN (:instituteIds) OR institute_code IS NULL)")
@Entity
@Table(name = "campaigns")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Campaign implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "campaign_id")
    private Long campaignId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "brand_logo_url", length = 500)
    private String brandLogoUrl;

    @Column(name = "target_audience", length = 200)
    private String targetAudience;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "valid_from")
    @Temporal(TemporalType.DATE)
    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date validFrom;

    @Column(name = "valid_to")
    @Temporal(TemporalType.DATE)
    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date validTo;

    @Column(name = "default_purchase_path", length = 1, columnDefinition = "char(1) default 'B'")
    private String defaultPurchasePath = "B";

    @Column(name = "default_counselling_model", length = 1, columnDefinition = "char(1) default '1'")
    private String defaultCounsellingModel = "1";

    /**
     * FK → institute_detail.institute_code. Required for new campaigns; legacy
     * campaigns may have NULL until the admin backfills via the UI. Once every
     * campaign is filled, schema flips to NOT NULL (Phase 2 migration).
     */
    @Column(name = "institute_code")
    private Integer instituteCode;

    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isActive = true;

    @Column(name = "is_deleted", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isDeleted = false;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date updatedAt;

    @PrePersist
    public void prePersist() {
        Date now = new Date();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (defaultPurchasePath == null) defaultPurchasePath = "B";
        if (defaultCounsellingModel == null) defaultCounsellingModel = "1";
        if (isActive == null) isActive = true;
        if (isDeleted == null) isDeleted = false;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Date();
    }

    public Campaign() {}

    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getSlug() { return slug; }
    public void setSlug(String v) { this.slug = v; }
    public String getBrandLogoUrl() { return brandLogoUrl; }
    public void setBrandLogoUrl(String v) { this.brandLogoUrl = v; }
    public String getTargetAudience() { return targetAudience; }
    public void setTargetAudience(String v) { this.targetAudience = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public Date getValidFrom() { return validFrom; }
    public void setValidFrom(Date v) { this.validFrom = v; }
    public Date getValidTo() { return validTo; }
    public void setValidTo(Date v) { this.validTo = v; }
    public String getDefaultPurchasePath() { return defaultPurchasePath; }
    public void setDefaultPurchasePath(String v) { this.defaultPurchasePath = v; }
    public String getDefaultCounsellingModel() { return defaultCounsellingModel; }
    public void setDefaultCounsellingModel(String v) { this.defaultCounsellingModel = v; }
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer v) { this.instituteCode = v; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean v) { this.isActive = v; }
    public Boolean getIsDeleted() { return isDeleted; }
    public void setIsDeleted(Boolean v) { this.isDeleted = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date v) { this.updatedAt = v; }
}
