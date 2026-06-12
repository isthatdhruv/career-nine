package com.kccitm.api.model.career9;

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
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "school_assessment_tier",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_school_assessment_tier_sort",
           columnNames = {"institute_code", "session_id", "assessment_id", "sort_order"}
       ))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SchoolAssessmentTier implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_id")
    private Long tierId;

    @Column(name = "institute_code", nullable = false)
    private Long instituteCode;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", nullable = false, length = 200)
    private String description;

    @Column(name = "amount")
    private Long amount;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "max_registrations")
    private Integer maxRegistrations;

    // Feature inclusions — mirror the B2C PricingTier bundle so a school tier can
    // grant the same services (final report / dashboard / counselling / lms).
    // The columns were added by migration V20260606008; these fields map them so
    // the tier CRUD endpoints and the registration grant can actually read them.
    @Column(name = "includes_final_report", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean includesFinalReport = false;

    @Column(name = "includes_dashboard", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean includesDashboard = false;

    @Column(name = "dashboard_validity_days")
    private Integer dashboardValidityDays;

    @Column(name = "includes_counselling", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean includesCounselling = false;

    @Column(name = "counselling_session_count")
    private Integer counsellingSessionCount;

    @Column(name = "includes_lms", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean includesLms = false;

    @Column(name = "lms_validity_days")
    private Integer lmsValidityDays;

    @Column(name = "current_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private Integer currentCount = 0;

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
        if (this.createdAt == null) this.createdAt = new Date();
        if (this.updatedAt == null) this.updatedAt = new Date();
        if (this.currentCount == null) this.currentCount = 0;
        if (this.isActive == null) this.isActive = true;
        if (this.includesFinalReport == null) this.includesFinalReport = false;
        if (this.includesDashboard == null) this.includesDashboard = false;
        if (this.includesCounselling == null) this.includesCounselling = false;
        if (this.includesLms == null) this.includesLms = false;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public SchoolAssessmentTier() {}

    public Long getTierId() { return tierId; }
    public void setTierId(Long tierId) { this.tierId = tierId; }

    public Long getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Long instituteCode) { this.instituteCode = instituteCode; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Integer getMaxRegistrations() { return maxRegistrations; }
    public void setMaxRegistrations(Integer maxRegistrations) { this.maxRegistrations = maxRegistrations; }

    public Boolean getIncludesFinalReport() { return includesFinalReport; }
    public void setIncludesFinalReport(Boolean v) { this.includesFinalReport = v; }
    public Boolean getIncludesDashboard() { return includesDashboard; }
    public void setIncludesDashboard(Boolean v) { this.includesDashboard = v; }
    public Integer getDashboardValidityDays() { return dashboardValidityDays; }
    public void setDashboardValidityDays(Integer v) { this.dashboardValidityDays = v; }
    public Boolean getIncludesCounselling() { return includesCounselling; }
    public void setIncludesCounselling(Boolean v) { this.includesCounselling = v; }
    public Integer getCounsellingSessionCount() { return counsellingSessionCount; }
    public void setCounsellingSessionCount(Integer v) { this.counsellingSessionCount = v; }
    public Boolean getIncludesLms() { return includesLms; }
    public void setIncludesLms(Boolean v) { this.includesLms = v; }
    public Integer getLmsValidityDays() { return lmsValidityDays; }
    public void setLmsValidityDays(Integer v) { this.lmsValidityDays = v; }

    public Integer getCurrentCount() { return currentCount; }
    public void setCurrentCount(Integer currentCount) { this.currentCount = currentCount; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
