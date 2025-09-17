package com.kccitm.api.model.career9;

import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToMany;
import javax.persistence.Table;



@Entity
@Table(name="Language_Table")
public class LanguagesSupported {

    @Id
    private Long languageId;

    private String languageName;

    @OneToMany(cascade= CascadeType.ALL)
    @JoinColumn(name="fk_LanguageQuestion", referencedColumnName = "languageId")
    private List<LanguageQuestion> LanguageQuestion;

    @OneToMany(cascade= CascadeType.ALL)
    @JoinColumn(name="FK_LanguageOption", referencedColumnName = "languageId")
    private List<LanguageOption> LanguageOption;

    //getter/setter
    public List<LanguageOption> getLanguageOption(){
        return LanguageOption;
    }

    public void setLanguageOption(List<LanguageOption> LanguageOption){
        this.LanguageOption = LanguageOption;
    }

    public List<LanguageQuestion> getLanguageQuestion(){
        return LanguageQuestion;
    }

    public void setLanguageQuestion(List<LanguageQuestion> LanguageQuestion){
        this.LanguageQuestion = LanguageQuestion;
    }

    //getter setter
     public Long getLangId() {
        return languageId;
    }

    public void setId(Long languageId) {
        this.languageId = languageId;
    }

    public String getLangName() {
        return languageName;
    }

    public void setLangName(String languageName) {
        this.languageName = languageName;
    }
    
}
