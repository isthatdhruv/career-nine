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
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "assessment_institute_mapping",
       uniqueConstraints = @UniqueConstraint(
           columnNames = {"assessment_id", "institute_code", "session_id", "class_id", "section_id"}
       ))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentInstituteMapping implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mapping_id")
    private Long mappingId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "institute_code", nullable = false)
    private Integer instituteCode;

    @Column(name = "mapping_level", nullable = false, length = 20)
    private String mappingLevel;

    @Column(name = "session_id")
    private Integer sessionId;

    @Column(name = "class_id")
    private Integer classId;

    @Column(name = "section_id")
    private Integer sectionId;

    // Legacy single registration token. Retained for backward compatibility with
    // already-distributed pre-redesign links; new rows set it = paidToken.
    @Column(name = "token", nullable = false, unique = true, length = 36)
    private String token;

    // ── Dual links (redesign) ─────────────────────────────────────────────────
    // Every mapping exposes TWO registration links: a paid link (priced via the
    // wave tiers) and an always-free link (backed by the is_free tier). Each has
    // its own token and its own active toggle.
    @Column(name = "paid_token", unique = true, length = 36)
    private String paidToken;

    @Column(name = "free_token", unique = true, length = 36)
    private String freeToken;

    @Column(name = "paid_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean paidActive = true;

    @Column(name = "free_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean freeActive = true;

    // Idempotency marker for the one-time school-flow backfill: set to the source
    // school_assessment_config.config_id when this CLASS-level mapping was created
    // by migration, so the backfill never duplicates a config.
    @Column(name = "migrated_from_school_config_id")
    private Long migratedFromSchoolConfigId;

    // Legacy single price. Deprecated by the redesign — every link is now
    // tier-backed (free tier / paid waves). Kept only for old rows.
    @Column(name = "amount")
    private Long amount;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = new Date();
        }
        if (this.isActive == null) {
            this.isActive = true;
        }
        if (this.paidActive == null) {
            this.paidActive = true;
        }
        if (this.freeActive == null) {
            this.freeActive = true;
        }
    }

    public AssessmentInstituteMapping() {
    }

    public Long getMappingId() {
        return mappingId;
    }

    public void setMappingId(Long mappingId) {
        this.mappingId = mappingId;
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

    public String getMappingLevel() {
        return mappingLevel;
    }

    public void setMappingLevel(String mappingLevel) {
        this.mappingLevel = mappingLevel;
    }

    public Integer getSessionId() {
        return sessionId;
    }

    public void setSessionId(Integer sessionId) {
        this.sessionId = sessionId;
    }

    public Integer getClassId() {
        return classId;
    }

    public void setClassId(Integer classId) {
        this.classId = classId;
    }

    public Integer getSectionId() {
        return sectionId;
    }

    public void setSectionId(Integer sectionId) {
        this.sectionId = sectionId;
    }

    public Long getAmount() {
        return amount;
    }

    public void setAmount(Long amount) {
        this.amount = amount;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getPaidToken() {
        return paidToken;
    }

    public void setPaidToken(String paidToken) {
        this.paidToken = paidToken;
    }

    public String getFreeToken() {
        return freeToken;
    }

    public void setFreeToken(String freeToken) {
        this.freeToken = freeToken;
    }

    public Boolean getPaidActive() {
        return paidActive;
    }

    public void setPaidActive(Boolean paidActive) {
        this.paidActive = paidActive;
    }

    public Boolean getFreeActive() {
        return freeActive;
    }

    public void setFreeActive(Boolean freeActive) {
        this.freeActive = freeActive;
    }

    public Long getMigratedFromSchoolConfigId() {
        return migratedFromSchoolConfigId;
    }

    public void setMigratedFromSchoolConfigId(Long migratedFromSchoolConfigId) {
        this.migratedFromSchoolConfigId = migratedFromSchoolConfigId;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
