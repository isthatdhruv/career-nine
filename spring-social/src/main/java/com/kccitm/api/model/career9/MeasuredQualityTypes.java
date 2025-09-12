package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "measured_quality_types")
// @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class MeasuredQualityTypes implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long measured_quality_type_id;

    private String measured_quality_type_name;

    private String measured_quality_type_description;

    private String measured_quality_type_display_name;

    // Foreign key for one-to-many relationship with MeasuredQualities
    @Column(name = "fk_measured_qualities")
    private Long fk_measured_qualities;

    @ManyToMany
    @JoinTable(
        name="measured_quality_type_career_mapping",
        joinColumns = @JoinColumn(name="measured_quality_type_id"),
        inverseJoinColumns = @JoinColumn(name="career_id")
    )
    private Set<Career> careers = new HashSet<>();

    @ManyToMany(mappedBy = "measuredQualityTypes")
    @JsonIgnore
    private Set<AssessmentQuestions> assessmentQuestions = new HashSet<>();

    // Getters and Setters
    public Long getMeasuredQualityTypeId() {
        return measured_quality_type_id;
    }

    public void setMeasuredQualityTypeId(Long measured_quality_type_id) {
        this.measured_quality_type_id = measured_quality_type_id;
    }

    public String getMeasuredQualityTypeName() {
        return measured_quality_type_name;
    }

    public void setMeasuredQualityTypeName(String measured_quality_type_name) {
        this.measured_quality_type_name = measured_quality_type_name;
    }

    public String getMeasuredQualityTypeDescription() {
        return measured_quality_type_description;
    }

    public void setMeasuredQualityTypeDescription(String measured_quality_type_description) {
        this.measured_quality_type_description = measured_quality_type_description;
    }

    public String getMeasuredQualityTypeDisplayName() {
        return measured_quality_type_display_name;
    }

    public void setMeasuredQualityTypeDisplayName(String measured_quality_type_display_name) {
        this.measured_quality_type_display_name = measured_quality_type_display_name;
    }

    public Set<Career> getCareers() {
        return careers;
    }

    public void setCareers(Set<Career> careers) {
        this.careers = careers;
    }

    public Set<AssessmentQuestions> getAssessmentQuestions() {
        return assessmentQuestions;
    }

    public void setAssessmentQuestions(Set<AssessmentQuestions> assessmentQuestions) {
        this.assessmentQuestions = assessmentQuestions;
    }

    public Long getFk_measured_qualities() {
        return fk_measured_qualities;
    }

    public void setFk_measured_qualities(Long fk_measured_qualities) {
        this.fk_measured_qualities = fk_measured_qualities;
    }

    // Helper methods for managing the many-to-many relationships
    public void addCareer(Career career) {
        this.careers.add(career);
        career.getMeasuredQualityTypes().add(this);
    }

    public void removeCareer(Career career) {
        this.careers.remove(career);
        career.getMeasuredQualityTypes().remove(this);
    }

    public void addAssessmentQuestion(AssessmentQuestions assessmentQuestion) {
        this.assessmentQuestions.add(assessmentQuestion);
        assessmentQuestion.getMeasuredQualityTypes().add(this);
    }

    public void removeAssessmentQuestion(AssessmentQuestions assessmentQuestion) {
        this.assessmentQuestions.remove(assessmentQuestion);
        assessmentQuestion.getMeasuredQualityTypes().remove(this);
    }

}