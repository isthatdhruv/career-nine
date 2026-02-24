package com.kccitm.api.model.career9.Questionaire;
import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.UserStudent;


@Entity
@Table(name = "assessment_answer")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentAnswer implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_answer_id")
    private Long assessmentAnswerId;

    // ✅ FIXED
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_student_id", referencedColumnName = "user_student_id")
    private UserStudent userStudent;

    // ✅ FIXED
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assessment_id", referencedColumnName = "assessment_id")
    private AssessmentTable assessment;

    // OK
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "questionnaire_question_id")
    private QuestionnaireQuestion questionnaireQuestion;

    // ✅ FIXED
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "option_id")
    private AssessmentQuestionOptions option;

    private Integer rankOrder;

    @Column(name = "text_response", columnDefinition = "TEXT")
    private String textResponse;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "mapped_option_id")
    private AssessmentQuestionOptions mappedOption;

    public AssessmentAnswer() {
    }

    public Long getAssessmentAnswerId() {
        return assessmentAnswerId;
    }

    public void setAssessmentAnswerId(Long assessmentAnswerId) {
        this.assessmentAnswerId = assessmentAnswerId;
    }
    public UserStudent getUserStudent() {
        return userStudent;
    }

    public void setUserStudent(UserStudent userStudent) {
        this.userStudent = userStudent;
    }

    public AssessmentTable getAssessment() {
        return assessment;
    }

    public void setAssessment(AssessmentTable assessment) {
        this.assessment = assessment;
    }
    public QuestionnaireQuestion getQuestionnaireQuestion() {
        return questionnaireQuestion;
    }
    public void setQuestionnaireQuestion(QuestionnaireQuestion questionnaireQuestion) {
        this.questionnaireQuestion = questionnaireQuestion;
    }
    public AssessmentQuestionOptions getOption() {
        return option;
    }
    public void setOption(AssessmentQuestionOptions option) {
        this.option = option;
    }
    public Integer getRankOrder() {
        return rankOrder;
    }
    public void setRankOrder(Integer rankOrder) {
        this.rankOrder = rankOrder;
    }
    public String getTextResponse() {
        return textResponse;
    }
    public void setTextResponse(String textResponse) {
        this.textResponse = textResponse;
    }
    public AssessmentQuestionOptions getMappedOption() {
        return mappedOption;
    }
    public void setMappedOption(AssessmentQuestionOptions mappedOption) {
        this.mappedOption = mappedOption;
    }
}