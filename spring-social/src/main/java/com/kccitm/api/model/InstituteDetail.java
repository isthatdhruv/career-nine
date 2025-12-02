package com.kccitm.api.model;

import java.io.Serializable;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.Transient;
import javax.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "institute_detail_new")
public class InstituteDetail implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "institute_code")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer instituteCode;

    @NotNull
    @Column(name = "institute_name")
    private String instituteName;

    @Column(name = "institute_address")
    private String instituteAddress;

    private String city;
    private String state;
    private String phone;
    private Integer maxClass;
    private Integer maxStudents;
    private Integer maxContactPersons;

    // IMPORTANT FIX: Boolean instead of boolean
    @Column(name = "display")
    private Boolean display;   // wrapper, can be null

    @Transient
    private String transientField;

    // Many-to-Many: ContactPersons
    @OneToMany(mappedBy = "institute", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JsonManagedReference
    private Set<ContactPerson> contactPersons = new HashSet<>();


    // One-to-Many: Courses
    @JsonManagedReference("inst-course")
    @OneToMany(mappedBy = "institute", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private List<InstituteCourse> instituteCourse;


    public Integer getInstituteCode() {
        return instituteCode;
    }

    public void setInstituteCode(Integer instituteCode) {
        this.instituteCode = instituteCode;
    }

    public String getInstituteName() {
        return instituteName;
    }

    public void setInstituteName(String instituteName) {
        this.instituteName = instituteName;
    }

    public String getInstituteAddress() {
        return instituteAddress;
    }

    public void setInstituteAddress(String instituteAddress) {
        this.instituteAddress = instituteAddress;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    // FIXED: controller does getDisplay() != null, so this must return Boolean
    public Boolean getDisplay() {
        return display;
    }

    // safe primitive getter if used anywhere else
    public boolean isDisplay() {
        return display != null && display;
    }

    public void setDisplay(Boolean display) {
        this.display = display;
    }

    public String getTransientField() {
        return transientField;
    }

    public void setTransientField(String transientField) {
        this.transientField = transientField;
    }

    public Set<ContactPerson> getContactPersons() {
        return contactPersons;
    }

    public void setContactPersons(Set<ContactPerson> contactPersons) {
        this.contactPersons = contactPersons;
    }

    public List<InstituteCourse> getInstituteCourse() {
        return instituteCourse;
    }

    public void setInstituteCourse(List<InstituteCourse> instituteCourse) {
        this.instituteCourse = instituteCourse;
    }
    public Integer getMaxClass() {
        return maxClass;
    }
    public void setMaxClass(Integer maxClass) {
        this.maxClass = maxClass;
    }
    public Integer getMaxStudents() {
        return maxStudents;
    }
    public void setMaxStudents(Integer maxStudents) {
        this.maxStudents = maxStudents;
    }
    public Integer getMaxContactPersons() {
        return maxContactPersons;
    }
    public void setMaxContactPersons(Integer maxContactPersons) {
        this.maxContactPersons = maxContactPersons;
    }
}
