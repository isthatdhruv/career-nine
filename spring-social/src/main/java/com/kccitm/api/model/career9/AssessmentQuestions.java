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
    @Column(name = "questionId")
    private Long questionId;

    private String questionText;
    private String questionType;

    private Boolean flag;

    @Column(name = "is_deleted", nullable = false, columnDefinition = "TINYINT(1) DEFAULT 0")
    private Boolean isDeleted = false;

    @Column(name = "max_options_allowed")
    private int maxOptionsAllowed;

    // 1 Question to Many Options
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<AssessmentQuestionOptions> options;

    // REMOVED: Many-to-many mapping to MeasuredQualityTypes

    // Link Question -> Section
    @ManyToOne
    @JoinColumn(name = "section_id")   // FK in questions table
    @JsonIgnoreProperties("questions")
    private QuestionSection section;

    // Link Question -> Language
    @OneToMany(mappedBy = "assessmentQuestion", cascade = CascadeType.ALL)
    @JsonIgnoreProperties("assessmentQuestion")
    private List<LanguageQuestion> languageQuestions;

    // Constructor for projection
    public AssessmentQuestions(Long questionId, String questionText, String questionType) {
        this.questionId = questionId;
        this.questionText = questionText;
        this.questionType = questionType;
    }

    // Constructor for projection with section
    public AssessmentQuestions(Long questionId, String questionText, String questionType, QuestionSection section) {
        this.questionId = questionId;
        this.questionText = questionText;
        this.questionType = questionType;
        this.section = section;
    }

    public AssessmentQuestions() {
    }

    // --- getters and setters ---
    public int getMaxOptionsAllowed() {
        return maxOptionsAllowed;
    }
    public void setMaxOptionsAllowed(int maxOptionsAllowed) {
        this.maxOptionsAllowed = maxOptionsAllowed;
    }

    public Long getQuestionId() {
        return questionId;
    }

    public void setQuestionId(Long questionId) {
        this.questionId = questionId;
    }

    public String getQuestionText() {
        return questionText;
    }

    public Boolean getFlag() {
        return flag;
    }
    public void setFlag(Boolean flag) {
        this.flag = flag;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }
    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
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

    public List<LanguageQuestion> getLanguageQuestions() {
        return languageQuestions;
    }

    public void setLanguageQuestions(List<LanguageQuestion> languageQuestions) {
        this.languageQuestions = languageQuestions;
    }

    // For compatibility with frontend
    public Long getId() {
        return questionId;
    }

    public void setId(Long id) {
        this.questionId = id;
    }

    // Helper methods for managing the many-to-many relationship
    // REMOVED: add/removeMeasuredQualityType

    @Override
    public String toString() {
        return "AssessmentQuestions{" +
                "questionId=" + questionId +
                ", questionText='" + questionText + '\'' +
                ", questionType='" + questionType + '\'' +
                ", section=" + (section != null ? section.getSectionId() : null) +
                '}';
    }
}
