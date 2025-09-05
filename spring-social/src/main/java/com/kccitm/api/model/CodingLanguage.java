package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * The persistent class for the branch database table.
 * 
 */
@Entity
@Table(name = "codingLanguage")
// @NamedQuery(name = "codingLanguage.findAll", query = "SELECT b FROM codingLanguage b")
public class CodingLanguage implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name="codingQuestionId")
	private int codingQuestionId;

    @Column(name="languageId")
	private int languageId;

    @Column(name="languageName")
	private String languageName;

    @Column(name="code")
	private String code;

    public CodingLanguage() {
    }

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
    public int getCodingQuestionId() {
        return codingQuestionId;
    }
    public void setCodingQuestionId(int codingQuestionId) {
        this.codingQuestionId = codingQuestionId;
    }
    
    public int getLanguageId() {
        return languageId;
    }
    public void setLanguageId(int languageId) {
        this.languageId = languageId;
    }
    public String getLanguageName() {
        return languageName;
    }
    public void setLanguageName(String languageName) {
        this.languageName = languageName;
    }
    public String getCode() {
        return code;
    }
    public void setCode(String code) {
        this.code = code;
    }

}