package com.kccitm.api.controller.career9.report;

public class UnifiedReportRequest {

    private Long userStudentId;
    private Long assessmentId;
    private Boolean force;

    public UnifiedReportRequest() {}

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Boolean getForce() { return force; }
    public void setForce(Boolean force) { this.force = force; }
}
