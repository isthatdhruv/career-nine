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
import javax.persistence.Index;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "assessment_raw_score",
       indexes = {
           @Index(name = "idx_raw_score_mapping", columnList = "student_assessment_id"),
           @Index(name = "idx_raw_score_mqt", columnList = "measured_quality_type_id")
       })
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentRawScore implements Serializable {

    private static final long serialVersionUID = 1L;

    // Primary key
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_raw_score_id")
    private Long assessmentRawScoreId;

    // Student Assessment Mapping Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_assessment_id", referencedColumnName = "student_assessment_id")
    private StudentAssessmentMapping studentAssessmentMapping;

    // Measured Quality Type Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "measured_quality_type_id", referencedColumnName = "measured_quality_type_id")
    private MeasuredQualityTypes measuredQualityType;

    //Measured Quality Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "measured_quality_id", referencedColumnName = "measured_quality_id")
    private MeasuredQualities measuredQuality;

    // Raw Score
    @Column(name = "raw_score", nullable = false)
    private Integer rawScore;

    // Getters and Setters
    public Long getAssessmentRawScoreId() {
        return assessmentRawScoreId;
    }
    public void setAssessmentRawScoreId(Long assessmentRawScoreId) {
        this.assessmentRawScoreId = assessmentRawScoreId;
    }
    public StudentAssessmentMapping getStudentAssessmentMapping() {
        return studentAssessmentMapping;
    }
    public void setStudentAssessmentMapping(StudentAssessmentMapping studentAssessmentMapping) {
        this.studentAssessmentMapping = studentAssessmentMapping;
    }
    public MeasuredQualityTypes getMeasuredQualityType() {
        return measuredQualityType;
    }
    public void setMeasuredQualityType(MeasuredQualityTypes measuredQualityType) {
        this.measuredQualityType = measuredQualityType;
    }
    public MeasuredQualities getMeasuredQuality() {
        return measuredQuality;
    }
    public void setMeasuredQuality(MeasuredQualities measuredQuality) {
        this.measuredQuality = measuredQuality;
    }
    public Integer getRawScore() {
        return rawScore;    
    }
    public void setRawScore(Integer rawScore) {
        this.rawScore = rawScore;
    }
}
