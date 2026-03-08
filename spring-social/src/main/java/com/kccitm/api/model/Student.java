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

/**
 * The persistent class for the testing_students database table.
 * 
 */
@Entity
@Table(name = "testing_students")
// @NamedQuery(name="TestingStudent.findAll", query="SELECT t FROM
// TestingStudent t")
public class Student implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "college_enrollment_number")
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int collegeEnrollmentNumber;

	@Column(name = "10th_marks")
	private String _0thMarks;

	@Column(name = "10th_roll_no")
	private String _0thRollNo;

	@Column(name = "10thboard")
	private int _0thboard;

	@Column(name = "12th_marks_chemistry")
	private String _2thMarksChemistry;

	@Column(name = "12th_marks_maths")
	private String _2thMarksMaths;

	@Column(name = "12th_marks_physics")
	private String _2thMarksPhysics;

	@Column(name = "12th_roll_noss")
	private String _2thRollNoss;

	@Column(name = "12thboardSS")
	private int _2thboardSS;

	@Column(name = "aadhar_card")
	private String aadharCard;

	@Column(name = "aadhar_card_no")
	private String aadharCardNo;

	@Column(name = "aadhar_card_physical")
	private byte aadharCardPhysical;

	@Column(name = "adhaar_card_parents")
	private String adhaarCardParents;

	@Column(name = "adhaar_card_parents_physical")
	private byte adhaarCardParentsPhysical;

	@Column(name = "affidavit_for_gap")
	private String affidavitForGap;

	@Column(name = "affidavit_for_gap_physical")
	private byte affidavitForGapPhysical;

	@Column(name = "allotment_letter")
	private String allotmentLetter;

	@Column(name = "allotment_letter_physical")
	private byte allotmentLetterPhysical;

	@Column(name = "anti_ragging_affidavit")
	private String antiRaggingAffidavit;

	@Column(name = "anti_ragging_affidavit_physical")
	private byte antiRaggingAffidavitPhysical;

	@Column(name = "Batch_id")
	private int batch_id;

	@Column(name = "birthday_mail")
	private String birthdayMail;

	@Column(name = "Branch_id")
	private int branch_id;

	@Column(name = "caste_certificate")
	private String casteCertificate;

	@Column(name = "caste_certificate_physical")
	private byte casteCertificatePhysical;

	private int category;

	@Column(name = "character_certificate")
	private String characterCertificate;

	@Column(name = "character_certificate_physical")
	private byte characterCertificatePhysical;

	@Column(name = "Course")
	private int course;

	@Column(name = "crypto_wallet_address")
	private String cryptoWalletAddress;

	@Lob
	@Column(name = "current_address")
	private String currentAddress;

	private byte display;

	@Lob
	@Column(name = "DOB")
	private String dob;

	@Column(name = "domicile_certificate_up")
	private String domicileCertificateUp;

	@Column(name = "domicile_certificate_up_physical")
	private byte domicileCertificateUpPhysical;

	@Lob
	@Column(name = "father_name")
	private String fatherName;

	@Column(name = "father_phone_number")
	private String fatherPhoneNumber;

	@Column(name = "father_photograph")
	private String fatherPhotograph;

	@Column(name = "father_photograph_physical")
	private byte fatherPhotographPhysical;

	@Column(name = "first_name")
	private String firstName;

	@Column(name = "Gender")
	private int gender;

	@Column(name = "Generate")
	private String generate;

	@Column(name = "high_school_certificate")
	private String highSchoolCertificate;

	@Column(name = "high_school_certificate_physical")
	private byte highSchoolCertificatePhysical;

	@Column(name = "high_school_marksheet")
	private String highSchoolMarksheet;

	@Column(name = "high_school_marksheet_physical")
	private byte highSchoolMarksheetPhysical;

	@Column(name = "hindi_name")
	private String hindiName;

	@Lob
	private byte[] image;

	@Column(name = "income_certificate")
	private String incomeCertificate;

	@Column(name = "income_certificate_physical")
	private byte incomeCertificatePhysical;

	@Column(name = "intermediate_certificate")
	private String intermediateCertificate;

	@Column(name = "intermediate_certificate_physical")
	private byte intermediateCertificatePhysical;

	@Column(name = "intermediate_marksheet")
	private String intermediateMarksheet;

	@Column(name = "intermediate_marksheet_physical")
	private byte intermediateMarksheetPhysical;

	@Column(name = "ipfs_pdf_url")
	private String ipfsPdfUrl;

	@Column(name = "ipfs_url")
	private String ipfsUrl;

	@Column(name = "last_name")
	private String lastName;

	@Column(name = "medical_certificate")
	private String medicalCertificate;

	@Column(name = "medical_certificate_physical")
	private byte medicalCertificatePhysical;

	@Column(name = "middle_name")
	private String middleName;

	@Column(name = "migration_certificate")
	private String migrationCertificate;

	@Column(name = "migration_certificate_physical")
	private byte migrationCertificatePhysical;

	@Lob
	@Column(name = "mother_name")
	private String motherName;

	@Column(name = "mother_photograph")
	private String motherPhotograph;

	@Column(name = "mother_photograph_physical")
	private byte motherPhotographPhysical;

	@Column(name = "nft_hash_code")
	private String nftHashCode;

	@Lob
	@Column(name = "official_email_address")
	private String officialEmailAddress;

	@Column(name = "pan_card_parents")
	private String panCardParents;

	@Column(name = "pan_card_parents_physical")
	private byte panCardParentsPhysical;

	@Lob
	private byte[] pdf;

	@Lob
	@Column(name = "permanent_address")
	private String permanentAddress;

	@Lob
	@Column(name = "personal_email_address")
	private String personalEmailAddress;

	@Column(name = "phone_number")
	private String phoneNumber;

	@Column(name = "qualified_rank_letter")
	private String qualifiedRankLetter;

	@Column(name = "qualified_rank_letter_physical")
	private byte qualifiedRankLetterPhysical;

	@Column(name = "roll_no")
	private Integer rollNo;

	@Column(name = "student_photograph")
	private String studentPhotograph;

	@Column(name = "student_photograph_physical")
	private byte studentPhotographPhysical;

	@Column(name = "student_signature")
	private String studentSignature;

	@Column(name = "student_signature_physical")
	private byte studentSignaturePhysical;

	@Column(name = "student_thumb_impression")
	private String studentThumbImpression;

	@Column(name = "student_thumb_impression_physical")
	private byte studentThumbImpressionPhysical;

	private String studentscol;

	@Column(name = "transfer_certificate")
	private String transferCertificate;

	@Column(name = "transfer_certificate_physical")
	private byte transferCertificatePhysical;

	@Column(name = "type_of_student")
	private String typeOfStudent;

	@Column(name = "webcam_photo")
	private String webcamPhoto;

	@Column(name = "ews")
	private Boolean ews;

	@Column(name = "sub_category")
	private String subCategory;

	@Column(name = "counselling")
	private Boolean counselling;

	@Column(name = "home_board_12th")
	private Boolean homeBoard12th;

	@Column(name = "google_group")
	private String googleGroup;

	@Transient
	private String other10thBoard;

	@Transient
	private String other12thBoard;

	@Transient
	private CheckRegistrationFeild check;

	@Transient
	private InstituteBatch instituteBatch;

	@Transient
	private InstituteBranch instituteBranch;

	@Transient
	private ArrayList<String> instituteGoogleGroup;

	@Transient
	private Gender genderData;

	@Transient
	private Category categoryData;

	@Transient
	private InstituteCourse courseData;

	@Transient
	private InstituteBranch branchData;

	@Transient
	private InstituteBatch batchData;

	@Column(name = "google")
	private boolean google;

	public Student() {
	}

	public int getCollegeEnrollmentNumber() {
		return this.collegeEnrollmentNumber;
	}

	public void setCollegeEnrollmentNumber(int collegeEnrollmentNumber) {
		this.collegeEnrollmentNumber = collegeEnrollmentNumber;
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

	public int get_0thboard() {
		return this._0thboard;
	}

	public void set_0thboard(int _0thboard) {
		this._0thboard = _0thboard;
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

	public String get_2thRollNoss() {
		return this._2thRollNoss;
	}

	public void set_2thRollNoss(String _2thRollNoss) {
		this._2thRollNoss = _2thRollNoss;
	}

	public int get_2thboardSS() {
		return this._2thboardSS;
	}

	public void set_2thboardSS(int _2thboardSS) {
		this._2thboardSS = _2thboardSS;
	}

	public String getAadharCard() {
		return this.aadharCard;
	}

	public void setAadharCard(String aadharCard) {
		this.aadharCard = aadharCard;
	}

	public String getAadharCardNo() {
		return this.aadharCardNo;
	}

	public void setAadharCardNo(String aadharCardNo) {
		this.aadharCardNo = aadharCardNo;
	}

	public byte getAadharCardPhysical() {
		return this.aadharCardPhysical;
	}

	public void setAadharCardPhysical(byte aadharCardPhysical) {
		this.aadharCardPhysical = aadharCardPhysical;
	}

	public String getAdhaarCardParents() {
		return this.adhaarCardParents;
	}

	public void setAdhaarCardParents(String adhaarCardParents) {
		this.adhaarCardParents = adhaarCardParents;
	}

	public byte getAdhaarCardParentsPhysical() {
		return this.adhaarCardParentsPhysical;
	}

	public void setAdhaarCardParentsPhysical(byte adhaarCardParentsPhysical) {
		this.adhaarCardParentsPhysical = adhaarCardParentsPhysical;
	}

	public String getAffidavitForGap() {
		return this.affidavitForGap;
	}

	public void setAffidavitForGap(String affidavitForGap) {
		this.affidavitForGap = affidavitForGap;
	}

	public byte getAffidavitForGapPhysical() {
		return this.affidavitForGapPhysical;
	}

	public void setAffidavitForGapPhysical(byte affidavitForGapPhysical) {
		this.affidavitForGapPhysical = affidavitForGapPhysical;
	}

	public String getAllotmentLetter() {
		return this.allotmentLetter;
	}

	public void setAllotmentLetter(String allotmentLetter) {
		this.allotmentLetter = allotmentLetter;
	}

	public byte getAllotmentLetterPhysical() {
		return this.allotmentLetterPhysical;
	}

	public void setAllotmentLetterPhysical(byte allotmentLetterPhysical) {
		this.allotmentLetterPhysical = allotmentLetterPhysical;
	}

	public String getAntiRaggingAffidavit() {
		return this.antiRaggingAffidavit;
	}

	public void setAntiRaggingAffidavit(String antiRaggingAffidavit) {
		this.antiRaggingAffidavit = antiRaggingAffidavit;
	}

	public byte getAntiRaggingAffidavitPhysical() {
		return this.antiRaggingAffidavitPhysical;
	}

	public void setAntiRaggingAffidavitPhysical(byte antiRaggingAffidavitPhysical) {
		this.antiRaggingAffidavitPhysical = antiRaggingAffidavitPhysical;
	}

	public int getBatch_id() {
		return this.batch_id;
	}

	public void setBatch_id(int batch_id) {
		this.batch_id = batch_id;
	}

	public String getBirthdayMail() {
		return this.birthdayMail;
	}

	public void setBirthdayMail(String birthdayMail) {
		this.birthdayMail = birthdayMail;
	}

	public int getBranch_id() {
		return this.branch_id;
	}

	public void setBranch_id(int branch_id) {
		this.branch_id = branch_id;
	}

	public String getCasteCertificate() {
		return this.casteCertificate;
	}

	public void setCasteCertificate(String casteCertificate) {
		this.casteCertificate = casteCertificate;
	}

	public byte getCasteCertificatePhysical() {
		return this.casteCertificatePhysical;
	}

	public void setCasteCertificatePhysical(byte casteCertificatePhysical) {
		this.casteCertificatePhysical = casteCertificatePhysical;
	}

	public int getCategory() {
		return this.category;
	}

	public void setCategory(int category) {
		this.category = category;
	}

	public String getCharacterCertificate() {
		return this.characterCertificate;
	}

	public void setCharacterCertificate(String characterCertificate) {
		this.characterCertificate = characterCertificate;
	}

	public byte getCharacterCertificatePhysical() {
		return this.characterCertificatePhysical;
	}

	public void setCharacterCertificatePhysical(byte characterCertificatePhysical) {
		this.characterCertificatePhysical = characterCertificatePhysical;
	}

	public Integer getCourse() {
		return this.course;
	}

	public void setCourse(int course) {
		this.course = course;
	}

	public String getCryptoWalletAddress() {
		return this.cryptoWalletAddress;
	}

	public void setCryptoWalletAddress(String cryptoWalletAddress) {
		this.cryptoWalletAddress = cryptoWalletAddress;
	}

	public String getCurrentAddress() {
		return this.currentAddress;
	}

	public void setCurrentAddress(String currentAddress) {
		this.currentAddress = currentAddress;
	}

	public byte getDisplay() {
		return this.display;
	}

	public void setDisplay(byte display) {
		this.display = display;
	}

	public String getDob() {
		return this.dob;
	}

	public void setDob(String dob) {
		this.dob = dob;
	}

	public String getDomicileCertificateUp() {
		return this.domicileCertificateUp;
	}

	public void setDomicileCertificateUp(String domicileCertificateUp) {
		this.domicileCertificateUp = domicileCertificateUp;
	}

	public byte getDomicileCertificateUpPhysical() {
		return this.domicileCertificateUpPhysical;
	}

	public void setDomicileCertificateUpPhysical(byte domicileCertificateUpPhysical) {
		this.domicileCertificateUpPhysical = domicileCertificateUpPhysical;
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

	public String getFatherPhotograph() {
		return this.fatherPhotograph;
	}

	public void setFatherPhotograph(String fatherPhotograph) {
		this.fatherPhotograph = fatherPhotograph;
	}

	public byte getFatherPhotographPhysical() {
		return this.fatherPhotographPhysical;
	}

	public void setFatherPhotographPhysical(byte fatherPhotographPhysical) {
		this.fatherPhotographPhysical = fatherPhotographPhysical;
	}

	public String getFirstName() {
		return this.firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public int getGender() {
		return this.gender;
	}

	public void setGender(int gender) {
		this.gender = gender;
	}

	public String getGenerate() {
		return this.generate;
	}

	public void setGenerate(String generate) {
		this.generate = generate;
	}

	public String getHighSchoolCertificate() {
		return this.highSchoolCertificate;
	}

	public void setHighSchoolCertificate(String highSchoolCertificate) {
		this.highSchoolCertificate = highSchoolCertificate;
	}

	public byte getHighSchoolCertificatePhysical() {
		return this.highSchoolCertificatePhysical;
	}

	public void setHighSchoolCertificatePhysical(byte highSchoolCertificatePhysical) {
		this.highSchoolCertificatePhysical = highSchoolCertificatePhysical;
	}

	public String getHighSchoolMarksheet() {
		return this.highSchoolMarksheet;
	}

	public void setHighSchoolMarksheet(String highSchoolMarksheet) {
		this.highSchoolMarksheet = highSchoolMarksheet;
	}

	public byte getHighSchoolMarksheetPhysical() {
		return this.highSchoolMarksheetPhysical;
	}

	public void setHighSchoolMarksheetPhysical(byte highSchoolMarksheetPhysical) {
		this.highSchoolMarksheetPhysical = highSchoolMarksheetPhysical;
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

	public String getIncomeCertificate() {
		return this.incomeCertificate;
	}

	public void setIncomeCertificate(String incomeCertificate) {
		this.incomeCertificate = incomeCertificate;
	}

	public byte getIncomeCertificatePhysical() {
		return this.incomeCertificatePhysical;
	}

	public void setIncomeCertificatePhysical(byte incomeCertificatePhysical) {
		this.incomeCertificatePhysical = incomeCertificatePhysical;
	}

	public String getIntermediateCertificate() {
		return this.intermediateCertificate;
	}

	public void setIntermediateCertificate(String intermediateCertificate) {
		this.intermediateCertificate = intermediateCertificate;
	}

	public byte getIntermediateCertificatePhysical() {
		return this.intermediateCertificatePhysical;
	}

	public void setIntermediateCertificatePhysical(byte intermediateCertificatePhysical) {
		this.intermediateCertificatePhysical = intermediateCertificatePhysical;
	}

	public String getIntermediateMarksheet() {
		return this.intermediateMarksheet;
	}

	public void setIntermediateMarksheet(String intermediateMarksheet) {
		this.intermediateMarksheet = intermediateMarksheet;
	}

	public byte getIntermediateMarksheetPhysical() {
		return this.intermediateMarksheetPhysical;
	}

	public void setIntermediateMarksheetPhysical(byte intermediateMarksheetPhysical) {
		this.intermediateMarksheetPhysical = intermediateMarksheetPhysical;
	}

	public String getIpfsPdfUrl() {
		return this.ipfsPdfUrl;
	}

	public void setIpfsPdfUrl(String ipfsPdfUrl) {
		this.ipfsPdfUrl = ipfsPdfUrl;
	}

	public String getIpfsUrl() {
		return this.ipfsUrl;
	}

	public void setIpfsUrl(String ipfsUrl) {
		this.ipfsUrl = ipfsUrl;
	}

	public String getLastName() {
		return this.lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getMedicalCertificate() {
		return this.medicalCertificate;
	}

	public void setMedicalCertificate(String medicalCertificate) {
		this.medicalCertificate = medicalCertificate;
	}

	public byte getMedicalCertificatePhysical() {
		return this.medicalCertificatePhysical;
	}

	public void setMedicalCertificatePhysical(byte medicalCertificatePhysical) {
		this.medicalCertificatePhysical = medicalCertificatePhysical;
	}

	public String getMiddleName() {
		return this.middleName;
	}

	public void setMiddleName(String middleName) {
		this.middleName = middleName;
	}

	public String getMigrationCertificate() {
		return this.migrationCertificate;
	}

	public void setMigrationCertificate(String migrationCertificate) {
		this.migrationCertificate = migrationCertificate;
	}

	public byte getMigrationCertificatePhysical() {
		return this.migrationCertificatePhysical;
	}

	public void setMigrationCertificatePhysical(byte migrationCertificatePhysical) {
		this.migrationCertificatePhysical = migrationCertificatePhysical;
	}

	public String getMotherName() {
		return this.motherName;
	}

	public void setMotherName(String motherName) {
		this.motherName = motherName;
	}

	public String getMotherPhotograph() {
		return this.motherPhotograph;
	}

	public void setMotherPhotograph(String motherPhotograph) {
		this.motherPhotograph = motherPhotograph;
	}

	public byte getMotherPhotographPhysical() {
		return this.motherPhotographPhysical;
	}

	public void setMotherPhotographPhysical(byte motherPhotographPhysical) {
		this.motherPhotographPhysical = motherPhotographPhysical;
	}

	public String getNftHashCode() {
		return this.nftHashCode;
	}

	public void setNftHashCode(String nftHashCode) {
		this.nftHashCode = nftHashCode;
	}

	public String getOfficialEmailAddress() {
		return this.officialEmailAddress;
	}

	public void setOfficialEmailAddress(String officialEmailAddress) {
		this.officialEmailAddress = officialEmailAddress;
	}

	public String getPanCardParents() {
		return this.panCardParents;
	}

	public void setPanCardParents(String panCardParents) {
		this.panCardParents = panCardParents;
	}

	public byte getPanCardParentsPhysical() {
		return this.panCardParentsPhysical;
	}

	public void setPanCardParentsPhysical(byte panCardParentsPhysical) {
		this.panCardParentsPhysical = panCardParentsPhysical;
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

	public String getPersonalEmailAddress() {
		return this.personalEmailAddress;
	}

	public void setPersonalEmailAddress(String personalEmailAddress) {
		this.personalEmailAddress = personalEmailAddress;
	}

	public String getPhoneNumber() {
		return this.phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public String getQualifiedRankLetter() {
		return this.qualifiedRankLetter;
	}

	public void setQualifiedRankLetter(String qualifiedRankLetter) {
		this.qualifiedRankLetter = qualifiedRankLetter;
	}

	public byte getQualifiedRankLetterPhysical() {
		return this.qualifiedRankLetterPhysical;
	}

	public void setQualifiedRankLetterPhysical(byte qualifiedRankLetterPhysical) {
		this.qualifiedRankLetterPhysical = qualifiedRankLetterPhysical;
	}

	public Integer getRollNo() {
		return this.rollNo;
	}

	public void setRollNo(Integer rollNo) {
		this.rollNo = rollNo;
	}

	public String getStudentPhotograph() {
		return this.studentPhotograph;
	}

	public void setStudentPhotograph(String studentPhotograph) {
		this.studentPhotograph = studentPhotograph;
	}

	public byte getStudentPhotographPhysical() {
		return this.studentPhotographPhysical;
	}

	public void setStudentPhotographPhysical(byte studentPhotographPhysical) {
		this.studentPhotographPhysical = studentPhotographPhysical;
	}

	public String getStudentSignature() {
		return this.studentSignature;
	}

	public void setStudentSignature(String studentSignature) {
		this.studentSignature = studentSignature;
	}

	public byte getStudentSignaturePhysical() {
		return this.studentSignaturePhysical;
	}

	public void setStudentSignaturePhysical(byte studentSignaturePhysical) {
		this.studentSignaturePhysical = studentSignaturePhysical;
	}

	public String getStudentThumbImpression() {
		return this.studentThumbImpression;
	}

	public void setStudentThumbImpression(String studentThumbImpression) {
		this.studentThumbImpression = studentThumbImpression;
	}

	public byte getStudentThumbImpressionPhysical() {
		return this.studentThumbImpressionPhysical;
	}

	public void setStudentThumbImpressionPhysical(byte studentThumbImpressionPhysical) {
		this.studentThumbImpressionPhysical = studentThumbImpressionPhysical;
	}

	public String getStudentscol() {
		return this.studentscol;
	}

	public void setStudentscol(String studentscol) {
		this.studentscol = studentscol;
	}

	public String getTransferCertificate() {
		return this.transferCertificate;
	}

	public void setTransferCertificate(String transferCertificate) {
		this.transferCertificate = transferCertificate;
	}

	public byte getTransferCertificatePhysical() {
		return this.transferCertificatePhysical;
	}

	public void setTransferCertificatePhysical(byte transferCertificatePhysical) {
		this.transferCertificatePhysical = transferCertificatePhysical;
	}

	public String getTypeOfStudent() {
		return this.typeOfStudent;
	}

	public void setTypeOfStudent(String typeOfStudent) {
		this.typeOfStudent = typeOfStudent;
	}

	public String getWebcamPhoto() {
		return this.webcamPhoto;
	}

	public void setWebcamPhoto(String webcamPhoto) {
		this.webcamPhoto = webcamPhoto;
	}

	public Boolean getEws() {
		return ews;
	}

	public void setEws(Boolean ews) {
		this.ews = ews;
	}

	public Boolean getHomeBoard12th() {
		return homeBoard12th;
	}

	public void setHomeBoard12th(Boolean homeBoard12th) {
		this.homeBoard12th = homeBoard12th;
	}

	public InstituteBatch getInstituteBatch() {
		return instituteBatch;
	}

	public void setInstituteBatch(InstituteBatch instituteBatch) {
		this.instituteBatch = instituteBatch;
	}

	public InstituteBranch getInstituteBranch() {
		return instituteBranch;
	}

	public void setInstituteBranch(InstituteBranch instituteBranch) {
		this.instituteBranch = instituteBranch;
	}

	public ArrayList<String> getInstituteGoogleGroup() {
		return instituteGoogleGroup;
	}

	public void setInstituteGoogleGroup(ArrayList<String> instituteGoogleGroup) {
		this.instituteGoogleGroup = instituteGoogleGroup;
	}

	public CheckRegistrationFeild getCheck() {
		return check;
	}

	public void setCheck(CheckRegistrationFeild check) {
		this.check = check;
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

	public InstituteCourse getCourseData() {
		return courseData;
	}

	public void setCourseData(InstituteCourse courseData) {
		this.courseData = courseData;
	}

	public InstituteBranch getBranchData() {
		return this.branchData;
	}

	public void setBranchData(InstituteBranch branchData) {
		this.branchData = branchData;
	}

	public InstituteBatch getBatchData() {
		return this.batchData;
	}

	public void setBatchData(InstituteBatch batchData) {
		this.batchData = batchData;

	}

	public String getOther10thBoard() {
		return other10thBoard;
	}

	public void setOther10thBoard(String other10thBoard) {
		this.other10thBoard = other10thBoard;
	}

	public String getOther12thBoard() {
		return other12thBoard;
	}

	public void setOther12thBoard(String other12thBoard) {
		this.other12thBoard = other12thBoard;
	}

	public Boolean getCounselling() {
		return counselling;
	}

	public void setCounselling(Boolean counselling) {
		this.counselling = counselling;
	}

	public String getSubCategory() {
		return subCategory;
	}

	public void setSubCategory(String subCategory) {
		this.subCategory = subCategory;
	}

	public String getGoogleGroup() {
		return googleGroup;
	}

	public void setGoogleGroup(String googleGroup) {
		this.googleGroup = googleGroup;
	}

	public String getBranchData(String upperCase) {
		return null;
	}



	public boolean isGoogle() {
		return google;
	}

	public boolean getGoogle() {
		return google;
	}

	public void setGoogle(boolean google) {
		this.google = google;
	}

}

