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

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table
public class LanguageQuestion implements Serializable{
    private static final long serialVersionUID = 1L;
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long LanguageQuestionId;

    
    @ManyToOne
    @JoinColumn(name = "original_question_id", nullable = false)
    private AssessmentQuestions assessmentQuestion;

    
    private String QuestionText;

    @ManyToOne
    @JoinColumn(name = "language_id", nullable = false)
    // @JsonIgnore(  )
    private LanguagesSupported language;

    @OneToMany(mappedBy = "languageQuestion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LanguageOption> options = new ArrayList<>();

    //getter setters
    public AssessmentQuestions getAssessmentQuestion() {
        return assessmentQuestion;
    }
    
    public LanguagesSupported getLanguage() {
        return language;
    }

    public void setLanguage(LanguagesSupported language) {
        this.language = language;
    }

     public Long getLanguageQuestionId() {
        return LanguageQuestionId;
    }

    public void setLanguageQuestionId(Long LanguageQuestionId) {
        this.LanguageQuestionId = LanguageQuestionId;
    }


    public void setQuestionText(String QuestionText) {
        this.QuestionText = QuestionText;
    }

    public String getQuestionText() {
        return QuestionText;
    }

    public Long getOriginalQuestionId() {
        return assessmentQuestion != null ? assessmentQuestion.getQuestionId() : null;
    }
    
    public List<LanguageOption> getOptions() {
        return options;
    }
    public void setOptions(List<LanguageOption> options) {
        this.options = options;

    }
    public void setAssessmentQuestion(AssessmentQuestions assessmentQuestion) {
        this.assessmentQuestion = assessmentQuestion;
    }
    
}



