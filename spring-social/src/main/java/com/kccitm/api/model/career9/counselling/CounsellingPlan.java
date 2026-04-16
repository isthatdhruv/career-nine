package com.kccitm.api.model.career9.counselling;

import java.io.Serializable;
import java.time.LocalDate;
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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.school.InstituteDetail;

/**
 * Represents a school-sponsored (EVENT track) counselling plan.
 * When an institute purchases counselling for its students,
 * a CounsellingPlan record is created by the Career-9 admin.
 * Students belonging to this institute are automatically eligible
 * for counselling without individual payment.
 */
@Entity
@Table(name = "counselling_plan")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellingPlan implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "institute_code", referencedColumnName = "institute_code", nullable = false)
    private InstituteDetail institute;

    @Column(name = "plan_name", nullable = false)
    private String planName;

    @Column(name = "total_sessions", nullable = false)
    private Integer totalSessions;

    @Column(name = "sessions_used", columnDefinition = "INT DEFAULT 0")
    private Integer sessionsUsed = 0;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "status", nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'ACTIVE'")
    private String status = "ACTIVE";

    @Column(name = "amount_paid")
    private Long amountPaid;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) this.status = "ACTIVE";
        if (this.sessionsUsed == null) this.sessionsUsed = 0;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public CounsellingPlan() {}

    // Getters and Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public InstituteDetail getInstitute() { return institute; }
    public void setInstitute(InstituteDetail institute) { this.institute = institute; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public Integer getTotalSessions() { return totalSessions; }
    public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }

    public Integer getSessionsUsed() { return sessionsUsed; }
    public void setSessionsUsed(Integer sessionsUsed) { this.sessionsUsed = sessionsUsed; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getAmountPaid() { return amountPaid; }
    public void setAmountPaid(Long amountPaid) { this.amountPaid = amountPaid; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
