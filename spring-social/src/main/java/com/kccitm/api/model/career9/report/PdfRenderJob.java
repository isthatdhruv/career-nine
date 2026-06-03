package com.kccitm.api.model.career9.report;

import java.io.Serializable;
import java.util.Date;
import javax.persistence.*;

/** Durable PDF render-job queue row. One active row per generated_report. */
@Entity
@Table(name = "pdf_render_job",
    uniqueConstraints = @UniqueConstraint(name = "uk_prj_generated_report",
        columnNames = {"generated_report_id"}))
public class PdfRenderJob implements Serializable {

    public static final String PENDING   = "pending";
    public static final String RENDERING = "rendering";
    public static final String DONE      = "done";
    public static final String FAILED    = "failed";

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "pdf_render_job_id")
    private Long pdfRenderJobId;

    @Column(name = "generated_report_id", nullable = false)
    private Long generatedReportId;

    @Column(name = "report_url", nullable = false, length = 4096)
    private String reportUrl;

    @Column(name = "status", nullable = false, length = 50)
    private String status = PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "lease_until")
    private Date leaseUntil;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    @PrePersist
    protected void onCreate() { this.createdAt = new Date(); this.updatedAt = new Date(); }

    @PreUpdate
    protected void onUpdate() { this.updatedAt = new Date(); }

    public Long getPdfRenderJobId() { return pdfRenderJobId; }
    public Long getGeneratedReportId() { return generatedReportId; }
    public void setGeneratedReportId(Long v) { this.generatedReportId = v; }
    public String getReportUrl() { return reportUrl; }
    public void setReportUrl(String v) { this.reportUrl = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int v) { this.attempts = v; }
    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int v) { this.maxAttempts = v; }
    public String getLastError() { return lastError; }
    public void setLastError(String v) { this.lastError = v; }
    public Date getLeaseUntil() { return leaseUntil; }
    public void setLeaseUntil(Date v) { this.leaseUntil = v; }
    public Date getCreatedAt() { return createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
}
