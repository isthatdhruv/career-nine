package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.ManyToOne;

/**
 * The persistent class for the branch database table.
 * 
 */
@Entity
// @Table(name = "testCase")
// @NamedQuery(name = "testCase.findAll", query = "SELECT b FROM testCase b")
public class TestCase implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @ManyToOne(targetEntity = CodingQuestion.class)
    private CodingQuestion codingQuestionId;
    
    @Column(columnDefinition="TEXT")
    private String input;
    
    @Column(columnDefinition="TEXT")
    private String output;

    private Boolean locked;


    public TestCase() {
    }

    public int getId() {
        return this.id;
    }

    public void setId(int id) {
        this.id = id;
    }
    public CodingQuestion getCodingQuestionId() {
        return codingQuestionId;
    }
    public void setCodingQuestionId(CodingQuestion codingQuestionId) {
        this.codingQuestionId = codingQuestionId;
    }


    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }
   
    public String getOutput() {
        return output;
    }
    
    public void setOutput(String output) {
        this.output = output;
    }

    public Boolean getLocked() {
        return locked;
    }

    public void setLocked(Boolean locked) {
        this.locked = locked;
    }

}