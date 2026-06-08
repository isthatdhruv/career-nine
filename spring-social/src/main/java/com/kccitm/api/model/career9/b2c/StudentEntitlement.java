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

/**
 * The contract row between platform and one paying (or trying) student
 * for one (campaign, assessment) purchase. Service flags are denormalised
 * snapshots taken at activation so future tier-feature edits don't change
 * an existing student's entitlement shape.
 *
 * Status values: pending / active / expired / revoked / refunded
 */
@Entity
@Table(name = "student_entitlements")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class StudentEntitlement implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "entitlement_id")
    private Long entitlementId;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Column(name = "campaign_id")
    private Long campaignId;

    // B2B (assessment-mapping) source. Null for B2C (campaign) entitlements; set
    // for B2B so the free→paid upgrade can resolve this mapping's active paid wave.
    // Mirrors the payment_transaction discriminator pattern (campaign_id XOR mapping_id).
    @Column(name = "mapping_id")
    private Long mappingId;

    // B2B legacy-school source — set when the entitlement was minted from a
    // school_assessment_config registration. With campaign_id (B2C) and mapping_id
    // (per-level B2B), this forms a 3-way source discriminator: exactly one is set.
    @Column(name = "school_config_id")
    private Long schoolConfigId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "campaign_assessment_tier_id")
    private Long campaignAssessmentTierId;

    @Column(name = "pricing_tier_id")
    private Long pricingTierId;

    @Column(name = "payment_transaction_id")
    private Long paymentTransactionId;

    @Column(name = "purchase_path", length = 1)
    private String purchasePath;

    @Column(name = "counselling_model", length = 1)
    private String counsellingModel;

    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'pending'")
    private String status = "pending";

    @Column(name = "granted_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date grantedAt;

    @Column(name = "expires_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date expiresAt;

    @Column(name = "dashboard_active", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean dashboardActive = false;

    @Column(name = "dashboard_expires_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date dashboardExpiresAt;

    @Column(name = "counselling_active", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean counsellingActive = false;

    @Column(name = "counselling_sessions_total", columnDefinition = "INT DEFAULT 0")
    private Integer counsellingSessionsTotal = 0;

    @Column(name = "counselling_sessions_used", columnDefinition = "INT DEFAULT 0")
    private Integer counsellingSessionsUsed = 0;

    @Column(name = "lms_active", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean lmsActive = false;

    @Column(name = "lms_expires_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date lmsExpiresAt;

    @Column(name = "final_report_active", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean finalReportActive = false;

    @Column(name = "access_token", length = 64, unique = true)
    private String accessToken;

    @Column(name = "access_token_expires_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date accessTokenExpiresAt;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date updatedAt;

    @Column(name = "report_prepared_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date reportPreparedAt;

    @PrePersist
    public void prePersist() {
        Date now = new Date();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null) status = "pending";
        if (counsellingSessionsTotal == null) counsellingSessionsTotal = 0;
        if (counsellingSessionsUsed == null) counsellingSessionsUsed = 0;
        if (dashboardActive == null) dashboardActive = false;
        if (counsellingActive == null) counsellingActive = false;
        if (lmsActive == null) lmsActive = false;
        if (finalReportActive == null) finalReportActive = false;
    }

    @PreUpdate
    public void preUpdate() { updatedAt = new Date(); }

    public StudentEntitlement() {}

    public Long getEntitlementId() { return entitlementId; }
    public void setEntitlementId(Long v) { this.entitlementId = v; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public Long getMappingId() { return mappingId; }
    public void setMappingId(Long v) { this.mappingId = v; }
    public Long getSchoolConfigId() { return schoolConfigId; }
    public void setSchoolConfigId(Long v) { this.schoolConfigId = v; }
    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }
    public Long getCampaignAssessmentTierId() { return campaignAssessmentTierId; }
    public void setCampaignAssessmentTierId(Long v) { this.campaignAssessmentTierId = v; }
    public Long getPricingTierId() { return pricingTierId; }
    public void setPricingTierId(Long v) { this.pricingTierId = v; }
    public Long getPaymentTransactionId() { return paymentTransactionId; }
    public void setPaymentTransactionId(Long v) { this.paymentTransactionId = v; }
    public String getPurchasePath() { return purchasePath; }
    public void setPurchasePath(String v) { this.purchasePath = v; }
    public String getCounsellingModel() { return counsellingModel; }
    public void setCounsellingModel(String v) { this.counsellingModel = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public Date getGrantedAt() { return grantedAt; }
    public void setGrantedAt(Date v) { this.grantedAt = v; }
    public Date getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Date v) { this.expiresAt = v; }
    public Boolean getDashboardActive() { return dashboardActive; }
    public void setDashboardActive(Boolean v) { this.dashboardActive = v; }
    public Date getDashboardExpiresAt() { return dashboardExpiresAt; }
    public void setDashboardExpiresAt(Date v) { this.dashboardExpiresAt = v; }
    public Boolean getCounsellingActive() { return counsellingActive; }
    public void setCounsellingActive(Boolean v) { this.counsellingActive = v; }
    public Integer getCounsellingSessionsTotal() { return counsellingSessionsTotal; }
    public void setCounsellingSessionsTotal(Integer v) { this.counsellingSessionsTotal = v; }
    public Integer getCounsellingSessionsUsed() { return counsellingSessionsUsed; }
    public void setCounsellingSessionsUsed(Integer v) { this.counsellingSessionsUsed = v; }
    public Boolean getLmsActive() { return lmsActive; }
    public void setLmsActive(Boolean v) { this.lmsActive = v; }
    public Date getLmsExpiresAt() { return lmsExpiresAt; }
    public void setLmsExpiresAt(Date v) { this.lmsExpiresAt = v; }
    public Boolean getFinalReportActive() { return finalReportActive; }
    public void setFinalReportActive(Boolean v) { this.finalReportActive = v; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String v) { this.accessToken = v; }
    public Date getAccessTokenExpiresAt() { return accessTokenExpiresAt; }
    public void setAccessTokenExpiresAt(Date v) { this.accessTokenExpiresAt = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date v) { this.updatedAt = v; }
    public Date getReportPreparedAt() { return reportPreparedAt; }
    public void setReportPreparedAt(Date v) { this.reportPreparedAt = v; }
}
