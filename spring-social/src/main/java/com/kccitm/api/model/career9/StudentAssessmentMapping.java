package com.kccitm.api.model.career9;

import java.io.Serializable;

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

@Entity
@Table(name = "student_assessment_mapping", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_student_id", "assessment_id"}))
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentAssessmentMapping implements Serializable {
    private static final long serialVersionUID = 1L;

    // Primary Key
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "student_assessment_id")
    private Long studentAssessmentId;

    @Column(name = "status", columnDefinition = "varchar(20) default 'notstarted'")
    private String status;

    // Student Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_student_id", referencedColumnName = "user_student_id", nullable = false)
    private UserStudent userStudent;

    // Assessment ID
    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "feedback_rating")
    private Integer feedbackRating;

    /**
     * How many times this student-assessment mapping has been reset.
     * Incremented inside the reset flow; checked against
     * AssessmentTable.maxResetsPerStudent before allowing a new reset.
     */
    @Column(name = "reset_count", columnDefinition = "INT DEFAULT 0")
    private Integer resetCount = 0;

    @PrePersist
    public void prePersist() {
        if (this.status == null) {
            this.status = "notstarted";
        }
        if (this.resetCount == null) {
            this.resetCount = 0;
        }
    }

    public StudentAssessmentMapping(Long userStudent, Long assessmentId) {
        this.userStudent = new UserStudent(userStudent);
        this.assessmentId = assessmentId;
    }

    public StudentAssessmentMapping() {
    }

    public Long getStudentAssessmentId() {
        return studentAssessmentId;
    }

    public void setStudentAssessmentId(Long studentAssessmentId) {
        this.studentAssessmentId = studentAssessmentId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UserStudent getUserStudent() {
        return userStudent;
    }

    public void setUserStudent(UserStudent userStudent) {
        this.userStudent = userStudent;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public Integer getFeedbackRating() {
        return feedbackRating;
    }

    public void setFeedbackRating(Integer feedbackRating) {
        this.feedbackRating = feedbackRating;
    }

    public Integer getResetCount() {
        return resetCount == null ? 0 : resetCount;
    }

    public void setResetCount(Integer resetCount) {
        this.resetCount = resetCount;
    }

    // public String getStatus() {
    // return status;
    // }

    // public void setStatus(String status) {
    // this.status = status;
    // }
}
