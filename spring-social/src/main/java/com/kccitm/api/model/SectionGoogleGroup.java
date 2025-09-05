package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Transient;

@Entity
@Table(name = "section_google_group")
public class SectionGoogleGroup implements Serializable {
    private static final long serialVersionUID = 1L;


    @Id
	@Column(name = "id")
	private int id;

    @Column(name = "section_id")
    private int sectionId;

    @Column(name = "name")
    private String name;

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
   public int getSectionId() {
       return sectionId;
   }
   public void setSectionId(int sectionId) {
       this.sectionId = sectionId;
   }
    
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }

    @Transient
    private Section section;


}
