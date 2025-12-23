package com.kccitm.api.model.career9.Questionaire;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

import com.kccitm.api.model.career9.LanguagesSupported;

@Entity
@Table(name = "Questionnaire_Section_Instruction")
public class QuestionnaireSectionInstruction {
    //primary key questionnaire_section_instruction_id
   @Id
   @GeneratedValue(strategy = GenerationType.IDENTITY)
   @Column(name = "questionnaire_section_instruction_id")
   private Long questionnaireSectionInstructionId;

   // Foreign key to QuestionnaireSection table
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "questionnaire_section_id") // explicit join column to avoid auto-generated column name
    private QuestionnaireSection section;

    // Foreign key to language table
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "language_id") // explicit join column to avoid auto-generated column name
    private LanguagesSupported language;

    @Column(name = "instruction_text")
    private String instructionText;

    public String getInstructionText() {
        return this.instructionText;
    }

    public void setInstructionText(String instructionText) {
        this.instructionText = instructionText;
    }

   public Long getQuestionnaireSectionInstructionId() {
        return this.questionnaireSectionInstructionId;
    }

    public void setQuestionnaireSectionInstructionId(Long questionnaireSectionInstructionId) {
        this.questionnaireSectionInstructionId = questionnaireSectionInstructionId;
    }

    public LanguagesSupported getLanguage() {
        return language;
    }

    public void setLanguage(LanguagesSupported language) {
        this.language = language;
    }

    public QuestionnaireSection getSection() {
        return section;
    }

    public void setSection(QuestionnaireSection section) {
        this.section = section;
    }

}
