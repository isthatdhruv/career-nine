package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.NamedQuery;
import javax.persistence.Table;


/**
 * The persistent class for the institue_academic database table.
 * 
 */
@Entity
@Table(name="institue_academic")
@NamedQuery(name="InstitueAcademic.findAll", query="SELECT i FROM InstitueAcademic i")
public class InstitueAcademic implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name="academic_id")
	private int academicId;

	@Column(name="academic_name")
	private String academicName;

	@Column(name="academic_type")
	private String academicType;

	public InstitueAcademic() {
	}

	public int getAcademicId() {
		return this.academicId;
	}

	public void setAcademicId(int academicId) {
		this.academicId = academicId;
	}

	public String getAcademicName() {
		return this.academicName;
	}

	public void setAcademicName(String academicName) {
		this.academicName = academicName;
	}

	public String getAcademicType() {
		return this.academicType;
	}

	public void setAcademicType(String academicType) {
		this.academicType = academicType;
	}

}
