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

/**
 * Institute&lt;-&gt;Assessment catalog (B2B redesign, Layer 1).
 *
 * "This assessment is offered by this institute" — a direct join row, decoupled
 * from the per-level registration links in {@link AssessmentInstituteMapping}.
 * Set in the institute-creation wizard's catalog step and kept in sync by the
 * unified mapping page (every createMapping upserts the matching row).
 */
@Entity
@Table(name = "institute_assessment",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_institute_assessment",
           columnNames = {"institute_code", "assessment_id"}
       ))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class InstituteAssessment implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "institute_code", nullable = false)
    private Integer instituteCode;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

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
        if (this.createdAt == null) this.createdAt = now;
        if (this.updatedAt == null) this.updatedAt = now;
        if (this.isActive == null) this.isActive = true;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public InstituteAssessment() {}

    public InstituteAssessment(Integer instituteCode, Long assessmentId) {
        this.instituteCode = instituteCode;
        this.assessmentId = assessmentId;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
