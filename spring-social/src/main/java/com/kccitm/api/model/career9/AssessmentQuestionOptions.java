package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Base64;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.OneToOne;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "assessment_question_options")
public class AssessmentQuestionOptions implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long optionId;

    private String optionText;

    private boolean isCorrect;

    private String optionDescription;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "fk_assessment_questions")
    @JsonBackReference
    private AssessmentQuestions question;

    @OneToMany(mappedBy = "question_option", cascade = CascadeType.ALL)
    private List<OptionScoreBasedOnMEasuredQualityTypes> optionScores;

    @Lob
    @Column(name = "option_image", columnDefinition = "LONGBLOB")
    @JsonIgnore
    private byte[] optionImage;

    @Column(name = "is_game", nullable = false)
    private Boolean isGame;

    @OneToOne
    @JoinColumn(name = "fk_game_table", nullable = true)
    private GameTable game;

    public AssessmentQuestionOptions(Long optionId) {
        this.optionId = optionId;
    }

    public AssessmentQuestionOptions() {
        super();
    }

    
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

    // Raw byte[] getter/setter (internal use)
    @JsonIgnore
    public byte[] getOptionImage() {
        return optionImage;
    }

    @JsonIgnore
    public void setOptionImage(byte[] optionImage) {
        this.optionImage = optionImage;
    }

    // Base64 getter for JSON serialization - returns image as Base64 string
    @JsonProperty("optionImageBase64")
    public String getOptionImageBase64() {
        if (optionImage != null && optionImage.length > 0) {
            return Base64.getEncoder().encodeToString(optionImage);
        }
        return null;
    }

    // Base64 setter for JSON deserialization - accepts Base64 string from frontend
    @JsonProperty("optionImageBase64")
    public void setOptionImageBase64(String base64) {
        if (base64 != null && !base64.isEmpty()) {
            // Remove data URL prefix if present (e.g., "data:image/png;base64,")
            String data = base64.contains(",") ? base64.split(",")[1] : base64;
            this.optionImage = Base64.getDecoder().decode(data);
        } else {
            this.optionImage = null;
        }
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

    public static long getSerialversionuid() {
        return serialVersionUID;
    }

    public Boolean getIsGame() {
        return isGame;
    }

    public void setIsGame(Boolean isGame) {
        this.isGame = isGame;
    }

    public GameTable getGame() {
        return game;
    }

    public void setGame(GameTable game) {
        this.game = game;
    }

    public String getOptionDescription() {
        return optionDescription;
    }

    public void setOptionDescription(String optionDescription) {
        this.optionDescription = optionDescription;
    }


}
