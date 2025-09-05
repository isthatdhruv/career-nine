package com.kccitm.api.model;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

@Entity
@Table(name = "major_sub_mapping")
public class TopicSubMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "topic_id")
    private Topic topic;

    @ManyToOne
    @JoinColumn(name = "sub_topic_id")
    private SubTopic subTopic;

    // Constructors, getters, setters

    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Topic getMajorTopic() {
        return this.topic;
    }

    public void setMajorTopic(Topic majorTopic) {
        this.topic = majorTopic;
    }

    public SubTopic getSubTopic() {
        return this.subTopic;
    }

    public void setSubTopic(SubTopic subTopic) {
        this.subTopic = subTopic;
    }

}
