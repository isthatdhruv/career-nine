package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.Table;


/**
 * The persistent class for the test_updated_check database table.
 * 
 */
@Entity
@Table(name="test_updated_check")
// @NamedQuery(name="test_updated_check.findAll", query="SELECT t FROM test_updated_check t")
public class TestUpdatedCheck implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name="college_enrollment_number_id")
	private int collegeEnrollmentNumberId;

	@Column(name="10th_marks")
	private Boolean _0thMarks;

	@Column(name="10th_roll_no")
	private Boolean _0thRollNo;

	@Column(name="10thboard")
	private Boolean _0thboard;

	@Column(name="12th_marks_chemistry")
	private Boolean _2thMarksChemistry;

	@Column(name="12th_marks_maths")
	private Boolean _2thMarksMaths;

	@Column(name="12th_marks_physics")
	private Boolean _2thMarksPhysics;

	@Column(name="12th_roll_noss")
	private Boolean _2thRollNoss;

	@Column(name="12thboardSS")
	private Boolean _2thboardSS;

	@Column(name="aadhar_card")
	private Boolean aadharCard;

	@Column(name="aadhar_card_no")
	private Boolean aadharCardNo;

	@Column(name="adhaar_card_parents")
	private Boolean adhaarCardParents;

	@Column(name="affidavit_for_gap")
	private Boolean affidavitForGap;

	@Column(name="allotment_letter")
	private Boolean allotmentLetter;

	@Column(name="anti_ragging_affidavit")
	private Boolean antiRaggingAffidavit;

	@Column(name="Batch")
	private Boolean batch;

	@Column(name="birthday_mail")
	private Boolean birthdayMail;

	@Column(name="Branch")
	private Boolean branch;

	@Column(name="caste_certificate")
	private Boolean casteCertificate;
	
	@Column(name="category")
	private Boolean category;

	@Column(name="character_certificate")
	private Boolean characterCertificate;

	@Column(name="Course")
	private Boolean course;

	@Column(name="crypto_wallet_address")
	private Boolean cryptoWalletAddress;

	
	@Column(name="current_address")
	private Boolean currentAddress;

	private byte display;
	
	@Column(name="DOB")
	private Boolean dob;

	@Column(name="domicile_certificate_up")
	private Boolean domicileCertificateUp;


	@Column(name="email_address")
	private Boolean emailAddress;

	@Column(name="father_name")
	private Boolean fatherName;

	@Column(name="father_phone_number")
	private Boolean fatherPhoneNumber;

	@Column(name="father_photograph")
	private Boolean fatherPhotograph;

	@Column(name="first_name")
	private Boolean firstName;

	@Column(name="Gender")
	private Boolean gender;

	@Column(name="Generate")
	private Boolean generate;

	@Column(name="high_school_certificate")
	private Boolean highSchoolCertificate;

	@Column(name="high_school_marksheet")
	private Boolean highSchoolMarksheet;

	@Column(name="hindi_name")
	private Boolean hindiName;

	@Lob
	private byte[] image;

	@Column(name="income_certificate")
	private Boolean incomeCertificate;

	@Column(name="intermediate_certificate")
	private Boolean intermediateCertificate;

	@Column(name="intermediate_marksheet")
	private Boolean intermediateMarksheet;

	@Column(name="ipfs_pdf_url")
	private Boolean ipfsPdfUrl;

	@Column(name="ipfs_url")
	private Boolean ipfsUrl;

	@Column(name="last_name")
	private Boolean lastName;

	@Column(name="medical_certificate")
	private Boolean medicalCertificate;

	@Column(name="middle_name")
	private Boolean middleName;

	@Column(name="migration_certificate")
	private Boolean migrationCertificate;

	@Lob
	@Column(name="mother_name")
	private Boolean motherName;

	@Column(name="mother_photograph")
	private Boolean motherPhotograph;

	@Column(name="nft_hash_code")
	private Boolean nftHashCode;

	@Column(name="pan_card_parents")
	private Boolean panCardParents;

	@Column(name="permanent_address")
	private Boolean permanentAddress;

	@Column(name="phone_number")
	private Boolean phoneNumber;

	@Column(name="qualified_rank_letter")
	private Boolean qualifiedRankLetter;

	@Column(name="roll_no")
	private Boolean rollNo;

	@Column(name="student_photograph")
	private Boolean studentPhotograph;
	
	@Column(name="studentscol")
	private Boolean studentscol;

	@Column(name="transfer_certificate")
	private Boolean transferCertificate;

	public TestUpdatedCheck() {
	}


}