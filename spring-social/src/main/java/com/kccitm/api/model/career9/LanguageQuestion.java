package com.kccitm.api.model.career9;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table
public class LanguageQuestion {
    @Id
    private Long LanguageQuestionId;
    
    private String QuestionText;

    //getter setters
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

}
