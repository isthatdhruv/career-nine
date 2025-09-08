package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.ManyToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "careers")
// @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Career implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long career_id;
    private String title;
    private String description;

    // Many-to-Many relationship with measured quality types
    @ManyToMany(mappedBy = "careers")
    @JsonIgnore
    private Set<MeasuredQualityTypes> measuredQualityTypes = new HashSet<>();

    // Getters and Setters
    public Long getId() {
        return career_id;
    }

    public void setId(Long career_id) {
        this.career_id = career_id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Set<MeasuredQualityTypes> getMeasuredQualityTypes() {
        return measuredQualityTypes;
    }

    public void setMeasuredQualityTypes(Set<MeasuredQualityTypes> measuredQualityTypes) {
        this.measuredQualityTypes = measuredQualityTypes;
    }

    // Helper methods for managing the many-to-many relationship
    public void addMeasuredQualityType(MeasuredQualityTypes measuredQualityType) {
        this.measuredQualityTypes.add(measuredQualityType);
        measuredQualityType.getCareers().add(this);
    }

    public void removeMeasuredQualityType(MeasuredQualityTypes measuredQualityType) {
        this.measuredQualityTypes.remove(measuredQualityType);
        measuredQualityType.getCareers().remove(this);
    }
}