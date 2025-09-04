package com.kccitm.api.model;

import java.io.Serializable;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.OneToMany;
import javax.persistence.Table;

@Entity
@Table(name = "sub_topics")
public class SubTopic implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name")
    private String name;

    // @OneToMany(mappedBy = "subTopic")
    // private List<TopicSubMapping> majorSubMappings;

    // Constructors, getters, setters

    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    // public List<TopicSubMapping> getMajorSubMappings() {
    // return this.majorSubMappings;
    // }

    // public void setMajorSubMappings(List<TopicSubMapping> majorSubMappings) {
    // this.majorSubMappings = majorSubMappings;
    // }

}
