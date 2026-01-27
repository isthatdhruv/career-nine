package com.kccitm.api.model.career9;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToOne;
import javax.persistence.Table;

import com.kccitm.api.model.career9.Questionaire.Questionnaire;

// import org.springframework.boot.context.properties.bind.DefaultValue;

// import net.bytebuddy.implementation.bind.annotation.Default;

@Entity
@Table(name = "assessment_table")
public class AssessmentTable implements java.io.Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_id")
    private Long id;

    private String AssessmentName;

    @Column(name = "is_active")
    private Boolean isActive;

    private Boolean modeofAssessment;

    private String starDate;

    private String endDate;

    @JoinColumn(name = "questionnaire_id")
    @OneToOne(fetch = javax.persistence.FetchType.LAZY, optional = true)
    @org.hibernate.annotations.NotFound(action = org.hibernate.annotations.NotFoundAction.IGNORE)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Questionnaire questionnaire;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AssessmentTable(String AssessmentName,  String starDate ) {
        this.starDate = starDate;
        this.AssessmentName= AssessmentName;
      
    }

    public AssessmentTable(){
    }
    public String getAssessmentName() {
        return AssessmentName;
    }

    public void setAssessmentName(String assessmentName) {
        this.AssessmentName = assessmentName;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Boolean getModeofAssessment() {
        return modeofAssessment;
    }

    public void setModeofAssessment(Boolean modeofAssessment) {
        this.modeofAssessment = modeofAssessment;
    }

    public String getStarDate() {
        return starDate;
    }

    public void setStarDate(String starDate) {
        this.starDate = starDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public void setEndDate(String endDate) {
        this.endDate = endDate;
    }

    public Questionnaire getQuestionnaire() {
        return questionnaire;
    }

    public void setQuestionnaire(Questionnaire questionnaire) {
        this.questionnaire = questionnaire;
    }
}