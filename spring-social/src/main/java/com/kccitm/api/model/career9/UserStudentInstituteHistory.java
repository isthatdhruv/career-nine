package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Many-to-many membership table between user_student and institute_detail.
 * One row per (user_student_id, institute_code) pair. The student's PRIMARY
 * institute lives on user_student.institute_id; this table tracks every
 * institute they are or have been associated with, plus per-institute drops.
 */
@Entity
@Table(name = "user_student_institute_history",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_student_id", "institute_code"}),
       indexes = {
           @Index(name = "idx_ush_user_student", columnList = "user_student_id"),
           @Index(name = "idx_ush_institute", columnList = "institute_code")
       })
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class UserStudentInstituteHistory implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "institute_code", nullable = false)
    private Integer instituteCode;

    @Column(name = "campaign_id")
    private Long campaignId;

    /** 'campaign-register-trial' | 'campaign-register' | 'entitlement-create' | 'admin-add' | 'initial' */
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    @Column(name = "added_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date addedAt;

    @Column(name = "is_dropped", nullable = false)
    private Boolean isDropped = false;

    @Column(name = "dropped_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date droppedAt;

    @Column(name = "dropped_reason", length = 255)
    private String droppedReason;

    @PrePersist
    public void prePersist() {
        if (addedAt == null) addedAt = new Date();
        if (isDropped == null) isDropped = false;
    }

    public UserStudentInstituteHistory() {}

    public UserStudentInstituteHistory(Long userStudentId, Integer instituteCode, Long campaignId, String source) {
        this.userStudentId = userStudentId;
        this.instituteCode = instituteCode;
        this.campaignId = campaignId;
        this.source = source;
    }

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer v) { this.instituteCode = v; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public String getSource() { return source; }
    public void setSource(String v) { this.source = v; }
    public Date getAddedAt() { return addedAt; }
    public void setAddedAt(Date v) { this.addedAt = v; }
    public Boolean getIsDropped() { return isDropped; }
    public void setIsDropped(Boolean v) { this.isDropped = v; }
    public Date getDroppedAt() { return droppedAt; }
    public void setDroppedAt(Date v) { this.droppedAt = v; }
    public String getDroppedReason() { return droppedReason; }
    public void setDroppedReason(String v) { this.droppedReason = v; }
}
