package com.kccitm.api.model;

import java.io.Serializable;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.OneToOne;
import javax.persistence.Table;
import javax.persistence.Transient;

/**
 * The persistent class for the branch database table.
 * 
 */
@Entity
@Table(name = "coding_questions")
// @NamedQuery(name = "codingQuestion.findAll", query = "SELECT b FROM
// codingQuestion b")
public class CodingQuestion implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(columnDefinition = "TEXT", name = "coding_question")
    private String codingQuestion;

    @Column(name = "question_heading")
    private String questionHeading;

    @Column(name = "question_url", unique = true)
    private String questionUrl;

    @Column(name = "platform")
    private String platform;

    @Column(name = "acceptance_rate")
    private String acceptanceRate;

    @Column(name = "accepted")
    private String accepted;

    @Column(name = "likes")
    private String likes;

    @Column(name = "submissions")
    private String submissions;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "difficulty")
    private Difficulty difficulty;

    @ManyToMany
    @JoinTable(name = "question_major_mapping", joinColumns = @JoinColumn(name = "question_id"), inverseJoinColumns = @JoinColumn(name = "topic_id"))
    private List<Topic> topic;

    @Transient
    private List<String> topicTemp;

    public int getId() {
        return this.id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getCodingQuestion() {
        return this.codingQuestion;
    }

    public void setCodingQuestion(String codingQuestion) {
        this.codingQuestion = codingQuestion;
    }

    public String getQuestionHeading() {
        return this.questionHeading;
    }

    public void setQuestionHeading(String questionHeading) {
        this.questionHeading = questionHeading;
    }

    public String getQuestionUrl() {
        return this.questionUrl;
    }

    public void setQuestionUrl(String questionUrl) {
        this.questionUrl = questionUrl;
    }

    public String getPlatform() {
        return this.platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getAcceptanceRate() {
        return this.acceptanceRate;
    }

    public void setAcceptanceRate(String acceptanceRate) {
        this.acceptanceRate = acceptanceRate;
    }

    public String getAccepted() {
        return this.accepted;
    }

    public void setAccepted(String accepted) {
        this.accepted = accepted;
    }

    public String getLikes() {
        return this.likes;
    }

    public void setLikes(String likes) {
        this.likes = likes;
    }

    public String getSubmissions() {
        return this.submissions;
    }

    public void setSubmissions(String submissions) {
        this.submissions = submissions;
    }

    public Difficulty getDifficulty() {
        return this.difficulty;
    }

    public void setDifficulty(Difficulty difficulty) {
        this.difficulty = difficulty;
    }

    public List<Topic> getMajorTopics() {
        return this.topic;
    }

    public void setMajorTopics(List<Topic> majorTopics) {
        this.topic = majorTopics;
    }

    public List<Topic> getTopic() {
        return topic;
    }

    public List<String> getTopicTemp() {
        return topicTemp;
    }

    public void setTopic(List<Topic> topic) {
        this.topic = topic;
    }

    public void setTopicTemp(List<String> topicTemp) {
        this.topicTemp = topicTemp;
    }

}