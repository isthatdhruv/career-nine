package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;

public class Result {
	public String session;
	public String semester;
	public String total_subjects;
	public String practical_subjects;
	public String result_status;
	public String date_of_declaration;
	public String even_odd;
	public String theory_subjects;
	public String total_marks_obt;
	public String SGPA;
	public ArrayList<Marks> marks;

	public Result(String session, String semester, String total_subjects, String practical_subjects,
			String result_status, String date_of_declaration, String even_odd, String theory_subjects,
			String total_marks_obt, String SGPA, ArrayList<Marks> marks) {
		this.session = session;
		this.semester = semester;
		this.total_subjects = total_subjects;
		this.practical_subjects = practical_subjects;
		this.result_status = result_status;
		this.date_of_declaration = date_of_declaration;
		this.even_odd = even_odd;
		this.theory_subjects = theory_subjects;
		this.total_marks_obt = total_marks_obt;
		this.SGPA = SGPA;
		this.marks = marks;
	}

	public Result() {
		// TODO Auto-generated constructor stub
	}

	public void setTotal_subjects(String total_subjects) {
		this.total_subjects = total_subjects;
	}

	public void setTotal_marks_obt(String total_marks_obt) {
		this.total_marks_obt = total_marks_obt;
	}

	public void setTheory_subjects(String theory_subjects) {
		this.theory_subjects = theory_subjects;
	}

	public void setSGPA(String sGPA) {
		SGPA = sGPA;
	}

	public void setSemester(String semester) {
		this.semester = semester;
	}

	public void setResult_status(String result_status) {
		this.result_status = result_status;
	}

	public void setPractical_subjects(String practical_subjects) {
		this.practical_subjects = practical_subjects;
	}

	public void setEven_odd(String even_odd) {
		this.even_odd = even_odd;
	}

	public void setDate_of_declaration(String date_of_declaration) {
		this.date_of_declaration = date_of_declaration;
	}

	public String getTotal_subjects() {
		return total_subjects;
	}

	public String getTotal_marks_obt() {
		return total_marks_obt;
	}

	public String getTheory_subjects() {
		return theory_subjects;
	}

	public String getSGPA() {
		return SGPA;
	}

	public String getSemester() {
		return semester;
	}

	public String getResult_status() {
		return result_status;
	}

	public String getPractical_subjects() {
		return practical_subjects;
	}

	public String getEven_odd() {
		return even_odd;
	}

	public String getDate_of_declaration() {
		return date_of_declaration;
	}

	public ArrayList<Marks> getMarks() {
		return marks;
	}

	public void setMarks(ArrayList<Marks> marks) {
		this.marks = marks;
	}

	public void setMarks1(ArrayList<Marks> mark) {
		// TODO Auto-generated method stub
		this.marks = mark;
	}

	// public void setMarks(ArrayList<Marks> mark) {
	// // TODO Auto-generated method stub
	// this.marks = mark;
	// }
	public String getSession() {
		return session;
	}

	public void setSession(String session) {
		this.session = session;
	}

}