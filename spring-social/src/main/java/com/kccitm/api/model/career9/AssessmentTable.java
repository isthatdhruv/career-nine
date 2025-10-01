package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "assessment_table")
public class AssessmentTable implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assessmentId;

    private String assessmentName;

    @JoinColumn(name = "tool_id")
    private Long toolId;

    // @JoinColumn

    @OneToMany(mappedBy = "assessmentTable", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("assessment-sections")
    private List<AssessmentSections> sections = new ArrayList<>();

    // getters and setters

    public Long getToolId() {
        return toolId;
    }
    public void setToolId(Long toolId) {
        this.toolId = toolId;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public String getAssessmentName() {
        return assessmentName;
    }

    public void setAssessmentName(String assessmentName) {
        this.assessmentName = assessmentName;
    }

    public List<AssessmentSections> getSections() {
        return sections;
    }

    public void setSections(List<AssessmentSections> sections) {
        this.sections = sections;
    }
}