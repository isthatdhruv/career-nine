package com.kccitm.api.model.userDefinedModel;


public class Marks {
	public String code;
	public String name;
	public String type;
	public String internal;
	public String external;
	public String back_paper;
	public String grade;

	public Marks(String code, String name, String type, String internal, String external, String back_paper,
			String grade) {
		this.code = code;
		this.name = name;
		this.type = type;
		this.internal = internal;
		this.external = external;
		this.back_paper = back_paper;
		this.grade = grade;
	}

	public Marks() {

	}

	public String getBack_paper() {
		return back_paper;
	}

	public void setBack_paper(String back_paper) {
		this.back_paper = back_paper;
	}

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public String getExternal() {
		return external;
	}

	public void setExternal(String external) {
		this.external = external;
	}

	public String getGrade() {
		return grade;
	}

	public void setGrade(String grade) {
		this.grade = grade;
	}

	public String getInternal() {
		return internal;
	}

	public void setInternal(String internal) {
		this.internal = internal;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

}
