package com.kccitm.api.model;

import java.io.Serializable;
import java.math.BigInteger;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.NamedQuery;
import javax.persistence.Table;


/**
 * The persistent class for the student_logs database table.
 * 
 */
@Entity
@Table(name="student_logs")
@NamedQuery(name="StudentLog.findAll", query="SELECT s FROM StudentLog s")
public class StudentLog implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

	@Column(name="10thboard")
	private String _0thboard;

	@Column(name="10thMarks")
	private String _0thMarks;

	@Column(name="10thRollNo")
	private String _0thRollNo;

	@Column(name="12thboardSS")
	private String _2thboardSS;

	@Column(name="12thMarksChemistry")
	private String _2thMarksChemistry;

	@Column(name="12thMarksMaths")
	private String _2thMarksMaths;

	@Column(name="12thMarksPhysics")
	private String _2thMarksPhysics;

	@Column(name="12thRollNoSS")
	private String _2thRollNoSS;

	@Column(name="AadharCardNo")
	private String aadharCardNo;

	@Lob
	@Column(name="Batch")
	private String batch;

	@Lob
	@Column(name="Branch")
	private String branch;

	private String category;

	@Lob
	@Column(name="Course")
	private String course;

	@Lob
	@Column(name="CurrentAddress")
	private String currentAddress;

	@Lob
	@Column(name="DOB")
	private String dob;

	@Lob
	@Column(name="EmailAddress")
	private String emailAddress;

	@Lob
	@Column(name="FatherName")
	private String fatherName;

	@Column(name="FatherPhoneNumber")
	private String fatherPhoneNumber;

	@Lob
	private String FName;

	@Column(name="Gender")
	private String gender;

	@Column(name="Generate")
	private String generate;

	@Column(name="HindiName")
	private String hindiName;

	@Lob
	private byte[] image;

	private String LName;

	private String MName;

	@Lob
	@Column(name="MotherName")
	private String motherName;

	@Lob
	private byte[] pdf;

	@Lob
	@Column(name="PermanentAddress")
	private String permanentAddress;

	@Column(name="PhoneNumber")
	private String phoneNumber;

	@Column(name="`Roll No.`")
	private BigInteger roll_No_;

	private String studentscol;

	private String timestamp;

	private String updatedby;

	public StudentLog() {
	}

	public int getId() {
		return this.id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public String get_0thboard() {
		return this._0thboard;
	}

	public void set_0thboard(String _0thboard) {
		this._0thboard = _0thboard;
	}

	public String get_0thMarks() {
		return this._0thMarks;
	}

	public void set_0thMarks(String _0thMarks) {
		this._0thMarks = _0thMarks;
	}

	public String get_0thRollNo() {
		return this._0thRollNo;
	}

	public void set_0thRollNo(String _0thRollNo) {
		this._0thRollNo = _0thRollNo;
	}

	public String get_2thboardSS() {
		return this._2thboardSS;
	}

	public void set_2thboardSS(String _2thboardSS) {
		this._2thboardSS = _2thboardSS;
	}

	public String get_2thMarksChemistry() {
		return this._2thMarksChemistry;
	}

	public void set_2thMarksChemistry(String _2thMarksChemistry) {
		this._2thMarksChemistry = _2thMarksChemistry;
	}

	public String get_2thMarksMaths() {
		return this._2thMarksMaths;
	}

	public void set_2thMarksMaths(String _2thMarksMaths) {
		this._2thMarksMaths = _2thMarksMaths;
	}

	public String get_2thMarksPhysics() {
		return this._2thMarksPhysics;
	}

	public void set_2thMarksPhysics(String _2thMarksPhysics) {
		this._2thMarksPhysics = _2thMarksPhysics;
	}

	public String get_2thRollNoSS() {
		return this._2thRollNoSS;
	}

	public void set_2thRollNoSS(String _2thRollNoSS) {
		this._2thRollNoSS = _2thRollNoSS;
	}

	public String getAadharCardNo() {
		return this.aadharCardNo;
	}

	public void setAadharCardNo(String aadharCardNo) {
		this.aadharCardNo = aadharCardNo;
	}

	public String getBatch() {
		return this.batch;
	}

	public void setBatch(String batch) {
		this.batch = batch;
	}

	public String getBranch() {
		return this.branch;
	}

	public void setBranch(String branch) {
		this.branch = branch;
	}

	public String getCategory() {
		return this.category;
	}

	public void setCategory(String category) {
		this.category = category;
	}

	public String getCourse() {
		return this.course;
	}

	public void setCourse(String course) {
		this.course = course;
	}

	public String getCurrentAddress() {
		return this.currentAddress;
	}

	public void setCurrentAddress(String currentAddress) {
		this.currentAddress = currentAddress;
	}

	public String getDob() {
		return this.dob;
	}

	public void setDob(String dob) {
		this.dob = dob;
	}

	public String getEmailAddress() {
		return this.emailAddress;
	}

	public void setEmailAddress(String emailAddress) {
		this.emailAddress = emailAddress;
	}

	public String getFatherName() {
		return this.fatherName;
	}

	public void setFatherName(String fatherName) {
		this.fatherName = fatherName;
	}

	public String getFatherPhoneNumber() {
		return this.fatherPhoneNumber;
	}

	public void setFatherPhoneNumber(String fatherPhoneNumber) {
		this.fatherPhoneNumber = fatherPhoneNumber;
	}

	public String getFName() {
		return this.FName;
	}

	public void setFName(String FName) {
		this.FName = FName;
	}

	public String getGender() {
		return this.gender;
	}

	public void setGender(String gender) {
		this.gender = gender;
	}

	public String getGenerate() {
		return this.generate;
	}

	public void setGenerate(String generate) {
		this.generate = generate;
	}

	public String getHindiName() {
		return this.hindiName;
	}

	public void setHindiName(String hindiName) {
		this.hindiName = hindiName;
	}

	public byte[] getImage() {
		return this.image;
	}

	public void setImage(byte[] image) {
		this.image = image;
	}

	public String getLName() {
		return this.LName;
	}

	public void setLName(String LName) {
		this.LName = LName;
	}

	public String getMName() {
		return this.MName;
	}

	public void setMName(String MName) {
		this.MName = MName;
	}

	public String getMotherName() {
		return this.motherName;
	}

	public void setMotherName(String motherName) {
		this.motherName = motherName;
	}

	public byte[] getPdf() {
		return this.pdf;
	}

	public void setPdf(byte[] pdf) {
		this.pdf = pdf;
	}

	public String getPermanentAddress() {
		return this.permanentAddress;
	}

	public void setPermanentAddress(String permanentAddress) {
		this.permanentAddress = permanentAddress;
	}

	public String getPhoneNumber() {
		return this.phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public BigInteger getRoll_No_() {
		return this.roll_No_;
	}

	public void setRoll_No_(BigInteger roll_No_) {
		this.roll_No_ = roll_No_;
	}

	public String getStudentscol() {
		return this.studentscol;
	}

	public void setStudentscol(String studentscol) {
		this.studentscol = studentscol;
	}

	public String getTimestamp() {
		return this.timestamp;
	}

	public void setTimestamp(String timestamp) {
		this.timestamp = timestamp;
	}

	public String getUpdatedby() {
		return this.updatedby;
	}

	public void setUpdatedby(String updatedby) {
		this.updatedby = updatedby;
	}

}