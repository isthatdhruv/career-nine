package com.kccitm.api.model.career9;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table
public class LanguageOption {
    
    @Id
    private Long LanguageOptionId;
    
    // private Long languageId;

    // private Long opti_id;

    private String LanguageoptionText;

    //getter setters
     public Long getLanguageOptionId() {
        return LanguageOptionId;
    }

    public void setLanguageOptionId(Long LanguageOption_id) {
        this.LanguageOptionId = LanguageOption_id;
    }
    public String getLanguageOptionText() {
        return LanguageoptionText;
    }

    public void setLanguageOptionText(String opti_text) {
        this.LanguageoptionText = opti_text;
    }
}
