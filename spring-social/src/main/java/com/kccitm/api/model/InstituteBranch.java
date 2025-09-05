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
 * The persistent class for the institute_branch database table.
 * 
 */
@Entity
@Table(name="institute_branch")
// @NamedQuery(name="InstituteBranch.findAll", query="SELECT i FROM InstituteBranch i")
public class InstituteBranch implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name="branch_id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private int branchId;

	@Column(name="branch_name")
	private String branchName;

	@Column(name="course_id")
	private int courseId;

	@Column(name="abbreviation")
	private String abbreviation;

	@Column(name="shift")
	private String shift;

	@Column(name="total_intake")
	private String totalIntake;


	@Transient
	private List<InstituteBranchBatchMapping> instituteBranchBatchMapping;
	

	private Boolean display;

	public InstituteBranch() {
	}

	public int getBranchId() {
		return this.branchId;
	}

	public void setBranchId(int branchId) {
		this.branchId = branchId;
	}

	public String getBranchName() {
		return this.branchName;
	}

	public void setBranchName(String branchName) {
		this.branchName = branchName;
	}

	public int getCourseId() {
		return courseId;
	}
	public void setCourseId(int courseId) {
		this.courseId = courseId;
	}
	public Boolean getDisplay() {
		return display;
	}
	public void setDisplay(Boolean display) {
		this.display = display;
	}

	public List<InstituteBranchBatchMapping> getInstituteBranchBatchMapping() {
		return instituteBranchBatchMapping;
	}
	public void setInstituteBranchBatchMapping(List<InstituteBranchBatchMapping> instituteBranchBatchMapping) {
		this.instituteBranchBatchMapping = instituteBranchBatchMapping;
	}

	public String getAbbreviation() {
		return abbreviation;
	}
	public void setAbbreviation(String abbreviation) {
		this.abbreviation = abbreviation;
	}
	public String getShift() {
		return shift;
	}
	public void setShift(String shift) {
		this.shift = shift;
	}
	public String getTotalIntake() {
		return totalIntake;
	}
	public void setTotalIntake(String totalIntake) {
		this.totalIntake = totalIntake;
	}
	
}