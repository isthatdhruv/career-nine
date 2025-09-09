package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.OneToMany;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "question_sections")

public class QuestionSection implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sectionId;
    private String sectionName;
    private String sectionDescription;

    //1 Section to Many Questions (section question mapping)
    @OneToMany(mappedBy = "section", cascade=CascadeType.ALL)
    @JsonIgnore
    private List<AssessmentQuestions> questions;



    // Getters and Setters
    public Long getSectionId() {
        return sectionId;
    }

    public void setSectionId(Long sectionId) {
        this.sectionId = sectionId;
    }

    public String getSectionName() {
        return sectionName;
    }

    public void setSectionName(String sectionName) {
        this.sectionName = sectionName;
    }

    public String getSectionDescription() {
        return sectionDescription;
    }

    public void setSectionDescription(String sectionDescription) {
        this.sectionDescription = sectionDescription;
    }

    public List<AssessmentQuestions> getQuestions() {
        return questions;
    }

    public void setQuestions(List<AssessmentQuestions> questions) {
        this.questions = questions;
    }

    @Override
    public String toString() {
        return "QuestionSection{" +
                "sectionId=" + sectionId +
                ", sectionName='" + sectionName + '\'' +
                ", sectionDescription='" + sectionDescription + '\'' +
                '}';
    }
}