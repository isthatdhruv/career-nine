package com.kccitm.api.model.career9.Questionaire;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
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
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "tool_id", referencedColumnName = "tool_id")
    private Tool tool;

    // List of languages supported by this questionnaire
    @OneToMany(mappedBy = "questionnaire", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("questionnaire")
    private List<QuestionnaireLanguage> languages;

    @OneToMany(mappedBy = "questionnaire", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("questionnaire")
    private List<QuestionnaireSection> section;

    @Column(name = "type", nullable = true)
    private Boolean type;

    public Boolean getType() {
        return type;
    }

    public void setType(Boolean type) {
        this.type = type;
    }

    // Mode id
    @Column(name = "mode_id")
    private Integer modeId;

    // Price
    @Column(name = "price")
    private BigDecimal price;

    // Is free flag
    @Column(name = "is_free")
    private Boolean isFree;

    @Column(name = "name")
    private String name;

    @Column(name = "display")
    private Boolean display;

    public Questionnaire() {
    }

    public Questionnaire(Long questionnaireId, Tool tool, List<QuestionnaireLanguage> languages,
            List<QuestionnaireSection> section, Integer modeId, BigDecimal price, Boolean isFree, String name,
            Boolean display) {
        this.questionnaireId = questionnaireId;
        this.tool = tool;
        this.languages = languages;
        this.section = section;
        this.modeId = modeId;
        this.price = price;
        this.isFree = isFree;
        this.name = name;
        this.display = display;
    }

    public Questionnaire(Long questionnaireId, String name, Integer modeId) {
        this.questionnaireId = questionnaireId;
        this.modeId = modeId;
        this.name = name;
    }

    // Constructor for list projection with type and isFree
    public Questionnaire(Long questionnaireId, String name, Integer modeId, Boolean type, Boolean isFree) {
        this.questionnaireId = questionnaireId;
        this.name = name;
        this.modeId = modeId;
        this.type = type;
        this.isFree = isFree;
    }

    public Questionnaire(Long questionnaireId) {
        this.questionnaireId = questionnaireId;
    }

    public Boolean getDisplay() {
        return display;
    }

    public boolean isDisplay() {
        return display != null && display;
    }

    public void setDisplay(Boolean display) {
        this.display = display;
    }

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

    public List<QuestionnaireLanguage> getLanguages() {
        return this.languages;
    }

    public void setLanguages(List<QuestionnaireLanguage> languages) {
        this.languages = languages;
    }

    public List<QuestionnaireSection> getSections() {
        return this.section;
    }

    public void setSections(List<QuestionnaireSection> section) {
        this.section = section;
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
