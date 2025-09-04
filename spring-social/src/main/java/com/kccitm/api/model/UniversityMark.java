package com.kccitm.api.model;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.Table;

/**
 * The persistent class for the university_marks database table.
 * 
 */
@Entity
@Table(name = "university_marks")
// @NamedQuery(name="UniversityMark.findAll", query="SELECT u FROM
// UniversityMark u")
public class UniversityMark implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	private long rollNo;
	

	@Lob
	private String jsontext;

	@Column(columnDefinition = "TIMESTAMP")
	private LocalDateTime timestamp;

	public UniversityMark() {
	}

	public long getRollNo() {
		return this.rollNo;
	}

	public void setRollNo(long rollNo) {
		this.rollNo = rollNo;
	}

	public String getJsontext() {
		return this.jsontext;
	}

	public void setJsontext(String jsontext) {
		this.jsontext = jsontext;
	}

	public LocalDateTime getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(LocalDateTime timestamp) {
		this.timestamp = timestamp;
	}
}