package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToMany;
import javax.persistence.OneToMany;
import javax.persistence.Table;

@Entity
@Table(name = "measured_qualities")
// @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class MeasuredQualities implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long measured_quality_id;

    private String measured_quality_name;

    private String measured_quality_description;

    private String quality_display_name;

    // 1 Measured Quality to Many Quality Types (measured quality types mapping)
    @OneToMany(cascade=CascadeType.ALL)
    @JoinColumn(name="fk_measured_qualities",referencedColumnName = "measured_quality_id")
    private List<MeasuredQualityTypes> qualityTypes;

    // Many-to-Many relationship with Tools
    @ManyToMany(mappedBy = "measuredQualities")
    private Set<Tool> tools = new HashSet<>();

    //Getters and Setters
    public Long getMeasuredQualityId() {
        return measured_quality_id;
    }

    public void setMeasuredQualityId(Long measured_quality_id) {
        this.measured_quality_id = measured_quality_id;
    }

    public String getMeasuredQualityName() {
        return measured_quality_name;
    }

    public void setMeasuredQualityName(String measured_quality_name) {
        this.measured_quality_name = measured_quality_name;
    }

    public String getMeasuredQualityDescription() {
        return measured_quality_description;
    }

    public void setMeasuredQualityDescription(String measured_quality_description) {
        this.measured_quality_description = measured_quality_description;
    }

    public String getQualityDisplayName() {
        return quality_display_name;
    }

    public void setQualityDisplayName(String quality_display_name) {
        this.quality_display_name = quality_display_name;
    }

}