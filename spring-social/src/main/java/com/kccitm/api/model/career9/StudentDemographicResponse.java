package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

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
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "student_demographic_response",
       uniqueConstraints = @UniqueConstraint(
           columnNames = {"user_student_id", "assessment_id", "field_id"}))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class StudentDemographicResponse implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "response_id")
    private Long responseId;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "field_id", referencedColumnName = "field_id", nullable = false)
    private DemographicFieldDefinition fieldDefinition;

    @Column(name = "response_value", columnDefinition = "TEXT")
    private String responseValue;

    @Column(name = "submitted_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date submittedAt;

    @PrePersist
    public void prePersist() {
        if (this.submittedAt == null) this.submittedAt = new Date();
    }

    public Long getResponseId() {
        return responseId;
    }

    public void setResponseId(Long responseId) {
        this.responseId = responseId;
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

    public DemographicFieldDefinition getFieldDefinition() {
        return fieldDefinition;
    }

    public void setFieldDefinition(DemographicFieldDefinition fieldDefinition) {
        this.fieldDefinition = fieldDefinition;
    }

    public String getResponseValue() {
        return responseValue;
    }

    public void setResponseValue(String responseValue) {
        this.responseValue = responseValue;
    }

    public Date getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Date submittedAt) {
        this.submittedAt = submittedAt;
    }
}
