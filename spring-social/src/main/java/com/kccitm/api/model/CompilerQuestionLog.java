package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.NamedQuery;
import javax.persistence.Table;


/**
 * The persistent class for the compiler_question_logs database table.
 * 
 */
@Entity
@Table(name="compiler_question_logs")
@NamedQuery(name="CompilerQuestionLog.findAll", query="SELECT c FROM CompilerQuestionLog c")
public class CompilerQuestionLog implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	private int id;

	@Column(name="expected_output")
	private String expectedOutput;

	@Column(name="language_id")
	// @ManyToOne(fetch = FetchType.LAZY)
    // @JoinColumn(name = "codingLanguage")
	private int languageId;

	@Column(name="question_id")
	// @ManyToOne(fetch = FetchType.LAZY)
    // @JoinColumn(name = "codingQuestion")
	private int questionId;

	private String response;

	@Lob
	@Column(name="source_code")
	private String sourceCode;

	private String stdin;

	private String stdout;

	@Column(name="user_id")
	// @ManyToOne(fetch = FetchType.LAZY)
    // @JoinColumn(name = "student_user")
	private java.math.BigInteger userId;

	public CompilerQuestionLog() {
	}

	public int getId() {
		return this.id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public String getExpectedOutput() {
		return this.expectedOutput;
	}

	public void setExpectedOutput(String expectedOutput) {
		this.expectedOutput = expectedOutput;
	}

	public int getLanguageId() {
		return this.languageId;
	}

	public void setLanguageId(int languageId) {
		this.languageId = languageId;
	}

	public int getQuestionId() {
		return this.questionId;
	}

	public void setQuestionId(int questionId) {
		this.questionId = questionId;
	}

	public String getResponse() {
		return this.response;
	}

	public void setResponse(String response) {
		this.response = response;
	}

	public String getSourceCode() {
		return this.sourceCode;
	}

	public void setSourceCode(String sourceCode) {
		this.sourceCode = sourceCode;
	}

	public String getStdin() {
		return this.stdin;
	}

	public void setStdin(String stdin) {
		this.stdin = stdin;
	}

	public String getStdout() {
		return this.stdout;
	}

	public void setStdout(String stdout) {
		this.stdout = stdout;
	}

	public java.math.BigInteger getUserId() {
		return this.userId;
	}

	public void setUserId(java.math.BigInteger userId) {
		this.userId = userId;
	}

}