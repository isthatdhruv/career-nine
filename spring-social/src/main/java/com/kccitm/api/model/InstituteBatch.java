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
 * The persistent class for the institute_batch database table.
 * 
 */
@Entity
@Table(name = "institute_batch")
// @NamedQuery(name="InstituteBatch.findAll", query="SELECT i FROM
// InstituteBatch i")
public class InstituteBatch implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "batch_id")
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int batchId;

	@Column(name = "batch_duration")
	private int batchDuration;

	@Column(name = "batch_duration_type")
	private String batchDurationType;

	@Column(name = "batch_end")
	private String batchEnd;

	@Column(name = "batch_start")
	private String batchStart;

	// @Transient
	// private InstituteBranch instituteBranchIdDetails;

	@Transient
	private List<InstituteBranch> instituteBranchIdDetails;

	@Transient
	private List<InstituteSession> instituteSessions;

	private Boolean display;

	public InstituteBatch() {
	}

	public InstituteBatch(Batch batch) {

	}

	public int getBatchId() {
		return this.batchId;
	}

	public void setBatchId(int batchId) {
		this.batchId = batchId;
	}

	public int getBatchDuration() {
		return this.batchDuration;
	}

	public void setBatchDuration(int batchDuration) {
		this.batchDuration = batchDuration;
	}

	public String getBatchDurationType() {
		return this.batchDurationType;
	}

	public void setBatchDurationType(String batchDurationType) {
		this.batchDurationType = batchDurationType;
	}

	public String getBatchEnd() {
		return this.batchEnd;
	}

	public void setBatchEnd(String batchEnd) {
		this.batchEnd = batchEnd;
	}

	public String getBatchStart() {
		return this.batchStart;
	}

	public void setBatchStart(String batchStart) {
		this.batchStart = batchStart;
	}

	public Boolean getDisplay() {
		return display;
	}

	public void setDisplay(Boolean display) {
		this.display = display;
	}

	public List<InstituteBranch> getInstituteBranchIdDetails() {
	return instituteBranchIdDetails;
	}

	public void setInstituteBranchIdDetails(List<InstituteBranch>
	instituteBranchIdDetails) {
	this.instituteBranchIdDetails = instituteBranchIdDetails;
	}

	// public InstituteBranch getInstituteBranchIdDetails() {
	// 	return instituteBranchIdDetails;
	// }

	// public void setInstituteBranchIdDetails(InstituteBranch instituteBranchIdDetails) {
	// 	this.instituteBranchIdDetails = instituteBranchIdDetails;
	// }

	public List<InstituteSession> getInstituteSessions() {
		return instituteSessions;
	}

	public void setInstituteSessions(List<InstituteSession> instituteSessions) {
		this.instituteSessions = instituteSessions;
	}
}