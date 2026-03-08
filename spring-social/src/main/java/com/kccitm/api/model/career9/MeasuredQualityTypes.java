package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

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

    // Many-to-One relationship with MeasuredQualities
    @ManyToOne
    @JoinColumn(name = "fk_measured_qualities")
    @JsonIgnoreProperties({"qualityTypes", "tools"})
    private MeasuredQualities measuredQuality;

    @ManyToMany
    @JoinTable(
        name="measured_quality_type_career_mapping",
        joinColumns = @JoinColumn(name="measured_quality_type_id"),
        inverseJoinColumns = @JoinColumn(name="career_id")
    )
    @JsonIgnore
    private Set<Career> careers = new HashSet<>();

    @OneToMany(mappedBy = "measuredQualityType")
    // @JsonIgnoreProperties({"question_option", "measuredQualityType"})
    @JsonIgnore
    private List<OptionScoreBasedOnMEasuredQualityTypes> optionScores;

    // REMOVED: Many-to-many mapping to AssessmentQuestions
public MeasuredQualityTypes(Long measuredQualityTypeId) {
        this.measured_quality_type_id = measuredQualityTypeId;
    }
public MeasuredQualityTypes() {
    
    super();
}

    MeasuredQualityTypes(Long measuredQualityTypeId, String measuredQualityTypeName, String measuredQualityTypeDescription, String measuredQualityTypeDisplayName) {
        this.measured_quality_type_id = measuredQualityTypeId;
        this.measured_quality_type_name = measuredQualityTypeName;
        this.measured_quality_type_description = measuredQualityTypeDescription;    
        this.measured_quality_type_display_name = measuredQualityTypeDisplayName;
        throw new UnsupportedOperationException("Not supported yet.");
    }
    // Getters and Setters
    public List<OptionScoreBasedOnMEasuredQualityTypes> getOptionScores() {
        return optionScores;
    }
    public void setOptionScores(List<OptionScoreBasedOnMEasuredQualityTypes> optionScores) {
        this.optionScores = optionScores;
    }

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

    // REMOVED: get/setAssessmentQuestions

    public MeasuredQualities getMeasuredQuality() {
        return measuredQuality;
    }

    public void setMeasuredQuality(MeasuredQualities measuredQuality) {
        this.measuredQuality = measuredQuality;
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

    // REMOVED: add/removeAssessmentQuestion

}