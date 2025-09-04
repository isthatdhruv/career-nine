package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "CodingPlatformProblem")
public class CodingPlatformProblem implements Serializable{


	@Id
	@Column(name = "problem_id")
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int problemId;

    @Column(name="problem_heading")
    private String problemHeading;

    @Column(columnDefinition="TEXT", name="coding_problem")
    private String codingProblem;
    

    @Column(name="problem_url")
    private String problemUrl;

    public int getproblemId() {
        return problemId;
    }
    public void setproblemId(int problemId) {
        this.problemId = problemId;
    }
    public String getcodingProblem() {
        return codingProblem;
    }
    public void setcodingProblem(String codingQuestion) {
        this.codingProblem = codingQuestion;
    }
    public String getProblemHeading() {
        return problemHeading;
    }
    public void setProblemHeading(String problemHeading) {
        this.problemHeading = problemHeading;
    }
    public String getProblemUrl() {
        return problemUrl;
    }
    public void setProblemUrl(String problemUrl) {
        this.problemUrl = problemUrl;
    }
}
