package com.kccitm.api.model;

import java.io.Serializable;
import java.util.ArrayList;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "test_updated_check")
public class CheckRegistrationFeild implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@Column(name = "student_id")
	private int student_id;

	@Column(name = "student_signature")
	private boolean studentSignature;

	@Column(name = "student_thumb_impression")
	private boolean studentThumbImpression;

	@Column(name = "_0th_marks")
	private boolean _0th_marks;

	@Column(name = "_0th_roll_no")
	private boolean _0th_roll_no;

	@Column(name = "_0th_board")
	private boolean _0th_board;

	@Column(name = "_2th_marks_chem")
	private boolean _2th_marks_chem;

	@Column(name = "_2th_marks_maths")
	private boolean _2th_marks_maths;

	@Column(name = "_2th_marks_physics")
	private boolean _2th_marks_physics;

	@Column(name = "_2th_roll_no_ss")
	private boolean _2th_roll_no_ss;

	@Column(name = "_2th_board_SS")
	private boolean _2th_board_SS;

	@Column(name = "aadhar_card")
	private boolean aadhar_card;

	@Column(name = "aadhar_card_no")
	private boolean aadhar_card_no;

	@Column(name = "adhaar_card_parents")
	private boolean adhaarCardParents;

	@Column(name = "affidavit_for_gap")
	private boolean affidavitForGap;

	@Column(name = "allotment_letter")
	private boolean allotmentLetter;

	@Column(name = "anti_ragging_affidavit")
	private boolean antiRaggingAffidavit;

	@Column(name = "batch")
	private boolean batch;

	@Column(name = "birthday_mail")
	private boolean birthdayMail;

	@Column(name = "branch")
	private boolean branch;

	@Column(name = "caste_certificate")
	private boolean casteCertificate;

	@Column(name = "category")
	private boolean category;

	@Column(name = "character_certificate")
	private boolean characterCertificate;

	@Column(name = "course")
	private boolean course;

	@Column(name = "crypto_wallet_address")
	private boolean cryptoWalletAddress;

	@Column(name = "current_address")
	private boolean current_address;

	private boolean display;

	@Column(name = "dob")
	private boolean dob;

	@Column(name = "domicile_certificate_up")
	private boolean domicileCertificateUp;

	@Column(name = "email_address")
	private boolean email_address;

	@Column(name = "father_name")
	private boolean father_name;

	@Column(name = "father_phone_number")
	private boolean father_phone_number;

	@Column(name = "father_photograph")
	private boolean fatherPhotograph;

	@Column(name = "first_name")
	private boolean first_name;

	@Column(name = "gender")
	private boolean gender;

	@Column(name = "generate")
	private boolean generate;

	@Column(name = "high_school_certificate")
	private boolean highSchoolCertificate;

	@Column(name = "high_school_marksheet")
	private boolean highSchoolMarksheet;

	@Column(name = "hindi_name")
	private boolean hindiName;

	private boolean image;

	@Column(name = "income_certificate")
	private boolean incomeCertificate;

	@Column(name = "intermediate_certificate")
	private boolean intermediateCertificate;

	@Column(name = "intermediate_marksheet")
	private boolean intermediateMarksheet;

	@Column(name = "ipfs_pdf_url")
	private boolean ipfsPdfUrl;

	@Column(name = "ipfs_url")
	private boolean ipfsUrl;

	@Column(name = "last_name")
	private boolean last_name;

	@Column(name = "medical_certificate")
	private boolean medicalCertificate;

	@Column(name = "middle_name")
	private boolean middle_name;

	@Column(name = "migration_certificate")
	private boolean migrationCertificate;

	@Column(name = "mother_name")
	private boolean mother_name;

	@Column(name = "mother_photograph")
	private boolean motherPhotograph;

	@Column(name = "nft_hash_code")
	private boolean nftHashCode;

	@Column(name = "pan_card_parents")
	private boolean panCardParents;

	private boolean pdf;

	@Column(name = "permanent_address")
	private boolean permanent_address;

	@Column(name = "phone_number")
	private boolean phone_number;

	@Column(name = "qualified_rank_letter")
	private boolean qualifiedRankLetter;

	@Column(name = "roll_no")
	private boolean rollNo;

	@Column(name = "student_photograph")
	private boolean studentPhotograph;

	private boolean studentscol;

	@Column(name = "transfer_certificate")
	private boolean transferCertificate;

	@Column(name = "webcam_photo")
	private boolean webcam_photo;

	// @Column(name = "other_10th_board")
	// private boolean other_10th_board;

	// @Column(name = "other_12th_board")
	// private boolean other_12th_board;

	@Column(name = "sub_category")
	private boolean sub_category;

	public CheckRegistrationFeild() {
	}

	public boolean get_0th_marks() {
		return this._0th_marks;
	}

	public void set_0th_marks(boolean _0th_marks) {
		this._0th_marks = _0th_marks;
	}

	public boolean get_0th_roll_no() {
		return this._0th_roll_no;
	}

	public void set_0th_roll_no(boolean _0th_roll_no) {
		this._0th_roll_no = _0th_roll_no;
	}

	public boolean get_0th_board() {
		return this._0th_board;
	}

	public void set_0th_board(boolean _0th_board) {
		this._0th_board = _0th_board;
	}

	public boolean get_2th_marks_chem() {
		return this._2th_marks_chem;
	}

	public void set_2th_marks_chem(boolean _2th_marks_chem) {
		this._2th_marks_chem = _2th_marks_chem;
	}

	public boolean get_2th_marks_maths() {
		return this._2th_marks_maths;
	}

	public void set_2th_marks_maths(boolean _2th_marks_maths) {
		this._2th_marks_maths = _2th_marks_maths;
	}

	public boolean get_2th_marks_physics() {
		return this._2th_marks_physics;
	}

	public void set_2th_marks_physics(boolean _2th_marks_physics) {
		this._2th_marks_physics = _2th_marks_physics;
	}

	public boolean get_2th_roll_no_ss() {
		return this._2th_roll_no_ss;
	}

	public void set_2th_roll_no_ss(boolean _2th_roll_no_ss) {
		this._2th_roll_no_ss = _2th_roll_no_ss;
	}

	public boolean get_2th_board_SS() {
		return this._2th_board_SS;
	}

	public void set_2th_board_SS(boolean _2th_board_SS) {
		this._2th_board_SS = _2th_board_SS;
	}

	public boolean getaadhar_card() {
		return this.aadhar_card;
	}

	public void setaadhar_card(boolean aadhar_card) {
		this.aadhar_card = aadhar_card;
	}

	public boolean getaadhar_card_no() {
		return this.aadhar_card_no;
	}

	public void setaadhar_card_no(boolean aadhar_card_no) {
		this.aadhar_card_no = aadhar_card_no;
	}

	public boolean getAdhaarCardParents() {
		return this.adhaarCardParents;
	}

	public void setAdhaarCardParents(boolean adhaarCardParents) {
		this.adhaarCardParents = adhaarCardParents;
	}

	public boolean getAffidavitForGap() {
		return this.affidavitForGap;
	}

	public void setAffidavitForGap(boolean affidavitForGap) {
		this.affidavitForGap = affidavitForGap;
	}

	public boolean getAllotmentLetter() {
		return this.allotmentLetter;
	}

	public void setAllotmentLetter(boolean allotmentLetter) {
		this.allotmentLetter = allotmentLetter;
	}

	public boolean getAntiRaggingAffidavit() {
		return this.antiRaggingAffidavit;
	}

	public void setAntiRaggingAffidavit(boolean antiRaggingAffidavit) {
		this.antiRaggingAffidavit = antiRaggingAffidavit;
	}

	public boolean getBatch() {
		return this.batch;
	}

	public void setBatch(boolean batch) {
		this.batch = batch;
	}

	public boolean getBirthdayMail() {
		return this.birthdayMail;
	}

	public void setBirthdayMail(boolean birthdayMail) {
		this.birthdayMail = birthdayMail;
	}

	public boolean getBranch() {
		return this.branch;
	}

	public void setBranch(boolean branch) {
		this.branch = branch;
	}

	public boolean getCasteCertificate() {
		return this.casteCertificate;
	}

	public void setCasteCertificate(boolean casteCertificate) {
		this.casteCertificate = casteCertificate;
	}

	public boolean getCategory() {
		return this.category;
	}

	public void setCategory(boolean category) {
		this.category = category;
	}

	public boolean getCharacterCertificate() {
		return this.characterCertificate;
	}

	public void setCharacterCertificate(boolean characterCertificate) {
		this.characterCertificate = characterCertificate;
	}

	public boolean getCourse() {
		return this.course;
	}

	public void setCourse(boolean course) {
		this.course = course;
	}

	public boolean getCryptoWalletAddress() {
		return this.cryptoWalletAddress;
	}

	public void setCryptoWalletAddress(boolean cryptoWalletAddress) {
		this.cryptoWalletAddress = cryptoWalletAddress;
	}

	public boolean getcurrent_address() {
		return this.current_address;
	}

	public void setcurrent_address(boolean current_address) {
		this.current_address = current_address;
	}

	public boolean getDisplay() {
		return this.display;
	}

	public void setDisplay(boolean display) {
		this.display = display;
	}

	public boolean getdob() {
		return this.dob;
	}

	public void setdob(boolean dob) {
		this.dob = dob;
	}

	public boolean getDomicileCertificateUp() {
		return this.domicileCertificateUp;
	}

	public void setDomicileCertificateUp(boolean domicileCertificateUp) {
		this.domicileCertificateUp = domicileCertificateUp;
	}

	public boolean getemail_address() {
		return this.email_address;
	}

	public void setemail_address(boolean email_address) {
		this.email_address = email_address;
	}

	public boolean getfather_name() {
		return this.father_name;
	}

	public void setfather_name(boolean father_name) {
		this.father_name = father_name;
	}

	public boolean getfather_phone_number() {
		return this.father_phone_number;
	}

	public void setfather_phone_number(boolean father_phone_number) {
		this.father_phone_number = father_phone_number;
	}

	public boolean getFatherPhotograph() {
		return this.fatherPhotograph;
	}

	public void setFatherPhotograph(boolean fatherPhotograph) {
		this.fatherPhotograph = fatherPhotograph;
	}

	public boolean getfirst_name() {
		return this.first_name;
	}

	public void setfirst_name(boolean first_name) {
		this.first_name = first_name;
	}

	public boolean getGender() {
		return this.gender;
	}

	public void setGender(boolean gender) {
		this.gender = gender;
	}

	public boolean getGenerate() {
		return this.generate;
	}

	public void setGenerate(boolean generate) {
		this.generate = generate;
	}

	public boolean getHighSchoolCertificate() {
		return this.highSchoolCertificate;
	}

	public void setHighSchoolCertificate(boolean highSchoolCertificate) {
		this.highSchoolCertificate = highSchoolCertificate;
	}

	public boolean getHighSchoolMarksheet() {
		return this.highSchoolMarksheet;
	}

	public void setHighSchoolMarksheet(boolean highSchoolMarksheet) {
		this.highSchoolMarksheet = highSchoolMarksheet;
	}

	public boolean getHindiName() {
		return this.hindiName;
	}

	public void setHindiName(boolean hindiName) {
		this.hindiName = hindiName;
	}

	public boolean getImage() {
		return this.image;
	}

	public void setImage(boolean image) {
		this.image = image;
	}

	public boolean getIncomeCertificate() {
		return this.incomeCertificate;
	}

	public void setIncomeCertificate(boolean incomeCertificate) {
		this.incomeCertificate = incomeCertificate;
	}

	public boolean getIntermediateCertificate() {
		return this.intermediateCertificate;
	}

	public void setIntermediateCertificate(boolean intermediateCertificate) {
		this.intermediateCertificate = intermediateCertificate;
	}

	public boolean getIntermediateMarksheet() {
		return this.intermediateMarksheet;
	}

	public void setIntermediateMarksheet(boolean intermediateMarksheet) {
		this.intermediateMarksheet = intermediateMarksheet;
	}

	public boolean getIpfsPdfUrl() {
		return this.ipfsPdfUrl;
	}

	public void setIpfsPdfUrl(boolean ipfsPdfUrl) {
		this.ipfsPdfUrl = ipfsPdfUrl;
	}

	public boolean getIpfsUrl() {
		return this.ipfsUrl;
	}

	public void setIpfsUrl(boolean ipfsUrl) {
		this.ipfsUrl = ipfsUrl;
	}

	public boolean getlast_name() {
		return this.last_name;
	}

	public void setlast_name(boolean last_name) {
		this.last_name = last_name;
	}

	public boolean getMedicalCertificate() {
		return this.medicalCertificate;
	}

	public void setMedicalCertificate(boolean medicalCertificate) {
		this.medicalCertificate = medicalCertificate;
	}

	public boolean getmiddle_name() {
		return this.middle_name;
	}

	public void setmiddle_name(boolean middle_name) {
		this.middle_name = middle_name;
	}

	public boolean getMigrationCertificate() {
		return this.migrationCertificate;
	}

	public void setMigrationCertificate(boolean migrationCertificate) {
		this.migrationCertificate = migrationCertificate;
	}

	public boolean getmother_name() {
		return this.mother_name;
	}

	public void setmother_name(boolean mother_name) {
		this.mother_name = mother_name;
	}

	public boolean getMotherPhotograph() {
		return this.motherPhotograph;
	}

	public void setMotherPhotograph(boolean motherPhotograph) {
		this.motherPhotograph = motherPhotograph;
	}

	public boolean getNftHashCode() {
		return this.nftHashCode;
	}

	public void setNftHashCode(boolean nftHashCode) {
		this.nftHashCode = nftHashCode;
	}

	public boolean getPanCardParents() {
		return this.panCardParents;
	}

	public void setPanCardParents(boolean panCardParents) {
		this.panCardParents = panCardParents;
	}

	public boolean getPdf() {
		return this.pdf;
	}

	public void setPdf(boolean pdf) {
		this.pdf = pdf;
	}

	public boolean getpermanent_address() {
		return this.permanent_address;
	}

	public void setpermanent_address(boolean permanent_address) {
		this.permanent_address = permanent_address;
	}

	public boolean getphone_number() {
		return this.phone_number;
	}

	public void setphone_number(boolean phone_number) {
		this.phone_number = phone_number;
	}

	public boolean getQualifiedRankLetter() {
		return this.qualifiedRankLetter;
	}

	public void setQualifiedRankLetter(boolean qualifiedRankLetter) {
		this.qualifiedRankLetter = qualifiedRankLetter;
	}

	public boolean getRollNo() {
		return this.rollNo;
	}

	public void setRollNo(boolean rollNo) {
		this.rollNo = rollNo;
	}

	public int getstudent_id() {
		return this.student_id;
	}

	public void setstudent_id(int student_id) {
		this.student_id = student_id;
	}

	public boolean getStudentPhotograph() {
		return this.studentPhotograph;
	}

	public void setStudentPhotograph(boolean studentPhotograph) {
		this.studentPhotograph = studentPhotograph;
	}

	public boolean getStudentscol() {
		return this.studentscol;
	}

	public void setStudentscol(boolean studentscol) {
		this.studentscol = studentscol;
	}

	public boolean getTransferCertificate() {
		return this.transferCertificate;
	}

	public void setTransferCertificate(boolean transferCertificate) {
		this.transferCertificate = transferCertificate;
	}

	public boolean getWebcam_photo() {
		return this.webcam_photo;
	}

	public void setWebcam_photo(boolean webcam_photo) {
		this.webcam_photo = webcam_photo;
	}

	public void setStudentSignature(boolean studentSignature) {
		this.studentSignature = studentSignature;
	}

	public boolean getStudentSignature() {
		return this.studentSignature;
	}

	public void setStudentThumbImpression(boolean studentThumbImpression) {
		this.studentThumbImpression = studentThumbImpression;
	}

	public boolean getStudentThumbImpression() {
		return this.studentThumbImpression;
	}

	// public boolean getother_10th_board() {
	// 	return this.other_10th_board;
	// }

	// public void setother_10th_board(boolean other_10th_board) {
	// 	this.other_10th_board = other_10th_board;
	// }

	// public boolean getother_12th_board() {
	// 	return this.other_12th_board;
	// }

	// public void setother_12th_board(boolean other_12th_board) {
	// 	this.other_12th_board = other_12th_board;
	// }

	public boolean getsub_category() {
		return this.sub_category;
	}

	public void setsub_category(boolean sub_category) {
		this.sub_category = sub_category;
	}

	public boolean flag() {
		if (!this.webcam_photo
				|| !this.first_name
				|| !this.middle_name
				|| !this.last_name
				|| !this.batch
				|| !this.branch
				|| !this.email_address
				|| !this.phone_number
				|| !this.dob
				|| !this.course
				|| !this.father_name
				|| !this.mother_name
				|| !this.category
				|| !this.gender
				|| !this.aadhar_card_no
				|| !this.father_phone_number
				|| !this.permanent_address
				|| !this.current_address
				|| !this._0th_board
				|| !this._0th_roll_no
				|| !this._0th_marks
				|| !this._2th_board_SS
				|| !this._2th_roll_no_ss
				|| !this._2th_marks_chem
				|| !this._2th_marks_maths
				|| !this._2th_marks_physics
				// || !this.other_10th_board
				// || !this.other_12th_board
				|| !this.sub_category) {
			return true;
		} else {
			return false;
		}
	}

	public CheckRegistrationFeild(int student_id, boolean _0th_marks, boolean _0th_roll_no, boolean _0th_board,
			boolean _2th_marks_chem, boolean _2th_marks_maths, boolean _2th_marks_physics, boolean _2th_roll_no_ss,
			boolean _2th_board_SS, boolean aadhar_card, boolean aadhar_card_no, boolean adhaarCardParents,
			boolean affidavitForGap, boolean allotmentLetter, boolean antiRaggingAffidavit, boolean batch,
			boolean birthdayMail, boolean branch, boolean casteCertificate, boolean category,
			boolean characterCertificate, boolean course, boolean cryptoWalletAddress, boolean current_address,
			boolean display, boolean dob, boolean domicileCertificateUp, boolean father_name,
			boolean father_phone_number,
			boolean fatherPhotograph, boolean first_name, boolean gender, boolean generate,
			boolean highSchoolCertificate, boolean highSchoolMarksheet, boolean hindiName, boolean image,
			boolean incomeCertificate, boolean intermediateCertificate, boolean intermediateMarksheet,
			boolean ipfsPdfUrl, boolean ipfsUrl, boolean last_name, boolean medicalCertificate, boolean middle_name,
			boolean migrationCertificate, boolean mother_name, boolean motherPhotograph, boolean nftHashCode,
			boolean panCardParents, boolean pdf, boolean permanent_address, boolean phone_number,
			boolean qualifiedRankLetter, boolean rollNo, boolean studentPhotograph, boolean studentscol,
			boolean transferCertificate, boolean webcam_photo,
			// boolean other_10th_board, boolean other_12th_board,
			boolean sub_category) {
		this.student_id = student_id;
		this._0th_marks = _0th_marks;
		this._0th_roll_no = _0th_roll_no;
		this._0th_board = _0th_board;
		this._2th_marks_chem = _2th_marks_chem;
		this._2th_marks_maths = _2th_marks_maths;
		this._2th_marks_physics = _2th_marks_physics;
		this._2th_roll_no_ss = _2th_roll_no_ss;
		this._2th_board_SS = _2th_board_SS;
		this.aadhar_card = aadhar_card;
		this.aadhar_card_no = aadhar_card_no;
		this.adhaarCardParents = adhaarCardParents;
		this.affidavitForGap = affidavitForGap;
		this.allotmentLetter = allotmentLetter;
		this.antiRaggingAffidavit = antiRaggingAffidavit;
		this.batch = batch;
		this.birthdayMail = birthdayMail;
		this.branch = branch;
		this.casteCertificate = casteCertificate;
		this.category = category;
		this.characterCertificate = characterCertificate;
		this.course = course;
		this.cryptoWalletAddress = cryptoWalletAddress;
		this.current_address = current_address;
		this.display = display;
		this.dob = dob;
		this.domicileCertificateUp = domicileCertificateUp;
		this.father_name = father_name;
		this.father_phone_number = father_phone_number;
		this.fatherPhotograph = fatherPhotograph;
		this.first_name = first_name;
		this.gender = gender;
		this.generate = generate;
		this.highSchoolCertificate = highSchoolCertificate;
		this.highSchoolMarksheet = highSchoolMarksheet;
		this.hindiName = hindiName;
		this.image = image;
		this.incomeCertificate = incomeCertificate;
		this.intermediateCertificate = intermediateCertificate;
		this.intermediateMarksheet = intermediateMarksheet;
		this.ipfsPdfUrl = ipfsPdfUrl;
		this.ipfsUrl = ipfsUrl;
		this.last_name = last_name;
		this.medicalCertificate = medicalCertificate;
		this.middle_name = middle_name;
		this.migrationCertificate = migrationCertificate;
		this.mother_name = mother_name;
		this.motherPhotograph = motherPhotograph;
		this.nftHashCode = nftHashCode;
		this.panCardParents = panCardParents;
		this.pdf = pdf;
		this.permanent_address = permanent_address;
		this.phone_number = phone_number;
		this.qualifiedRankLetter = qualifiedRankLetter;
		this.rollNo = rollNo;
		this.studentPhotograph = studentPhotograph;
		this.studentscol = studentscol;
		this.transferCertificate = transferCertificate;
		this.webcam_photo = webcam_photo;
		// this.other_10th_board = other_10th_board;
		// this.other_12th_board = other_12th_board;
		this.sub_category = sub_category;
	}

	public CheckRegistrationFeild(int student_id) {
		this.student_id = student_id;
		this._0th_marks = true;
		this._0th_roll_no = true;
		this._0th_board = true;
		this._2th_marks_chem = true;
		this._2th_marks_maths = true;
		this._2th_marks_physics = true;
		this._2th_roll_no_ss = true;
		this._2th_board_SS = true;
		this.aadhar_card = true;
		this.aadhar_card_no = true;
		this.adhaarCardParents = true;
		this.affidavitForGap = true;
		this.allotmentLetter = true;
		this.antiRaggingAffidavit = true;
		this.batch = true;
		this.birthdayMail = true;
		this.branch = true;
		this.casteCertificate = true;
		this.category = true;
		this.characterCertificate = true;
		this.course = true;
		this.cryptoWalletAddress = true;
		this.current_address = true;
		this.display = true;
		this.dob = true;
		this.domicileCertificateUp = true;
		this.father_name = true;
		this.father_phone_number = true;
		this.fatherPhotograph = true;
		this.first_name = true;
		this.gender = true;
		this.generate = true;
		this.highSchoolCertificate = true;
		this.highSchoolMarksheet = true;
		this.hindiName = true;
		this.image = true;
		this.incomeCertificate = true;
		this.intermediateCertificate = true;
		this.intermediateMarksheet = true;
		this.ipfsPdfUrl = true;
		this.ipfsUrl = true;
		this.last_name = true;
		this.medicalCertificate = true;
		this.middle_name = true;
		this.migrationCertificate = true;
		this.mother_name = true;
		this.motherPhotograph = true;
		this.nftHashCode = true;
		this.panCardParents = true;
		this.pdf = true;
		this.permanent_address = true;
		this.phone_number = true;
		this.qualifiedRankLetter = true;
		this.rollNo = true;
		this.studentPhotograph = true;
		this.studentscol = true;
		this.transferCertificate = true;
		this.webcam_photo = true;
		this.studentSignature = true;
		this.studentThumbImpression = true;
		// this.other_10th_board = true;
		// this.other_12th_board = true;
		this.sub_category = true;
	}

	public ArrayList<String> getMissingFeilds() {
		ArrayList<String> st = new ArrayList<>();

		if (!this.webcam_photo)
			st.add("Photo");
		if (!this.first_name)
			st.add("First Name");
		if (!this.middle_name)
			st.add("Middle Name");
		if (!this.last_name)
			st.add("Last Name");
		if (!this.course)
			st.add("Course");
		if (!this.batch)
			st.add("Batch");
		if (!this.branch)
			st.add("Branch");
		if (!this.email_address)
			st.add("Email Address");
		if (!this.phone_number)
			st.add("Phone Number");
		if (!this.dob)
			st.add("Date Of Birth");
		if (!this.father_name)
			st.add("Father Name");
		if (!this.mother_name)
			st.add("Mother Name");
		if (!this.category)
			st.add("Category");
		if (!this.gender)
			st.add("Gender");
		if (!this.aadhar_card_no)
			st.add("Aadhar Card Number");
		if (!this.father_phone_number)
			st.add("Father Phone Number");
		if (!this.permanent_address)
			st.add("Permanent Address");
		if (!this.current_address)
			st.add("Current Address");
		if (!this._0th_board)
			st.add("10th Board");
		if (!this._0th_roll_no)
			st.add("10th Roll Number");
		if (!this._0th_marks)
			st.add("10th Marks");
		if (!this._2th_board_SS)
			st.add("12th Board");
		if (!this._2th_roll_no_ss)
			st.add("12th Roll Number");
		if (!this._2th_marks_physics)
			st.add("12th Physics Marks");
		if (!this._2th_marks_maths)
			st.add("12th Maths Marks");
		if (!this._2th_marks_chem)
			st.add("12th Chemistry Marks");
		// if (this.other_10th_board)
		// st.add("Other 10th Board");
		// if (this.other_12th_board)
		// st.add("Other 12th Board");
		if (!this.sub_category)
			st.add("Sub Category");
		return st;
	}

}
