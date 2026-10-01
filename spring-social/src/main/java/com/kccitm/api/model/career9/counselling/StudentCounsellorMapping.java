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
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIncludeProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;

/**
 * The one counsellor a student is mapped to. One row per student ({@code uk_scm_student}):
 * reassigning moves the row to the new counsellor instead of adding a second active one, and
 * an {@code is_active = 0} row counts as unmapped everywhere.
 *
 * <p>The constraint name is repeated from V20260929002 so Hibernate's {@code ddl-auto=update}
 * finds it by name and does not add a hash-named duplicate beside it.
 */
@Entity
@Table(name = "student_counsellor_mapping",
        uniqueConstraints = @UniqueConstraint(name = "uk_scm_student", columnNames = "student_id"))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class StudentCounsellorMapping implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private UserStudent student;

    // Returned raw by /api/student-counsellor-mapping/*; keep the counsellor's payout and
    // identity details (and their whole User) out of it, as on CounsellingAppointment.
    @JsonIgnoreProperties({"bankName", "bankAccount", "bankIfsc", "bankBranch", "govtIdLast4",
            "govtIdHash", "signedAgreementUrl", "certificationsUrl", "hourlyRatePreference",
            "passwordHash", "user", "hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counsellor_id", nullable = false)
    private Counsellor counsellor;

    @JsonIncludeProperties({"id", "name"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assigned_by")
    private User assignedBy;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @JsonProperty("isActive")
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @PrePersist
    public void prePersist() {
        if (this.assignedAt == null) {
            this.assignedAt = LocalDateTime.now();
        }
        if (this.isActive == null) {
            this.isActive = true;
        }
    }

    public StudentCounsellorMapping() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UserStudent getStudent() {
        return student;
    }

    public void setStudent(UserStudent student) {
        this.student = student;
    }

    public Counsellor getCounsellor() {
        return counsellor;
    }

    public void setCounsellor(Counsellor counsellor) {
        this.counsellor = counsellor;
    }

    public User getAssignedBy() {
        return assignedBy;
    }

    public void setAssignedBy(User assignedBy) {
        this.assignedBy = assignedBy;
    }

    public LocalDateTime getAssignedAt() {
        return assignedAt;
    }

    public void setAssignedAt(LocalDateTime assignedAt) {
        this.assignedAt = assignedAt;
    }

    @JsonProperty("isActive")
    public Boolean getIsActive() {
        return isActive;
    }

    @JsonProperty("isActive")
    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
