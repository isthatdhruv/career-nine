package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "assessment_demographic_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"assessment_id", "field_id"}))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentDemographicMapping implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mapping_id")
    private Long mappingId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "field_id", referencedColumnName = "field_id", nullable = false)
    private DemographicFieldDefinition fieldDefinition;

    @Column(name = "is_mandatory", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isMandatory = true;

    @Column(name = "display_order", columnDefinition = "INT DEFAULT 0")
    private Integer displayOrder = 0;

    @Column(name = "custom_label", length = 255)
    private String customLabel;

    public Long getMappingId() {
        return mappingId;
    }

    public void setMappingId(Long mappingId) {
        this.mappingId = mappingId;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public DemographicFieldDefinition getFieldDefinition() {
        return fieldDefinition;
    }

    public void setFieldDefinition(DemographicFieldDefinition fieldDefinition) {
        this.fieldDefinition = fieldDefinition;
    }

    public Boolean getIsMandatory() {
        return isMandatory;
    }

    public void setIsMandatory(Boolean isMandatory) {
        this.isMandatory = isMandatory;
    }

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public String getCustomLabel() {
        return customLabel;
    }

    public void setCustomLabel(String customLabel) {
        this.customLabel = customLabel;
    }
}
