package com.kccitm.api.model.career9.Questionaire;

import java.io.Serializable;
import java.math.BigDecimal;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.Tool;

@Entity
@Table(name = "Questionire")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Questionnaire implements Serializable {
    private static final long serialVersionUID = 1L;

    // Primary key: questionnaire_id
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "questionnaire_id")
    private Long questionnaireId;

    // Foreign key to tools table
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tool_id", referencedColumnName = "tool_id")
    private Tool tool;

    // Mode id
    @Column(name = "mode_id")
    private Integer modeId;

    // Price
    @Column(name = "price")
    private BigDecimal price;

    // Is free flag
    @Column(name = "is_free")
    private Boolean isFree;

    @Column(name = "is_free")
    private String name;


    public Long getQuestionnaireId() {
        return this.questionnaireId;
    }

    public void setQuestionnaireId(Long questionnaireId) {
        this.questionnaireId = questionnaireId;
    }

    public Tool getTool() {
        return this.tool;
    }

    public void setTool(Tool tool) {
        this.tool = tool;
    }

    public Integer getModeId() {
        return this.modeId;
    }

    public void setModeId(Integer modeId) {
        this.modeId = modeId;
    }

    public BigDecimal getPrice() {
        return this.price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public Boolean isIsFree() {
        return this.isFree;
    }

    public Boolean getIsFree() {
        return this.isFree;
    }

    public void setIsFree(Boolean isFree) {
        this.isFree = isFree;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }
    
}
