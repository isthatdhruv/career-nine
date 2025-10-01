package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonBackReference;

@Entity
@Table(name = "assessment_section_question")
public class AssessmentSectionQuestion implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assessmentQuestionId;

    @JoinColumn(name = "question_id")
    private Long questionId;


    @ManyToOne
    @JoinColumn(name = "section_id")
    @JsonBackReference("section-questions")
    private AssessmentSections assessmentSection;

    // getters and setters
    public Long getAssessmentQuestionId() {
        return assessmentQuestionId;
    }
    public void setAssessmentQuestionId(Long assessmentQuestionId) {
        this.assessmentQuestionId = assessmentQuestionId;
    }

    public Long getQuestionId() {
        return questionId;
    }

    public void setQuestionId(Long questionId) {
        this.questionId = questionId;
    }

    public AssessmentSections getAssessmentSection() {
        return assessmentSection;
    }

    public void setAssessmentSection(AssessmentSections assessmentSection) {
        this.assessmentSection = assessmentSection;
    }
}