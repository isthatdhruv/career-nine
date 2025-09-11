package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "assessment_questions")
public class AssessmentQuestions implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long question_id;

    private String questionText;
    private String questionType;

    @Column(name = "max_options_allowed")
    private int maxOptionsAllowed;

    // 1 Question to Many Options
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<AssessmentQuestionOptions> options;

    // REMOVED: Many-to-many mapping to MeasuredQualityTypes

    // NEW: Link Question -> Section
    @ManyToOne
    @JoinColumn(name = "section_id")   // FK in questions table
    @JsonIgnoreProperties("questions")
    private QuestionSection section;

    // --- getters and setters ---
    public int getmaxOptionsAllowed() {
        return maxOptionsAllowed;
    }
    public void setmaxAllowedOptions(int maxAllowedOptions) {
        this.maxOptionsAllowed = maxOptionsAllowed;
    }

    public Long getQuestionId() {
        return question_id;
    }

    public void setQuestionId(Long question_id) {
        this.question_id = question_id;
    }

    public String getQuestionText() {
        return questionText;
    }

    public void setQuestionText(String questionText) {
        this.questionText = questionText;
    }

    public String getQuestionType() {
        return questionType;
    }

    public void setQuestionType(String questionType) {
        this.questionType = questionType;
    }

    public List<AssessmentQuestionOptions> getOptions() {
        return options;
    }

    public void setOptions(List<AssessmentQuestionOptions> options) {
        this.options = options;
    }

    // REMOVED: get/setMeasuredQualityTypes

    public QuestionSection getSection() {
        return section;
    }

    public void setSection(QuestionSection section) {
        this.section = section;
    }

    // For compatibility with frontend
    public Long getId() {
        return question_id;
    }

    public void setId(Long id) {
        this.question_id = id;
    }

    // Helper methods for managing the many-to-many relationship
    // REMOVED: add/removeMeasuredQualityType

    @Override
    public String toString() {
        return "AssessmentQuestions{" +
                "question_id=" + question_id +
                ", questionText='" + questionText + '\'' +
                ", questionType='" + questionType + '\'' +
                ", section=" + (section != null ? section.getSectionId() : null) +
                '}';
    }
}
