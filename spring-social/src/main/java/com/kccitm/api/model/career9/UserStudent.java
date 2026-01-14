package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.google.api.services.directory.model.User;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.career9.school.InstituteDetail;

@Entity
@Table(name = "user_student")
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserStudent implements Serializable {

    private static final long serialVersionUID = 1L;

    // Primary key
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_student_id")
    private Long userStudentId;

    // Institute Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "institute_id", referencedColumnName = "institute_code", nullable = false)
    private InstituteDetail institute;

    // Student Detail Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_detail_id", referencedColumnName = "student_id", nullable = false)
    private StudentInfo studentInfo;

    // User ID
    @Column(name = "user_id", nullable = false)
    private Long userId;

    public Long getUserStudentId() {
        return userStudentId;
    }

    public void setUserStudentId(Long userStudentId) {
        this.userStudentId = userStudentId;
    }

    public InstituteDetail getInstitute() {
        return institute;
    }

    public void setInstitute(InstituteDetail institute) {
        this.institute = institute;
    }

    public StudentInfo getStudentInfo() {
        return studentInfo;
    }

    public void setStudentInfo(StudentInfo studentInfo) {
        this.studentInfo = studentInfo;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }
}
