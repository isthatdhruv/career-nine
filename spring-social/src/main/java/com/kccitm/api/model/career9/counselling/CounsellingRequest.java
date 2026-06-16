package com.kccitm.api.model.career9.counselling;

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
 * A student's interest in career counselling for an assessment that currently has
 * NO counsellor assigned. Raised from the assessment thank-you page when the
 * student's package included counselling but the admin hasn't mapped a counsellor
 * yet, so the request is "forwarded to Career-9" for an admin to action (assign a
 * counsellor on the Counsellor ↔ Assessment page).
 *
 * <p>Status lifecycle: PENDING (waiting on assignment) → ASSIGNED (a counsellor is
 * now mapped to the assessment, so the student can book) / CLOSED (dismissed).
 * Kept idempotent by the controller: at most one PENDING row per (student,
 * assessment).
 */
@Entity
@Table(name = "counselling_request")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellingRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    /** Snapshot for the admin list / filtering; nullable for legacy/unallotted students. */
    @Column(name = "institute_code")
    private Integer instituteCode;

    /** PENDING | ASSIGNED | CLOSED */
    @Column(name = "status", length = 20)
    private String status = "PENDING";

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
        if (status == null) status = "PENDING";
    }

    @PreUpdate
    public void preUpdate() { updatedAt = new Date(); }

    public CounsellingRequest() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }
    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer v) { this.instituteCode = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date v) { this.updatedAt = v; }
}
