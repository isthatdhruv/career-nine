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
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

@Entity
@Table(name = "assessment_questions")
public class AssessmentQuestions implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long question_id;

    private String questionText;
    private String questionType;

    // 1 Question to Many Options
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssessmentQuestionOptions> options;

    @ManyToMany
    @JoinTable(
        name = "assessment_question_measured_quality_type_mapping",
        joinColumns = @JoinColumn(name = "question_id"),
        inverseJoinColumns = @JoinColumn(name = "measured_quality_type_id")
    )
    private Set<MeasuredQualityTypes> measuredQualityTypes = new HashSet<>();

    // NEW: Link Question -> Section
    @ManyToOne
    @JoinColumn(name = "section_id")   // FK in questions table
    private QuestionSection section;

    // --- getters and setters ---
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

    public Set<MeasuredQualityTypes> getMeasuredQualityTypes() {
        return measuredQualityTypes;
    }

    public void setMeasuredQualityTypes(Set<MeasuredQualityTypes> measuredQualityTypes) {
        this.measuredQualityTypes = measuredQualityTypes;
    }

    public QuestionSection getSection() {
        return section;
    }

    public void setSection(QuestionSection section) {
        this.section = section;
    }

    public void setId(Long id) {
        throw new UnsupportedOperationException("Unimplemented method 'setId'");
    }
}
