package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

@Entity
@Table
public class LanguageOption implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long LanguageOptionId;

    // private Long languageId;

    // private Long opti_id;

    private String LanguageoptionText;
    @ManyToOne
    @JoinColumn(name = "language_id", nullable = false)
    private LanguagesSupported language;

    @ManyToOne
    @JoinColumn(name = "language_question_id", nullable = false)
    private LanguageQuestion languageQuestion;

    @ManyToOne
    @JoinColumn(name = "assessment_option_id", nullable = false)
    private AssessmentQuestionOptions assessmentOption;

    // getter setters
    public LanguagesSupported getLanguage() {
        return language;
    }
    public void setLanguage(LanguagesSupported language) {
        this.language = language;
    }
    public Long getLanguageOptionId() {
        return LanguageOptionId;
    }

    public void setLanguageOptionId(Long LanguageOption_id) {
        this.LanguageOptionId = LanguageOption_id;
    }

    public String getLanguageOptionText() {
        return LanguageoptionText;
    }

    public void setLanguageOptionText(String opti_text) {
        this.LanguageoptionText = opti_text;
    }

    public LanguageQuestion getLanguageQuestion() {
        return languageQuestion;
    }
    public void setLanguageQuestion(LanguageQuestion languageQuestion) {
        this.languageQuestion = languageQuestion;
    }

    public AssessmentQuestionOptions getAssessmentOption() {
        return assessmentOption;
    }
    public void setAssessmentQuestionOption(AssessmentQuestionOptions assessmentOption) {
        this.assessmentOption = assessmentOption;
    }
}
