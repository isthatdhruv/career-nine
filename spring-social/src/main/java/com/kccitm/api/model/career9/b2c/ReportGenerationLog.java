package com.kccitm.api.model.career9.b2c;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Lob;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * Audit row written every time report generation fails (or is retried). The
 * unified {@code GeneratedReport} table tracks the outcome
 * ({@code report_status ∈ notGenerated|generated|failed}); this table tracks
 * the why — error class, message, stack-trace excerpt — so admins can
 * triage from the B2C Tracker without grepping server logs.
 *
 * Status values: failed | resolved
 * Attempt types: prepare | download | retry
 */
@Entity
@Table(name = "report_generation_log", indexes = {
    @Index(name = "idx_rgl_entitlement", columnList = "entitlement_id"),
    @Index(name = "idx_rgl_campaign", columnList = "campaign_id"),
    @Index(name = "idx_rgl_status", columnList = "status")
})
public class ReportGenerationLog implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "entitlement_id")
    private Long entitlementId;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Column(name = "assessment_id")
    private Long assessmentId;

    @Column(name = "campaign_id")
    private Long campaignId;

    @Column(name = "report_type", length = 32)
    private String reportType;

    @Column(name = "student_class_at_attempt")
    private Integer studentClassAtAttempt;

    @Column(name = "attempt_type", length = 32)
    private String attemptType;

    @Column(name = "status", length = 16)
    private String status;

    @Column(name = "error_class", length = 200)
    private String errorClass;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Lob
    @Column(name = "stack_trace_excerpt", columnDefinition = "TEXT")
    private String stackTraceExcerpt;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @Column(name = "resolved_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date resolvedAt;

    @Column(name = "resolved_by", length = 100)
    private String resolvedBy;

    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = new Date();
        if (status == null) status = "failed";
    }

    public ReportGenerationLog() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getEntitlementId() { return entitlementId; }
    public void setEntitlementId(Long v) { this.entitlementId = v; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }
    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public String getReportType() { return reportType; }
    public void setReportType(String v) { this.reportType = v; }
    public Integer getStudentClassAtAttempt() { return studentClassAtAttempt; }
    public void setStudentClassAtAttempt(Integer v) { this.studentClassAtAttempt = v; }
    public String getAttemptType() { return attemptType; }
    public void setAttemptType(String v) { this.attemptType = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public String getErrorClass() { return errorClass; }
    public void setErrorClass(String v) { this.errorClass = v; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String v) { this.errorMessage = v; }
    public String getStackTraceExcerpt() { return stackTraceExcerpt; }
    public void setStackTraceExcerpt(String v) { this.stackTraceExcerpt = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
    public Date getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Date v) { this.resolvedAt = v; }
    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String v) { this.resolvedBy = v; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String v) { this.resolutionNote = v; }
}
