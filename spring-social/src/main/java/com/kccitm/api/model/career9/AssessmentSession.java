package com.kccitm.api.model.career9;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.io.Serializable;

/**
 * POJO representing an assessment session stored in Redis.
 * Binds a student + assessment to a server-side session token
 * to prevent wrong assessment loading on shared devices.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssessmentSession implements Serializable {

    private static final long serialVersionUID = 1L;

    private String sessionToken;
    private Long studentId;
    private Long assessmentId;
    private String startTime;

    public AssessmentSession() {
    }

    public AssessmentSession(String sessionToken, Long studentId, Long assessmentId, String startTime) {
        this.sessionToken = sessionToken;
        this.studentId = studentId;
        this.assessmentId = assessmentId;
        this.startTime = startTime;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public void setSessionToken(String sessionToken) {
        this.sessionToken = sessionToken;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }
}
