package com.kccitm.api.model;

import java.io.Serializable;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Transient;

/**
 * The persistent class for the institute_courses database table.
 * 
 */
@Entity
@Table(name = "institute_courses")

// @NamedQuery(name="InstituteCourse.findAll", query="SELECT i FROM
// InstituteCourse i")
public class InstituteCourse implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "course_code")
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int courseCode;

	@Column(name = "course_name")
	private String courseName;

	@Column(name = "abbreviation")
	private String abbreviation;

	@Column(name = "institute_id")
	private int instituteId;

	@Transient
	private InstituteDetail instituteIdDetail;

	@Transient
	private List<InstituteBranch> instituteBranchs;

	// @Transient
	// @JoinTable(
	// name="institute_details",
	// joinColumns=
	// @JoinColumn(name="institute_id", referencedColumnName="institute_code"))
	// private InstituteDetail instituteDetails;

	private Boolean display;

	public InstituteCourse() {
	}

	public int getCourseCode() {
		return this.courseCode;
	}

	public void setCourseCode(int courseCode) {
		this.courseCode = courseCode;
	}

	public String getCourseName() {
		return this.courseName;
	}

	public void setCourseName(String courseName) {
		this.courseName = courseName;
	}

	public Boolean getDisplay() {
		return display;
	}

	public void setDisplay(Boolean display) {
		this.display = display;
	}

	public int getInstituteId() {
		return instituteId;
	}

	public InstituteDetail getInstituteIdDetail() {
		return instituteIdDetail;
	}

	public void setInstituteId(int instituteId) {
		this.instituteId = instituteId;
	}

	public void setInstituteIdDetail(InstituteDetail instituteIdDetail) {
		this.instituteIdDetail = instituteIdDetail;
	}

	public String getAbbreviation() {
		return abbreviation;
	}

	public void setAbbreviation(String abbreviation) {
		this.abbreviation = abbreviation;
	}

	public List<InstituteBranch> getInstituteBranchs() {
		return instituteBranchs;
	}

	public void setInstituteBranchs(List<InstituteBranch> instituteBranchs) {
		this.instituteBranchs = instituteBranchs;
	}

}