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
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssessmentAnswer implements Serializable {

    private static final long serialVersionUID = 1L;

    // Primary key
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_answer_id")
    private Long assessmentAnswerId;

    @Column(name = "user_student_id")
    private UserStudent userStudent;

    @Column(name = "assessment_id")
    private AssessmentTable assessmentId;

    //QuestionnaireQuestion ID
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "questionnaire_question_id")
    private QuestionnaireQuestion questionnaireQuestionId;

    @Column(name = "option_id")
    private AssessmentQuestionOptions optionId;

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

    public AssessmentTable getAssessmentId() {
        return assessmentId;
    }   
    public void setAssessmentId(AssessmentTable assessmentId) {
        this.assessmentId = assessmentId;
    }   
    public QuestionnaireQuestion getQuestionnaireQuestionId() {
        return questionnaireQuestionId;
    }   
    public void setQuestionnaireQuestionId(QuestionnaireQuestion questionnaireQuestionId) {
        this.questionnaireQuestionId = questionnaireQuestionId;
    }   
    public AssessmentQuestionOptions getOptionId() {
        return optionId;    
    }
    public void setOptionId(AssessmentQuestionOptions optionId) {
        this.optionId = optionId;
    }   
}