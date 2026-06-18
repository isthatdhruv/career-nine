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

/**
 * Class-based registration routing for a B2C campaign.
 *
 * Mirrors the B2B "select class → assessment auto-selected with price" flow as a
 * thin routing layer ON TOP of {@link CampaignAssessmentMapping}: each row maps a
 * SchoolClasses id to an assessment that is already attached to the campaign.
 * Pricing still flows from that assessment's tiers — the class picker merely
 * resolves which assessment (and thus default tier) the student gets, so the
 * existing paid/trial/payment endpoints need no changes.
 *
 * UNIQUE(campaign_id, class_id): a class resolves to exactly one assessment per
 * campaign. The same assessment may serve multiple classes (multiple rows).
 */
@Entity
@Table(name = "campaign_class_assessment",
       uniqueConstraints = @UniqueConstraint(columnNames = {"campaign_id", "class_id"}))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CampaignClassAssessment implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    /** FK to SchoolClasses.id (session-scoped class, e.g. "Class 10"). */
    @Column(name = "class_id", nullable = false)
    private Integer classId;

    /** SchoolSession the class belongs to; classes are session-scoped. Informational. */
    @Column(name = "session_id")
    private Integer sessionId;

    /** Assessment this class routes to. Must be attached via CampaignAssessmentMapping. */
    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

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

    public CampaignClassAssessment() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public Integer getClassId() { return classId; }
    public void setClassId(Integer v) { this.classId = v; }
    public Integer getSessionId() { return sessionId; }
    public void setSessionId(Integer v) { this.sessionId = v; }
    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }
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
