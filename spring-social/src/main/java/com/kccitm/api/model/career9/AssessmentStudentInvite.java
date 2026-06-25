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

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * A per-student assessment invite: an admin pre-selects a specific, already
 * existing student of an institute and binds them to a mapping + a custom-priced
 * tier, minting a one-student token. The student opens the token's link, sees a
 * pre-filled registration page, pays the tier price (Razorpay) and takes the
 * assessment — reusing the existing B2B payment + entitlement + provisioning
 * pipeline (the PaymentTransaction carries the existing userStudentId, so the
 * webhook never creates a new account).
 */
@Entity
@Table(name = "assessment_student_invite")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentStudentInvite implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "invite_id")
    private Long inviteId;

    // The mapping (institute + assessment + level) this invite registers against.
    @Column(name = "mapping_id", nullable = false)
    private Long mappingId;

    // The custom-priced tier whose amount + inclusions apply for this student.
    @Column(name = "tier_id", nullable = false)
    private Long tierId;

    // The pre-selected, already-existing student.
    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    // Denormalised for convenient public lookups + admin listing.
    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "institute_code", nullable = false)
    private Integer instituteCode;

    // The per-student link token (the gate on the public endpoints).
    @Column(name = "token", nullable = false, unique = true, length = 36)
    private String token;

    // PENDING (link generated) -> PAID (student paid / provisioned) -> REVOKED.
    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    // Optional custom price (INR) this student pays for this invite — overrides the
    // selected tier's base price. NULL = charge the tier's own price. The tier still
    // supplies the inclusions (report/dashboard/counselling/LMS).
    @Column(name = "custom_amount")
    private Long customAmount;

    // Optional one-shot expiry; null = no expiry.
    @Column(name = "expires_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date expiresAt;

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
        this.updatedAt = now;
        if (this.status == null) this.status = "PENDING";
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public AssessmentStudentInvite() {
    }

    public Long getInviteId() {
        return inviteId;
    }

    public void setInviteId(Long inviteId) {
        this.inviteId = inviteId;
    }

    public Long getMappingId() {
        return mappingId;
    }

    public void setMappingId(Long mappingId) {
        this.mappingId = mappingId;
    }

    public Long getTierId() {
        return tierId;
    }

    public void setTierId(Long tierId) {
        this.tierId = tierId;
    }

    public Long getUserStudentId() {
        return userStudentId;
    }

    public void setUserStudentId(Long userStudentId) {
        this.userStudentId = userStudentId;
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

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getCustomAmount() {
        return customAmount;
    }

    public void setCustomAmount(Long customAmount) {
        this.customAmount = customAmount;
    }

    public Date getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Date expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }
}
