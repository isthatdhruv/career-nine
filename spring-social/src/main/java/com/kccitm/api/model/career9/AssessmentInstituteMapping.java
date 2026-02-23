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

    @Column(name = "token", nullable = false, unique = true, length = 36)
    private String token;

    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
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

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
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
