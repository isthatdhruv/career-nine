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
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "campaign_assessment_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"campaign_id", "assessment_id"}))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CampaignAssessmentMapping implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    /** 'A' or 'B' override; NULL means use Campaign.defaultPurchasePath */
    @Column(name = "purchase_path", length = 1)
    private String purchasePath;

    /** '1' or '2' override; NULL means use Campaign.defaultCounsellingModel */
    @Column(name = "counselling_model", length = 1)
    private String counsellingModel;

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
        if (sortOrder == null) sortOrder = 0;
        if (isActive == null) isActive = true;
        if (isDeleted == null) isDeleted = false;
    }

    @PreUpdate
    public void preUpdate() { updatedAt = new Date(); }

    public CampaignAssessmentMapping() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }
    public String getPurchasePath() { return purchasePath; }
    public void setPurchasePath(String v) { this.purchasePath = v; }
    public String getCounsellingModel() { return counsellingModel; }
    public void setCounsellingModel(String v) { this.counsellingModel = v; }
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
