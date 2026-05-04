package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.OneToMany;
import javax.persistence.Column;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "question_sections")

public class QuestionSection implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sectionId;
    private String sectionName;
    private String sectionDescription;

    /**
     * Free-text reference to other content this section is meant to link to —
     * e.g. another section, an assessment, a tool, or any related context.
     * Captured during section creation, optional.
     */
    @Column(name = "to_be_linked_with", length = 500)
    private String toBeLinkedWith;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    //1 Section to Many Questions (section question mapping)
    @OneToMany(mappedBy = "section", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "section"})
    private List<AssessmentQuestions> questions;

public QuestionSection() {
    }

    public QuestionSection(Long sectionId, String sectionName) {
        this.sectionId = sectionId;
        this.sectionName = sectionName;
    }

    public QuestionSection(Long sectionId, String sectionName, String sectionDescription) {
        this.sectionId = sectionId;
        this.sectionName = sectionName;
        this.sectionDescription = sectionDescription;
    }

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

    public String getToBeLinkedWith() {
        return toBeLinkedWith;
    }

    public void setToBeLinkedWith(String toBeLinkedWith) {
        this.toBeLinkedWith = toBeLinkedWith;
    }

    // keep the domain getter but prevent full objects from being serialized
    @JsonIgnore
    public List<AssessmentQuestions> getQuestions() {
        return questions;
    }

    public void setQuestions(List<AssessmentQuestions> questions) {
        this.questions = questions;
    }

    // expose only the question IDs in JSON under the same "questions" property
    @JsonProperty("questionId")
    public List<Long> getQuestionIds() {
        if (questions == null) return Collections.emptyList();
        return questions.stream()
                .map(AssessmentQuestions::getQuestionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
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