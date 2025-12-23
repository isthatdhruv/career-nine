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

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.kccitm.api.model.career9.AssessmentQuestions;

@Entity
@Table(name = "Questionnaire_Question")

public class QuestionnaireQuestion {
    //primary key questionnaire_question_id
   @Id
   @GeneratedValue(strategy = GenerationType.IDENTITY)
   @Column(name = "questionnaire_question_id")
   private Long questionnaireQuestionId;

   // Foreign key to QuestionnaireSection table
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "questionnaire_section_id") // explicit join column to avoid auto-generated column name
    private QuestionnaireSection section;

    // Foreign key to QuestionnaireSection table
    @ManyToOne(fetch = FetchType.EAGER)
    @JsonIgnore
    @JoinColumn(name = "question_id") // explicit join column to avoid auto-generated column name
    private AssessmentQuestions question;

    @Column(name = "order_index")
    private String orderIndex;

    public String getOrder() {
        return this.orderIndex;
    }

    public void setOrder(String order) {
        this.orderIndex = order;
    }

   public Long getQuestionnaireQuestionId() {
        return this.questionnaireQuestionId;
    }

    public void setQuestionnaireQuestionId(Long questionnaireQuestionId) {
        this.questionnaireQuestionId = questionnaireQuestionId;
    }

    public QuestionnaireSection getSection() {
        return section;
    }

    public void setSection(QuestionnaireSection section) {
        this.section = section;
    }

    public AssessmentQuestions getQuestion() {
        return question;
    }

    public void setQuestion(AssessmentQuestions question) {
        this.question = question;
    }


}
