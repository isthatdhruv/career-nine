package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;



@Entity
@Table(name="Language_Table")
public class LanguagesSupported implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY )
    // @Column(name="language_id", nullable = false, unique = true)
    private Long languageId;

    private String languageName;

    @OneToMany(mappedBy = "language", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<LanguageQuestion> questions = new ArrayList<>();

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
    public List<LanguageQuestion> getQuestions() {
        return questions;
    }
    public void setQuestions(List<LanguageQuestion> questions) {
        this.questions = questions;
    }
    public String getLanguageName() {
        return languageName;
    }

    public void setLanguageName(String languageName) {
        this.languageName = languageName;
    }

    public Long getLanguageId() {
        return languageId;
    }

    public void setLanguageId(Long languageId) {
        this.languageId = languageId;
    }
    
}
