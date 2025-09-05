package com.kccitm.api.model;

import java.io.Serializable;

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
@Table(name = "createQuestion")
public class CreateQuestion implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    private String question;

    public CreateQuestion() {
    }

    public int getId() {
        return this.id;
    }

    public void setId(int id) {
        this.id = id;
    }
    public String getQuestion() {
     return question;
    }
    public void setQuestion(String question) {
        this.question = question;
    }

}