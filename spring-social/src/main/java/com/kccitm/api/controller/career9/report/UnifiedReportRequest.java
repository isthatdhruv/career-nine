package com.kccitm.api.controller.career9.report;

public class UnifiedReportRequest {

    private Long userStudentId;
    private Long assessmentId;
    /** Optional — when null, the questionnaire's default template is used. */
    private Long reportTemplateId;
    private Boolean force;

    public UnifiedReportRequest() {}

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Long getReportTemplateId() { return reportTemplateId; }
    public void setReportTemplateId(Long reportTemplateId) { this.reportTemplateId = reportTemplateId; }

    public Boolean getForce() { return force; }
    public void setForce(Boolean force) { this.force = force; }
}
