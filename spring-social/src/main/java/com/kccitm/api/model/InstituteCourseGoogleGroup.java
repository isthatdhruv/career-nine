package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Transient;

@Entity
@Table(name = "institute_course_google_group")
public class InstituteCourseGoogleGroup implements Serializable {
    private static final long serialVersionUID = 1L;


    @Id
	@Column(name = "id")
	private int id;

    @Column(name = "institute_course_id")
    private int instituteCourseId;

    @Column(name = "name")
    private String name;

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
    public int getInstituteCourseId() {
        return instituteCourseId;
    }
    public void setInstituteCourseId(int instituteCourseId) {
        this.instituteCourseId = instituteCourseId;
    }
    
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }

    @Transient
    private InstituteCourse instituteCourse;


}
