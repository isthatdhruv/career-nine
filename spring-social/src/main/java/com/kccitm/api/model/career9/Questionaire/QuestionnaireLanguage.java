package com.kccitm.api.model.career9.Questionaire;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

import com.kccitm.api.model.career9.LanguagesSupported;

@Entity
@Table(name = "questionnaire_language")
public class QuestionnaireLanguage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "questionnaire_id")
    private Questionnaire questionnaire;
    
    @ManyToOne
    @JoinColumn(name = "languageId")
    private LanguagesSupported language;

    @Column(name = "instructions" , columnDefinition = "TEXT")
    private String instructions;


    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Questionnaire getQuestionnaire() {
        return this.questionnaire;
    }

    public void setQuestionnaire(Questionnaire questionnaire) {
        this.questionnaire = questionnaire;
    }

    public LanguagesSupported getLanguage() {
        return this.language;
    }

    public void setLanguage(LanguagesSupported language) {
        this.language = language;
    }

    public String getInstructions() {
        return instructions;
    }
    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

  
}
