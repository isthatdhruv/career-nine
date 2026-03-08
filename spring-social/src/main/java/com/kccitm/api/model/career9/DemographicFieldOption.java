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

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "demographic_field_option")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class DemographicFieldOption implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "option_id")
    private Long optionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "field_id", nullable = false)
    @JsonBackReference
    private DemographicFieldDefinition fieldDefinition;

    @Column(name = "option_value", nullable = false, length = 255)
    private String optionValue;

    @Column(name = "option_label", nullable = false, length = 255)
    private String optionLabel;

    @Column(name = "display_order", columnDefinition = "INT DEFAULT 0")
    private Integer displayOrder = 0;

    public Long getOptionId() {
        return optionId;
    }

    public void setOptionId(Long optionId) {
        this.optionId = optionId;
    }

    public DemographicFieldDefinition getFieldDefinition() {
        return fieldDefinition;
    }

    public void setFieldDefinition(DemographicFieldDefinition fieldDefinition) {
        this.fieldDefinition = fieldDefinition;
    }

    public String getOptionValue() {
        return optionValue;
    }

    public void setOptionValue(String optionValue) {
        this.optionValue = optionValue;
    }

    public String getOptionLabel() {
        return optionLabel;
    }

    public void setOptionLabel(String optionLabel) {
        this.optionLabel = optionLabel;
    }

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }
}
