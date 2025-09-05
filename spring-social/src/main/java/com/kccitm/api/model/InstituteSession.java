package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Transient;


/**
 * The persistent class for the institute_session database table.
 * 
 */
@Entity
@Table(name="institute_session")
// @NamedQuery(name="InstituteSession.findAll", query="SELECT i FROM InstituteSession i")
public class InstituteSession implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name="session_id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private int sessionId;

	@Column(name="session_duration")
	private int sessionDuration;

	@Column(name="session_duration_type")
	private String sessionDurationType;

	@Column(name="session_start_date")
	private String sessionStartDate;

	@Column(name="session_end_date")
	private String sessionEndDate;


	@Column(name="batch_id")
	private int batchId;

	@Transient
	private InstituteBatch instituteBatchIdDetails;

	private Boolean display;

	public InstituteSession() {
	}

	public int getSessionId() {
		return this.sessionId;
	}

	public void setSessionId(int sessionId) {
		this.sessionId = sessionId;
	}

	public int getSessionDuration() {
		return this.sessionDuration;
	}

	public void setSessionDuration(int sessionDuration) {
		this.sessionDuration = sessionDuration;
	}

	public String getSessionDurationType() {
		return this.sessionDurationType;
	}

	public void setSessionDurationType(String sessionDurationType) {
		this.sessionDurationType = sessionDurationType;
	}

	public String getSessionEndDate() {
		return sessionEndDate;
	}
	public void setSessionEndDate(String sessionEndDate) {
		this.sessionEndDate = sessionEndDate;
	}

	public String getSessionStartDate() {
		return sessionStartDate;
	}
	public void setSessionStartDate(String sessionStartDate) {
		this.sessionStartDate = sessionStartDate;
	}
	public int getBatchId() {
		return batchId;
	}
	public void setBatchId(int batchId) {
		this.batchId = batchId;
	}
	public Boolean getDisplay() {
		return display;
	}
	public void setDisplay(Boolean display) {
		this.display = display;
	}

}