package com.kccitm.api.controller.career9.report;

import java.util.List;

/** Bulk variant of {@link UnifiedReportRequest} — generate one template for many students. */
public class UnifiedBulkRequest {

    private Long assessmentId;
    /** Optional — null uses the questionnaire's default template. */
    private Long reportTemplateId;
    private Boolean force;
    private List<Long> userStudentIds;

    public UnifiedBulkRequest() {}

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Long getReportTemplateId() { return reportTemplateId; }
    public void setReportTemplateId(Long reportTemplateId) { this.reportTemplateId = reportTemplateId; }

    public Boolean getForce() { return force; }
    public void setForce(Boolean force) { this.force = force; }

    public List<Long> getUserStudentIds() { return userStudentIds; }
    public void setUserStudentIds(List<Long> userStudentIds) { this.userStudentIds = userStudentIds; }
}
