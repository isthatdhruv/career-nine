package com.kccitm.api.model.career9.Questionaire;

import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.QuestionSection;

@Entity
@Table(name = "Questionnaire_Section")
// @JsonIgnoreProperties(ignoreUnknown = true)
public class QuestionnaireSection {

    //primary key questionnaire_section_id
   @Id
   @GeneratedValue(strategy = GenerationType.IDENTITY)
   @Column(name = "questionnaire_section_id")
   private Long questionnaireSectionId;

   // Foreign key to section table
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "section_id") // explicit join column to avoid auto-generated column name
    private QuestionSection section;

    // Foreign key to questionnaire table
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "questionnaire_id", referencedColumnName = "questionnaire_id")
    @JsonIgnore
    private Questionnaire questionnaire;


    @OneToMany(mappedBy = "section", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("section")
    private List<QuestionnaireQuestion> question;

    // use non-reserved column name
    @Column(name = "order_index")
    private String orderIndex;

    public String getOrder() {
        return this.orderIndex;
    }

    public void setOrder(String order) {
        this.orderIndex = order;
    }

    public QuestionSection getSection() {
        return this.section;
    }

    public void setSection(QuestionSection section) {
        this.section = section;
    }

    public Questionnaire getQuestionnaire() {
        return this.questionnaire;
    }

    public void setQuestionnaire(Questionnaire questionnaire) {
        this.questionnaire = questionnaire;
    }

    public Long getQuestionnaireSectionId() {
        return this.questionnaireSectionId;
    }

    public void setQuestionnaireSectionId(Long questionnaireSectionId) {
        this.questionnaireSectionId = questionnaireSectionId;
    }

    public List<QuestionnaireQuestion> getQuestions() {
        return this.question;
    }

    public void setQuestions(List<QuestionnaireQuestion> question) {
        this.question = question;
    }
}
