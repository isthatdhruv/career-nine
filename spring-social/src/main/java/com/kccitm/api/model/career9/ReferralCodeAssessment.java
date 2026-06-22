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
 * Join row: a referral code is usable in this assessment. A code may map to many
 * assessments of its institute. Mirrors {@code PromoCodeCampaign}.
 */
@Entity
@Table(name = "referral_code_assessment",
        uniqueConstraints = @UniqueConstraint(columnNames = {"referral_code_id", "assessment_id"}))
public class ReferralCodeAssessment implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "referral_code_id", nullable = false)
    private Long referralCodeId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

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

    public ReferralCodeAssessment() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
