package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToOne;
import javax.persistence.Table;
import javax.persistence.Transient;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.User;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "student_info")
public class StudentInfo implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String name;

    private String schoolRollNumber;

    private String phoneNumber;

    private String email;

    private String address;

    @Transient
    private String institue_id;

    @Transient
    private String assesment_id;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date studentDob;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "user_id")
    private User user;

    @JsonFormat(pattern = "dd-MM-yyyy")
    public Date getStudentDob() {
        return studentDob;
    }

    public void setStudentDob(Date studentDob) {
        this.studentDob = studentDob;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSchoolRollNumber() {
        return schoolRollNumber;
    }

    public void setSchoolRollNumber(String schoolRollNumber) {
        this.schoolRollNumber = schoolRollNumber;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getInstitue_id() {
        return institue_id;
    }

    public void setInstitue_id(String institue_id) {
        this.institue_id = institue_id;
    }

    public String getAssesment_id() {
        return assesment_id;
    }

    public void setAssesment_id(String assesment_id) {
        this.assesment_id = assesment_id;
    }

}
