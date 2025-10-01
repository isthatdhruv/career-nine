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
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "assessment_sections")
public class AssessmentSections implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assessmentSectionId;

    // private String sectionName;

    @JoinColumn(name = "section_id")
    private Long sectionId;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonBackReference("assessment-sections")
    private AssessmentTable assessmentTable;

    @OneToMany(mappedBy = "assessmentSection", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("section-questions")
    private List<AssessmentSectionQuestion> questions = new ArrayList<>();

    // getters and setters
    public Long getAssessmentSectionId() {
        return assessmentSectionId;
    }

    public void setSectionId(Long sectionId) {
        this.sectionId = sectionId;
    }

    public Long getSectionId() {
        return sectionId;
    }

   
    public AssessmentTable getAssessmentTable() {
        return assessmentTable;
    }

    public void setAssessmentTable(AssessmentTable assessmentTable) {
        this.assessmentTable = assessmentTable;
    }

    public List<AssessmentSectionQuestion> getQuestions() {
        return questions;
    }

    public void setQuestions(List<AssessmentSectionQuestion> questions) {
        this.questions = questions;
    }
}