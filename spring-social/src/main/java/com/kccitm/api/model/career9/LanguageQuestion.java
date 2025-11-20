package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
import com.fasterxml.jackson.annotation.JsonSetter;

@Entity
@Table
public class LanguageQuestion implements Serializable {
    private static final long serialVersionUID = 1L;
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long LanguageQuestionId;

    @ManyToOne
    @JoinColumn(name = "original_question_id", nullable = false)
    @JsonIgnore
    private AssessmentQuestions assessmentQuestion;

    private String QuestionText;

    @ManyToOne
    @JoinColumn(name = "language_id", nullable = false)
    private LanguagesSupported language;

    @OneToMany(mappedBy = "languageQuestion", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<LanguageOption> options = new ArrayList<>();

    // Custom setter for JSON deserialization
    @JsonSetter("assessmentQuestion")
    public void setAssessmentQuestionFromJson(java.util.Map<String, Object> assessmentQuestionJson) {
        if (assessmentQuestionJson != null && assessmentQuestionJson.containsKey("questionId")) {
            AssessmentQuestions aq = new AssessmentQuestions();
            aq.setQuestionId(((Number) assessmentQuestionJson.get("questionId")).longValue());
            this.assessmentQuestion = aq;
        }
    }

    // Custom setter for JSON deserialization
    @JsonSetter("language")
    public void setLanguageFromJson(java.util.Map<String, Object> languageJson) {
        if (languageJson != null && languageJson.containsKey("languageId")) {
            LanguagesSupported lang = new LanguagesSupported();
            lang.setLanguageId(((Number) languageJson.get("languageId")).longValue());
            this.language = lang;
        }
    }

    // Custom setter for options JSON deserialization
    @JsonSetter("options")
    public void setOptionsFromJson(List<Map<String, Object>> optionsJson) {
        if (optionsJson != null) {
            this.options = new ArrayList<>();
            for (Map<String, Object> optionJson : optionsJson) {
                LanguageOption option = new LanguageOption();
                
                // Set option text
                if (optionJson.containsKey("optionText")) {
                    option.setLanguageOptionText((String) optionJson.get("optionText"));
                }
                
                // Set assessment option
                if (optionJson.containsKey("assessmentOption")) {
                    Map<String, Object> assessmentOptionJson = (Map<String, Object>) optionJson.get("assessmentOption");
                    if (assessmentOptionJson != null && assessmentOptionJson.containsKey("optionId")) {
                        AssessmentQuestionOptions assessmentOption = new AssessmentQuestionOptions();
                        assessmentOption.setOptionId(((Number) assessmentOptionJson.get("optionId")).longValue());
                        option.setAssessmentQuestionOption(assessmentOption);
                    }
                }
                
                // Set bidirectional relationships
                option.setLanguageQuestion(this);
                option.setLanguage(this.language);
                
                this.options.add(option);
            }
        }
    }

    // Regular getters and setters
    public AssessmentQuestions getAssessmentQuestion() {
        return assessmentQuestion;
    }

    public void setAssessmentQuestion(AssessmentQuestions assessmentQuestion) {
        this.assessmentQuestion = assessmentQuestion;
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
}
