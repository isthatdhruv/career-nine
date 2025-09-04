package com.kccitm.api.model;

import java.io.Serializable;
import java.util.ArrayList;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.Table;
import javax.persistence.Transient;

@Entity
@Table(name = "faculty_metadata")
public class Faculty implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "college_identification_number")
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int collegeIdentificationNumber;

	@Column(name = "webcam_photo")
	private String webcamPhoto;

	private byte display;

	// @Column(name="aadhar_card",columnDefinition = "varchar default 18")

	// private String aadharCard;

	@Column(name = "aadhar_card_no")
	private String aadharCardNo;

	@Column(name = "first_name")
	private String firstName;

	@Column(name = "middle_name")
	private String middleName;

	@Column(name = "last_name")
	private String lastName;

	@Lob
	@Column(name = "dob")
	private String dob;

	@Column(name = "gender")
	private int gender;

	private int category;

	@Column(name = "father_husband_name")
	private String father_husband_name;

	@Column(name = "generate")
	private String generate;

	@Column(name = "phone_number")
	private String phoneNumber;

	@Column(name = "educational_qualifications")
	private String educationalQualifications;

	@Lob
	@Column(name = "permanent_address")
	private String permanentAddress;

	@Lob
	@Column(name = "current_address")
	private String currentAddress;

	@Lob
	@Column(name = "personal_email_address")
	private String personalEmailAddress;

	@Lob
	@Column(name = "official_email_address")
	private String officialEmailAddress;

	@Column(name = "bank_account_no")
	private String bankAccountNo;

	@Column(name = "pan_card_no")
	private String panCardNo;

	@Column(name = "ifsc_code")
	private String ifscCode;

	@Lob
	@Column(name = "bank_name_with_address")
	private String bankName;

	@Column(name = "teaching_experience")
	private String teachingExperience;

	@Column(name = "designation")
	private String designation;

	@Column(name = "department")
	private String department;

	@Transient
	private Gender genderData;

	@Transient
	private Category categoryData;

	@Transient
	private CheckFacultyRegistrationField check;

	public String getWebcamPhoto() {
		return webcamPhoto;
	}

	public void setWebcamPhoto(String webcamPhoto) {
		this.webcamPhoto = webcamPhoto;
	}

	public String getAadharCardNo() {
		return aadharCardNo;
	}

	public void setAadharCardNo(String aadharCardNo) {
		this.aadharCardNo = aadharCardNo;
	}

	public String getBankAccountNo() {
		return bankAccountNo;
	}

	public void setBankAccountNo(String bankAccountNo) {
		this.bankAccountNo = bankAccountNo;
	}

	public String getBankName() {
		return bankName;
	}

	public void setBankName(String bankName) {
		this.bankName = bankName;
	}

	public int getCategory() {
		return category;
	}

	public void setCategory(int category) {
		this.category = category;
	}

	public int getCollegeIdentificationNumber() {
		return collegeIdentificationNumber;
	}

	public void setCollegeIdentificationNumber(int collegeIdentificationNumber) {
		this.collegeIdentificationNumber = collegeIdentificationNumber;
	}

	public String getCurrentAddress() {
		return currentAddress;
	}

	public void setCurrentAddress(String currentAddress) {
		this.currentAddress = currentAddress;
	}

	public String getDob() {
		return dob;
	}

	public void setDob(String dob) {
		this.dob = dob;
	}

	public String getteachingExperience() {
		return teachingExperience;
	}

	public void setteachingExperience(String teachingExperience) {
		this.teachingExperience = teachingExperience;
	}

	public String getFather_husband_name() {
		return father_husband_name;
	}

	public void setFather_husband_name(String father_husband_name) {
		this.father_husband_name = father_husband_name;
	}

	public String getGenerate() {
		return this.generate;
	}

	public void setGenerate(String generate) {
		this.generate = generate;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public int getGender() {
		return gender;
	}

	public void setGender(int gender) {
		this.gender = gender;
	}

	public String getIfscCode() {
		return ifscCode;
	}

	public void setIfscCode(String ifscCode) {
		this.ifscCode = ifscCode;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getMiddleName() {
		return middleName;
	}

	public void setMiddleName(String middleName) {
		this.middleName = middleName;
	}

	public String getOfficialEmailAddress() {
		return officialEmailAddress;
	}

	public void setOfficialEmailAddress(String officialEmailAddress) {
		this.officialEmailAddress = officialEmailAddress;
	}

	public String getPanCardNo() {
		return panCardNo;
	}

	public void setPanCardNo(String panCardNo) {
		this.panCardNo = panCardNo;
	}

	public String getPermanentAddress() {
		return permanentAddress;
	}

	public void setPermanentAddress(String permanentAddress) {
		this.permanentAddress = permanentAddress;
	}

	public String getPersonalEmailAddress() {
		return personalEmailAddress;
	}

	public void setPersonalEmailAddress(String personalEmailAddress) {
		this.personalEmailAddress = personalEmailAddress;
	}

	public String getPhoneNumber() {
		return phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public byte getDisplay() {
		return this.display;
	}

	public String geteducationalQualifications() {
		return educationalQualifications;
	}

	public void seteducationalQualifications(String educationalQualifications) {
		this.educationalQualifications = educationalQualifications;
	}

	public void setDisplay(byte display) {
		this.display = display;
	}

	public Category getCategoryData() {
		return categoryData;
	}

	public void setCategoryData(Category categoryData) {
		this.categoryData = categoryData;
	}

	public Gender getGenderData() {
		return genderData;
	}

	public void setGenderData(Gender genderData) {
		this.genderData = genderData;
	}

	public String getDepartment() {
		return department;
	}

	public void setDepartment(String department) {
		this.department = department;
	}

	public String getDesignation() {
		return designation;
	}

	public void setDesignation(String designation) {
		this.designation = designation;
	}

	public CheckFacultyRegistrationField getCheck() {
		return check;
	}

	public void setCheck(CheckFacultyRegistrationField check) {
		this.check = check;
	}

	// public String getOfficialemailid() {
	// var lname = !(this.lastName == null)?(this.lastName.charAt(0) +
	// "").toLowerCase():"";
	// var dob =
	// !(this.dob==null)?(this.dob.split("-").length>1?this.dob.split("-")[2]+this.dob.split("-")[1]:this.dob.split("-")[2]):"";
	// String branch
	// =!(this.branchData==null)?(this.branchData.getAbbreviation().toLowerCase()):"";
	// var fname = !(this.firstName==null)?this.firstName.toLowerCase():"";
	// String course =
	// !(this.courseData==null)?this.courseData.getAbbreviation().replace(" ",
	// "").toLowerCase().trim().replace(".", ""):"";
	// String batch = !(this.batchData==null)?this.batchData.getBatchEnd():"";
	// var email = fname +
	// lname +
	// dob+
	// course +
	// branch
	// +batch+"@kccitm.edu.in";

	// return email;
	// }

	// public String getBranchData(String upperCase) {
	// return null;
	// }
}
