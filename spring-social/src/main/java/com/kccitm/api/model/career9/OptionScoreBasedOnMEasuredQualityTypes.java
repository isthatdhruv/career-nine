package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Index;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "score_based_on_measured_quality_types",
       indexes = {
           @Index(name = "idx_score_option", columnList = "fk_assessment_questions_option"),
           @Index(name = "idx_score_quality_type", columnList = "fk_quality_type")
       })
public class OptionScoreBasedOnMEasuredQualityTypes implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("scoreId")
    private Long scoreId;

    private Integer score;

    @ManyToOne
    @JoinColumn(name = "fk_assessment_questions_option")
    @JsonBackReference
    private AssessmentQuestionOptions question_option;

    @ManyToOne
    @JoinColumn(name = "fk_quality_type")
    private MeasuredQualityTypes measuredQualityType;

    //getters and setters
    public Long getScoreId() {
        return scoreId;
    }
    public void setScoreId(Long scoreId) {
        this.scoreId = scoreId;
    }
    public Integer getScore() {
        return score;
    }
    public void setScore(Integer score) {
        this.score = score;
    }
    public AssessmentQuestionOptions getQuestion_option() {
        return question_option;
    }
    public void setQuestion_option(AssessmentQuestionOptions question_option) {
        this.question_option = question_option;
    }
    
    public MeasuredQualityTypes getMeasuredQualityType() {
        return measuredQualityType;
    }
    public void setMeasuredQualityType(MeasuredQualityTypes measuredQualityType) {
        this.measuredQualityType = measuredQualityType;
    }
   
    
    
}
