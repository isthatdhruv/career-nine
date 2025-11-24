package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.persistence.Id;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.ManyToOne;
import javax.persistence.JoinColumn;
import javax.persistence.FetchType;

import javax.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonBackReference;


@Entity
@Table(name = "contact_person")
public class ContactPerson implements Serializable{
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    private String name;

    @NotNull
    private String email;

    private String phoneNumber;
    private String designation;
    private String gender;

    // Many contact persons belong to one institute
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institute_code")
    @JsonBackReference
    private InstituteDetail institute;

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getEmail() {
        return email;
    }
    public void setEmail(String email) {
        this.email = email;
    }
    public String getPhoneNumber() {
        return phoneNumber;
    }
    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }
    public String getDesignation() {
        return designation;
    }
    public void setDesignation(String designation) {
        this.designation = designation;
    }
    public String getGender() {
        return gender;
    }
    public void setGender(String gender) {
        this.gender = gender;
    }

    public InstituteDetail getInstitute() {
        return institute;
    }
    public void setInstitute(InstituteDetail institute) {
        this.institute = institute;
    }

}