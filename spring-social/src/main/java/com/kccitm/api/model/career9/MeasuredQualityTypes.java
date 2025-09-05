package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.Table;

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

    @ManyToMany
    @JoinTable(
        name="measured_quality_type_career_mapping",
        joinColumns = @JoinColumn(name="measured_quality_type_id"),
        inverseJoinColumns = @JoinColumn(name="career_id")
    )
    private Set<Career> careers = new HashSet<>();

    @ManyToMany(mappedBy = "measuredQualityTypes")
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

}