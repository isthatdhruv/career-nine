package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * Records that a student became the referral of a referral code. The unique
 * constraint on {@code user_student_id} enforces the product rule that a student
 * can use only ONE referral code.
 */
@Entity
@Table(name = "student_referral",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_student_id"}))
public class StudentReferral implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "referral_code_id", nullable = false)
    private Long referralCodeId;

    @Column(name = "assessment_id")
    private Long assessmentId;

    @Column(name = "institute_code")
    private Integer instituteCode;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = new Date();
        }
    }

    public StudentReferral() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserStudentId() {
        return userStudentId;
    }

    public void setUserStudentId(Long userStudentId) {
        this.userStudentId = userStudentId;
    }

    public Long getReferralCodeId() {
        return referralCodeId;
    }

    public void setReferralCodeId(Long referralCodeId) {
        this.referralCodeId = referralCodeId;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public Integer getInstituteCode() {
        return instituteCode;
    }

    public void setInstituteCode(Integer instituteCode) {
        this.instituteCode = instituteCode;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
