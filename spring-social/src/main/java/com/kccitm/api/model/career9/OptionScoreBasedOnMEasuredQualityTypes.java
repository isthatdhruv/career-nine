package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "score_based_on_measured_quality_types", 
       uniqueConstraints = @UniqueConstraint(
           columnNames = {"fk_option_id", "fk_measured_quality_type_id"},
           name = "uk_option_quality_type"
       ))
public class OptionScoreBasedOnMEasuredQualityTypes implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("scoreId")
    private Long scoreId;

    private Integer score;

    @ManyToOne
    @JoinColumn(name = "fk_option_id")
    @JsonIgnoreProperties("optionScores")
    private AssessmentQuestionOptions question_option;

    @ManyToOne
    @JoinColumn(name = "fk_measured_quality_type_id")
    @JsonIgnoreProperties("optionScores")
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
