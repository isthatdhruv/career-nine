package com.kccitm.api.model.career9;

<<<<<<< HEAD
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import javax.persistence.CascadeType;
=======
import java.sql.Date;

import javax.persistence.Column;
>>>>>>> 047e941 (created assessment entity and frontend fixes)
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
<<<<<<< HEAD
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "assessment_table")
public class AssessmentTable implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assessmentId;

    private String assessmentName;

    @JoinColumn(name = "tool_id")
    private Long toolId;

    // @JoinColumn

    @OneToMany(mappedBy = "assessmentTable", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("assessment-sections")
    private List<AssessmentSections> sections = new ArrayList<>();

    // getters and setters

    public Long getToolId() {
        return toolId;
    }
    public void setToolId(Long toolId) {
        this.toolId = toolId;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public String getAssessmentName() {
        return assessmentName;
    }

    public void setAssessmentName(String assessmentName) {
        this.assessmentName = assessmentName;
    }

    public List<AssessmentSections> getSections() {
        return sections;
    }

    public void setSections(List<AssessmentSections> sections) {
        this.sections = sections;
=======
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
>>>>>>> 047e941 (created assessment entity and frontend fixes)
    }
}