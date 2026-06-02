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
@Table(name = "pricing_tiers")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PricingTier implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_id")
    private Long tierId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "base_price_inr", nullable = false)
    private Long basePriceInr;

    @Column(name = "currency", length = 10, columnDefinition = "varchar(10) default 'INR'")
    private String currency = "INR";

    @Column(name = "includes_final_report")
    private Boolean includesFinalReport = false;

    @Column(name = "includes_dashboard")
    private Boolean includesDashboard = false;

    @Column(name = "includes_counselling")
    private Boolean includesCounselling = false;

    @Column(name = "counselling_session_count")
    private Integer counsellingSessionCount;

    @Column(name = "includes_lms")
    private Boolean includesLms = false;

    @Column(name = "lms_validity_days")
    private Integer lmsValidityDays;

    @Column(name = "dashboard_validity_days")
    private Integer dashboardValidityDays;

    @Column(name = "sort_order", columnDefinition = "INT DEFAULT 0")
    private Integer sortOrder = 0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "is_deleted")
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
        if (currency == null) currency = "INR";
        if (isActive == null) isActive = true;
        if (isDeleted == null) isDeleted = false;
        if (sortOrder == null) sortOrder = 0;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Date();
    }

    public PricingTier() {}

    public Long getTierId() { return tierId; }
    public void setTierId(Long tierId) { this.tierId = tierId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getBasePriceInr() { return basePriceInr; }
    public void setBasePriceInr(Long basePriceInr) { this.basePriceInr = basePriceInr; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Boolean getIncludesFinalReport() { return includesFinalReport; }
    public void setIncludesFinalReport(Boolean v) { this.includesFinalReport = v; }
    public Boolean getIncludesDashboard() { return includesDashboard; }
    public void setIncludesDashboard(Boolean v) { this.includesDashboard = v; }
    public Boolean getIncludesCounselling() { return includesCounselling; }
    public void setIncludesCounselling(Boolean v) { this.includesCounselling = v; }
    public Integer getCounsellingSessionCount() { return counsellingSessionCount; }
    public void setCounsellingSessionCount(Integer v) { this.counsellingSessionCount = v; }
    public Boolean getIncludesLms() { return includesLms; }
    public void setIncludesLms(Boolean v) { this.includesLms = v; }
    public Integer getLmsValidityDays() { return lmsValidityDays; }
    public void setLmsValidityDays(Integer v) { this.lmsValidityDays = v; }
    public Integer getDashboardValidityDays() { return dashboardValidityDays; }
    public void setDashboardValidityDays(Integer v) { this.dashboardValidityDays = v; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer v) { this.sortOrder = v; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean v) { this.isActive = v; }
    public Boolean getIsDeleted() { return isDeleted; }
    public void setIsDeleted(Boolean v) { this.isDeleted = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date v) { this.updatedAt = v; }
}
