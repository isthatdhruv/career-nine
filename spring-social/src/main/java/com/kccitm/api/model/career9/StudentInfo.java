package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToOne;
import javax.persistence.Table;
import javax.persistence.Transient;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.User;

/**
 * <strong>Phase 15-06 — ABAC row-level filter.</strong>
 *
 * <p>The {@code @FilterDef} declared here is referenced by every scope-aware
 * entity in the model layer (StudentInfo, UserStudent, AssessmentTable,
 * Campaign, InstituteBranch). It declares the four ABAC parameter lists
 * (institute / session / course / section) populated once per request by
 * {@link com.kccitm.api.security.ScopeFilterInterceptor}.
 *
 * <p>Each entity then applies a {@code @Filter} with a SQL fragment using ONLY
 * the columns that exist on that entity's table; missing dimensions are
 * silently omitted from the condition.
 *
 * <p>Section is INTENTIONALLY EXCLUDED from this filter — it is a global
 * lookup table (id/name/display) with no institute FK; filtering it on
 * {@code id IN (:sectionIds) OR id IS NULL} would zero out every Section row
 * for any caller without an explicit section-level scope grant. Section
 * access cascades naturally via Branch → Institute and via StudentInfo →
 * Section relationships, both of which ARE filtered through this defn.
 */
@FilterDef(name = "scopeFilter", parameters = {
        @ParamDef(name = "instituteIds", type = "integer"),
        @ParamDef(name = "sessionIds",   type = "integer"),
        @ParamDef(name = "courseCodes",  type = "integer"),
        @ParamDef(name = "sectionIds",   type = "long")
})
@Filter(name = "scopeFilter", condition =
        "(institute_id IN (:instituteIds) OR institute_id IS NULL)"
      + " AND (session_id IN (:sessionIds) OR session_id IS NULL)"
      + " AND (course_code IN (:courseCodes) OR course_code IS NULL)"
      + " AND (school_section_id IN (:sectionIds) OR school_section_id IS NULL)")
@Entity
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
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

    private String gender;

    private Integer sibling;

    private String family;
    

    private String schoolBoard;

    private Long controlNumber;

    private Integer studentClass;

    @Column(name = "institute_id")
    private Integer instituteId;

    @Column(name = "session_id")
    private Integer sessionId;

    @Column(name = "course_code")
    private Integer courseCode;

    @Column(name = "school_section_id")
    private Integer schoolSectionId;

    @Transient
    private String assesment_id;

    @Transient
    private String careerNineRollNumber;

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

    public Integer getInstituteId() {
        return instituteId;
    }

    public void setInstituteId(Integer instituteId) {
        this.instituteId = instituteId;
    }

    public Integer getSessionId() {
        return sessionId;
    }

    public void setSessionId(Integer sessionId) {
        this.sessionId = sessionId;
    }

    public Integer getCourseCode() {
        return courseCode;
    }

    public void setCourseCode(Integer courseCode) {
        this.courseCode = courseCode;
    }

    public String getAssesment_id() {
        return assesment_id;
    }

    public void setAssesment_id(String assesment_id) {
        this.assesment_id = assesment_id;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public Integer getSibling() {
        return sibling;
    }

    public void setSibling(Integer sibling) {
        this.sibling = sibling;
    }

    public static long getSerialversionuid() {
        return serialVersionUID;
    }

    public String getFamily() {
        return family;
    }

    public void setFamily(String family) {
        this.family = family;
    }

    public String getSchoolBoard() {
        return schoolBoard;
    }

    public void setSchoolBoard(String schoolBoard) {
        this.schoolBoard = schoolBoard;
    }

    public Integer getStudentClass() {
        return studentClass;
    }

    public void setStudentClass(Integer studentClass) {
        this.studentClass = studentClass;
    }

    public Integer getSchoolSectionId() {
        return schoolSectionId;
    }

    public void setSchoolSectionId(Integer schoolSectionId) {
        this.schoolSectionId = schoolSectionId;
    }

    public Long getControlNumber() {
        return controlNumber;
    }

    public void setControlNumber(Long controlNumber) {
        this.controlNumber = controlNumber;
    }

    public String getCareerNineRollNumber() {
        return careerNineRollNumber;
    }

    public void setCareerNineRollNumber(String careerNineRollNumber) {
        this.careerNineRollNumber = careerNineRollNumber;
    }

}
