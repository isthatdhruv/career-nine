package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.List;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonBackReference;

@Entity
@Table(name = "assessment_question_options")
public class AssessmentQuestionOptions implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long optionId;

    private String optionText;
    private boolean isCorrect;

    @ManyToOne
    @JoinColumn(name = "fk_assessment_questions", nullable = false)
    @JsonBackReference
    private AssessmentQuestions question;

    @OneToMany(mappedBy = "question_option")
    private List<OptionScoreBasedOnMEasuredQualityTypes> optionScores;

    // Getters and Setters
    public Long getOptionId() {
        return optionId;
    }

    public void setOptionId(Long optionId) {
        this.optionId = optionId;
    }

    public String getOptionText() {
        return optionText;
    }

    public void setOptionText(String optionText) {
        this.optionText = optionText;
    }

    public boolean isCorrect() {
        return isCorrect;
    }

    public void setCorrect(boolean isCorrect) {
        this.isCorrect = isCorrect;
    }

    public AssessmentQuestions getQuestion() {
        return question;
    }

    public void setQuestion(AssessmentQuestions question) {
        this.question = question;
    }

    public List<OptionScoreBasedOnMEasuredQualityTypes> getOptionScores() {
        return optionScores;
    }

    public void setOptionScores(List<OptionScoreBasedOnMEasuredQualityTypes> optionScores) {
        this.optionScores = optionScores;
    }
}
