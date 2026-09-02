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
@Table(name = "school_assessment_config",
       uniqueConstraints = @UniqueConstraint(
           columnNames = {"institute_code", "session_id", "class_id"}
       ))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SchoolAssessmentConfig implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "config_id")
    private Long configId;

    @Column(name = "institute_code", nullable = false)
    private Integer instituteCode;

    @Column(name = "session_id", nullable = false)
    private Integer sessionId;

    @Column(name = "class_id", nullable = false)
    private Integer classId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "amount")
    private Long amount;

    @Column(name = "is_active")
    private Boolean isActive = true;

    // True when this class's cohort is 18+: the school registration page shows adult
    // self-consent wording and "Your Email/Phone" instead of the parental copy.
    // NULL/FALSE keeps the existing minor flow.
    @Column(name = "audience_18_plus", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean audience18Plus = false;

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
        if (this.audience18Plus == null) {
            this.audience18Plus = false;
        }
    }

    public SchoolAssessmentConfig() {}

    public Long getConfigId() { return configId; }
    public void setConfigId(Long configId) { this.configId = configId; }

    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }

    public Integer getSessionId() { return sessionId; }
    public void setSessionId(Integer sessionId) { this.sessionId = sessionId; }

    public Integer getClassId() { return classId; }
    public void setClassId(Integer classId) { this.classId = classId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Boolean getAudience18Plus() { return audience18Plus; }
    public void setAudience18Plus(Boolean audience18Plus) { this.audience18Plus = audience18Plus; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
}
