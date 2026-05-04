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

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "campaign_assessment_tiers")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CampaignAssessmentTier implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "campaign_assessment_mapping_id", nullable = false)
    private Long campaignAssessmentMappingId;

    @Column(name = "pricing_tier_id", nullable = false)
    private Long pricingTierId;

    /** Per-(campaign,assessment) override of PricingTier.basePriceInr. NULL = use base. */
    @Column(name = "price_override_inr")
    private Long priceOverrideInr;

    @Column(name = "is_default", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isDefault = false;

    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isActive = true;

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
        if (isDefault == null) isDefault = false;
        if (isActive == null) isActive = true;
    }

    @PreUpdate
    public void preUpdate() { updatedAt = new Date(); }

    public CampaignAssessmentTier() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getCampaignAssessmentMappingId() { return campaignAssessmentMappingId; }
    public void setCampaignAssessmentMappingId(Long v) { this.campaignAssessmentMappingId = v; }
    public Long getPricingTierId() { return pricingTierId; }
    public void setPricingTierId(Long v) { this.pricingTierId = v; }
    public Long getPriceOverrideInr() { return priceOverrideInr; }
    public void setPriceOverrideInr(Long v) { this.priceOverrideInr = v; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean v) { this.isDefault = v; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean v) { this.isActive = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date v) { this.updatedAt = v; }
}
