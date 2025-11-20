package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "student")
public class Student implements Serializable {
    private static final long serialVersionUID = 1L;
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long studentId;
    String studentName;
    String studentEmail;
    String studentPassword;
    Integer studentClass;
    String studentSection;
    String studentRollNo;
    String studentPhone;
    String studentHobbies;
    String studentAwards;
    String fatherName;
    String motherName;
    String fatherOccupation;
    String motherOccupation;
    String coCurricularActivities;
    String highScoringSubjects;
    
    public Long getStudentId() {
        return studentId;
    }
    public void setStudentId(Long studentId) {
        this.studentId = studentId; 
    }
    public String getStudentName() {
        return studentName;
    }
    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }
    public String getStudentEmail() {
        return studentEmail;
    }
    public void setStudentEmail(String studentEmail) {
        this.studentEmail = studentEmail;       
    }
    public String getStudentPassword() {
        return studentPassword;
    }
    public void setStudentPassword(String studentPassword) {
        this.studentPassword = studentPassword;
    }
    public Integer getStudentClass() {
        return studentClass;
    }
    public void setStudentClass(Integer studentClass) {
        this.studentClass = studentClass;
    }
    public String getStudentSection() {
        return studentSection;
    }
    public void setStudentSection(String studentSection) {          
        this.studentSection = studentSection;
    }
    public String getStudentRollNo() {
        return studentRollNo;
    }
    public void setStudentRollNo(String studentRollNo) {
        this.studentRollNo = studentRollNo;
    }
    public String getStudentPhone() {
        return studentPhone;
    }
    public void setStudentPhone(String studentPhone) {  
        this.studentPhone = studentPhone;
    }
    public String getStudentHobbies() {
        return studentHobbies;
    }
    public void setStudentHobbies(String studentHobbies) {
        this.studentHobbies = studentHobbies;
    }
    public String getStudentAwards() {
        return studentAwards;
    }
    public void setStudentAwards(String studentAwards) {
        this.studentAwards = studentAwards;
    }
    public String getFatherName() {
        return fatherName;
    }
    public void setFatherName(String fatherName) {  
        this.fatherName = fatherName;
    }
    public String getMotherName() {
        return motherName;
    }
    public void setMotherName(String motherName) {
        this.motherName = motherName;
    }
    public String getFatherOccupation() {
        return fatherOccupation;
    }
    public void setFatherOccupation(String fatherOccupation) {
        this.fatherOccupation = fatherOccupation;
    }
    public String getMotherOccupation() {
        return motherOccupation; 
    }
    public void setMotherOccupation(String motherOccupation) {
        this.motherOccupation = motherOccupation;
    }
    public String getCoCurricularActivities() {
        return coCurricularActivities;
    }
    public void setCoCurricularActivities(String coCurricularActivities) {
        this.coCurricularActivities = coCurricularActivities;
    }
    public String getHighScoringSubjects() {
        return highScoringSubjects;
    }
    public void setHighScoringSubjects(String highScoringSubjects) {    
        this.highScoringSubjects = highScoringSubjects;
    } 
}