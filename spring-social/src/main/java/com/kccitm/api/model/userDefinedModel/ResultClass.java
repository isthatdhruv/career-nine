package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;

public class ResultClass {
	public String name;
	public String course;
	public String branch;
	public String rollno;
	public String enrollment;
	public String hindiname;
	public String fname;
	public String gender;
	public ArrayList<Result> result;
	
	

    public  ResultClass(String name, String course, String branch, String rollno,String enrollment,String hindiname,String fname,String gender,ArrayList<Result> result) {
		this.name= name;
		this.course= course;
		this.branch= branch;
		this.rollno= rollno;
		this.enrollment= enrollment;
		this.hindiname= hindiname;
		this.fname= fname;
		this.gender= gender;
		this.result= result;
	}
	
    public void setResult(ArrayList<Result> result) {
		this.result = result;
	}
	
	public ArrayList<Result> getResult() {
		return result;
	}
}
