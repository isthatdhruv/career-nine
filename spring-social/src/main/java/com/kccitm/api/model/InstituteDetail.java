package com.kccitm.api.model;

import java.io.Serializable;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Transient;

/**
 * The persistent class for the institute_details database table.
 * 
 */
@Entity
@Table(name = "institute_details")
// @NamedQuery(name="InstituteDetail.findAll", query="SELECT i FROM
// InstituteDetail i")
public class InstituteDetail implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "institute_code")
	private int instituteCode;

	private Boolean display;

	@Column(name = "institute_address")
	private String instituteAddress;

	@Column(name = "institute_name")
	private String instituteName;

	@Transient
	private List<InstituteCourse> instituteCourse;

	public InstituteDetail() {
	}

	public int getInstituteCode() {
		return this.instituteCode;
	}

	public void setInstituteCode(int instituteCode) {
		this.instituteCode = instituteCode;
	}

	public Boolean getDisplay() {
		return this.display;
	}

	public void setDisplay(Boolean display) {
		this.display = display;
	}

	public String getInstituteAddress() {
		return this.instituteAddress;
	}

	public void setInstituteAddress(String instituteAddress) {
		this.instituteAddress = instituteAddress;
	}

	public String getInstituteName() {
		return this.instituteName;
	}

	public void setInstituteName(String instituteName) {
		this.instituteName = instituteName;
	}

	public List<InstituteCourse> getInstituteCourse() {
		return instituteCourse;
	}

	public void setInstituteCourse(List<InstituteCourse> instituteCourse) {
		this.instituteCourse = instituteCourse;
	}

}