package com.kccitm.api.model;

import java.io.Serializable;
import java.util.ArrayList;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "test_faculty_check")
public class CheckFacultyRegistrationField implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "faculty_id")
	private int faculty_id;

	@Column(name = "webcam_photo")
	private boolean webcamPhoto;

	@Column(name = "aadhar_card_no")
	private boolean aadharCardNo;

	@Column(name = "first_name")
	private boolean firstName;

	@Column(name = "middle_name")
	private boolean middleName;

	@Column(name = "last_name")
	private boolean lastName;

	@Column(name = "educational_qualifications")
	private boolean educationalQualifications;

	@Column(name = "dob")
	private boolean dob;

	@Column(name = "gender")
	private boolean gender;

	@Column(name = "category")
	private boolean category;

	@Column(name = "father_husband_name")
	private boolean father_husband_name;

	@Column(name = "phone_number")
	private boolean phoneNumber;

	@Column(name = "permanent_address")
	private boolean permanentAddress;

	@Column(name = "current_address")
	private boolean currentAddress;

	@Column(name = "personal_email_address")
	private boolean personalEmailAddress;

	@Column(name = "official_email_address")
	private boolean officialEmailAddress;

	@Column(name = "bank_account_no")
	private boolean bankAccountNo;

	@Column(name = "pan_card_no")
	private boolean panCardNo;

	@Column(name = "ifsc_code")
	private boolean ifscCode;

	@Column(name = "bank_name_with_address")
	private boolean bankName;

	@Column(name = "teaching_experience")
	private boolean teachingExperience;

	@Column(name = "designation")
	private boolean designation;

	@Column(name = "department")
	private boolean department;

	public int getFaculty_id() {
		return faculty_id;
	}

	public void setFaculty_id(int faculty_id) {
		this.faculty_id = faculty_id;
	}

	public boolean getWebcamPhoto() {
		return webcamPhoto;
	}

	public void setWebcamPhoto(boolean webcamPhoto) {
		this.webcamPhoto = webcamPhoto;
	}

	public boolean getAadharCardNo() {
		return aadharCardNo;
	}

	public void setAadharCardNo(boolean aadharCardNo) {
		this.aadharCardNo = aadharCardNo;
	}

	public boolean getBankAccountNo() {
		return bankAccountNo;
	}

	public void setBankAccountNo(boolean bankAccountNo) {
		this.bankAccountNo = bankAccountNo;
	}

	public boolean getBankName() {
		return bankName;
	}

	public void setBankName(boolean bankName) {
		this.bankName = bankName;
	}

	public boolean getCategory() {
		return category;
	}

	public void setCategory(boolean category) {
		this.category = category;
	}

	public boolean getCurrentAddress() {
		return currentAddress;
	}

	public void setCurrentAddress(boolean currentAddress) {
		this.currentAddress = currentAddress;
	}

	public boolean getDob() {
		return dob;
	}

	public void setDob(boolean dob) {
		this.dob = dob;
	}

	public boolean getteachingExperience() {
		return teachingExperience;
	}

	public void setteachingExperience(boolean teachingExperience) {
		this.teachingExperience = teachingExperience;
	}

	public boolean getFather_husband_name() {
		return father_husband_name;
	}

	public void setFather_husband_name(boolean father_husband_name) {
		this.father_husband_name = father_husband_name;
	}

	public boolean getFirstName() {
		return firstName;
	}

	public void setFirstName(boolean firstName) {
		this.firstName = firstName;
	}

	public boolean getGender() {
		return gender;
	}

	public void setGender(boolean gender) {
		this.gender = gender;
	}

	public boolean getIfscCode() {
		return ifscCode;
	}

	public void setIfscCode(boolean ifscCode) {
		this.ifscCode = ifscCode;
	}

	public boolean getLastName() {
		return lastName;
	}

	public void setLastName(boolean lastName) {
		this.lastName = lastName;
	}

	public boolean getMiddleName() {
		return middleName;
	}

	public void setMiddleName(boolean middleName) {
		this.middleName = middleName;
	}

	public boolean getOfficialEmailAddress() {
		return officialEmailAddress;
	}

	public void setOfficialEmailAddress(boolean officialEmailAddress) {
		this.officialEmailAddress = officialEmailAddress;
	}

	public boolean getPanCardNo() {
		return panCardNo;
	}

	public void setPanCardNo(boolean panCardNo) {
		this.panCardNo = panCardNo;
	}

	public boolean getPermanentAddress() {
		return permanentAddress;
	}

	public void setPermanentAddress(boolean permanentAddress) {
		this.permanentAddress = permanentAddress;
	}

	public boolean getPersonalEmailAddress() {
		return personalEmailAddress;
	}

	public void setPersonalEmailAddress(boolean personalEmailAddress) {
		this.personalEmailAddress = personalEmailAddress;
	}

	public boolean getPhoneNumber() {
		return phoneNumber;
	}

	public void setPhoneNumber(boolean phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public boolean getEducationalQualifications() {
		return educationalQualifications;
	}

	public boolean getDepartment() {
		return department;
	}

	public void setDepartment(boolean department) {
		this.department = department;
	}

	public boolean getDesignation() {
		return designation;
	}

	public void setDesignation(boolean designation) {
		this.designation = designation;
	}

	public void setEducationalQualifications(boolean educationalQualifications) {
		this.educationalQualifications = educationalQualifications;
	}

	public ArrayList<String> getMissingFeilds() {
		ArrayList<String> ft = new ArrayList<>();

		if (!this.firstName)
			ft.add("First Name");
		if (!this.middleName)
			ft.add("Middle Name");
		if (!this.lastName)
			ft.add("Last Name");
		if (!this.aadharCardNo)
			ft.add("Aadhar Card Number");
		if (!this.bankAccountNo)
			ft.add("Bank Account Number");
		if (!this.bankName)
			ft.add("Bank Name With Address");
		if (!this.personalEmailAddress)
			ft.add("Email Address");
		if (!this.phoneNumber)
			ft.add("Phone Number");
		if (!this.dob)
			ft.add("Date Of Birth");
		if (!this.father_husband_name)
			ft.add("Father/Husband's Name");
		if (!this.ifscCode)
			ft.add("IFSC Code");
		if (!this.category)
			ft.add("Category");
		if (!this.gender)
			ft.add("Gender");
		if (!this.panCardNo)
			ft.add("Pan Card Number");
		if (!this.teachingExperience)
			ft.add("Teaching Experience");
		if (!this.permanentAddress)
			ft.add("Permanent Address");
		if (!this.currentAddress)
			ft.add("Current Address");
		if (!this.educationalQualifications)
			ft.add("Educational Qualifications");
		if (!this.webcamPhoto)
			ft.add("Photo");
		if (!this.designation)
			ft.add("Designation");
		if (!this.department)
			ft.add("Department");
		return ft;
	}

}
