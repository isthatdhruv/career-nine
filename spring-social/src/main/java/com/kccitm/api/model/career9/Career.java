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
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "careers")
// @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Career implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("career_id")
    private Long career_id;

    private String title;

    private String description;

    private String personalityCode1;  // RIASEC code e.g. "R", "I", "A", "S", "E", "C"
    private String personalityCode2;
    private String personalityCode3;

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

    public String getPersonalityCode1() { return personalityCode1; }
    public void setPersonalityCode1(String personalityCode1) { this.personalityCode1 = personalityCode1; }

    public String getPersonalityCode2() { return personalityCode2; }
    public void setPersonalityCode2(String personalityCode2) { this.personalityCode2 = personalityCode2; }

    public String getPersonalityCode3() { return personalityCode3; }
    public void setPersonalityCode3(String personalityCode3) { this.personalityCode3 = personalityCode3; }

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