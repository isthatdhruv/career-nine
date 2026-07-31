package com.kccitm.api.controller.career9.report;

import java.util.List;

/**
 * Request for the async (Kafka) enqueue endpoints. Single endpoint uses
 * {@code userStudentId}; bulk uses {@code userStudentIds}. {@code force} and
 * {@code emailMode} are fully orthogonal (all four combinations valid).
 */
public class UnifiedEnqueueRequest {

    private Long userStudentId;          // single enqueue
    private List<Long> userStudentIds;   // bulk enqueue
    private Long assessmentId;
    /** Optional — null uses the assessment's default template. */
    private Long reportTemplateId;
    /** true = recompute scores + placeholders; false = re-render from cached data. */
    private Boolean force;
    /** "none" (default) or "all". "auto" is reserved for on-submission events. */
    private String emailMode;
    /** Batch to cancel/heartbeat (cancel + heartbeat endpoints only). */
    private String batchId;

    public UnifiedEnqueueRequest() {}

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public List<Long> getUserStudentIds() { return userStudentIds; }
    public void setUserStudentIds(List<Long> userStudentIds) { this.userStudentIds = userStudentIds; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Long getReportTemplateId() { return reportTemplateId; }
    public void setReportTemplateId(Long reportTemplateId) { this.reportTemplateId = reportTemplateId; }

    public Boolean getForce() { return force; }
    public void setForce(Boolean force) { this.force = force; }

    public String getEmailMode() { return emailMode; }
    public void setEmailMode(String emailMode) { this.emailMode = emailMode; }

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
}
