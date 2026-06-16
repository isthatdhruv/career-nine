package com.kccitm.api.model.career9.counselling;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Counselling Phase 4 — admin assignment of counsellors to assessments.
 *
 * <p>The agreed authority model: counsellors create their own availability slots,
 * but the ADMIN decides which counsellor(s) handle counselling for a given
 * assessment. When a student finishes an assessment and books a slot, only slots
 * from counsellors assigned to that assessment (and at the student's institute)
 * are offered. If an assessment has no assignments, the booking flow falls back
 * to the institute filter alone (backward compatible).
 */
@Entity
@Table(name = "counsellor_assessment_assignment",
       uniqueConstraints = @UniqueConstraint(columnNames = {"counsellor_id", "assessment_id"}))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellorAssessmentAssignment implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counsellor_id", nullable = false)
    private Counsellor counsellor;

    // Plain column (not an FK relationship) — assessmentId is referenced as a bare
    // Long across the codebase, so we avoid coupling to the AssessmentTable entity.
    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @JsonProperty("isActive")
    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isActive = true;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.isActive == null) this.isActive = true;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public CounsellorAssessmentAssignment() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Counsellor getCounsellor() { return counsellor; }
    public void setCounsellor(Counsellor counsellor) { this.counsellor = counsellor; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    @JsonProperty("isActive")
    public Boolean getIsActive() { return isActive; }
    @JsonProperty("isActive")
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Long getAssignedBy() { return assignedBy; }
    public void setAssignedBy(Long assignedBy) { this.assignedBy = assignedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
