package com.kccitm.api.model.career9;

import java.sql.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToOne;
import javax.persistence.Table;

import com.kccitm.api.model.InstituteDetail;

// import org.springframework.boot.context.properties.bind.DefaultValue;

// import net.bytebuddy.implementation.bind.annotation.Default;

@Entity
@Table(name = "assessment_table")
public class AssessmentTable implements java.io.Serializable {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String AssessmentName;

    @Column(columnDefinition = "boolean default false")
    private Boolean isActive;

    private Boolean modeofAssessment;

    private String starDate;

    private String endDate;

    @OneToOne
    @JoinColumn(name = "institute_code")
    private InstituteDetail institute;
    
    @OneToOne
    @JoinColumn(name = "tool_id")
    private Tool tool;

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
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
}