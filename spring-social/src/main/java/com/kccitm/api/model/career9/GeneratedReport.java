package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.report.ReportSubtype;

@Entity
@Table(name = "generated_report",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_student_assessment_type_subtype",
        columnNames = {"user_student_id", "assessment_id", "type_of_report", "report_subtype_id"}
    ),
    indexes = {
        @Index(name = "idx_gr_assessment", columnList = "assessment_id"),
        @Index(name = "idx_gr_student", columnList = "user_student_id"),
        @Index(name = "idx_gr_type", columnList = "type_of_report")
    }
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class GeneratedReport implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "generated_report_id")
    private Long generatedReportId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_student_id", referencedColumnName = "user_student_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private UserStudent userStudent;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    // "bet"    = BET report (grades 3-5, single template)
    // "legacy" = legacy 18-page Navigator report (kept for historical rows; was "navigator" pre-V20260526005)
    // "pager"  = 4-pager Navigator report (grades 6+, three subtypes: insight / subject / career)
    @Column(name = "type_of_report", nullable = false, length = 50)
    private String typeOfReport;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_subtype_id", referencedColumnName = "report_subtype_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReportSubtype reportSubtype;

    public ReportSubtype getReportSubtype() { return reportSubtype; }
    public void setReportSubtype(ReportSubtype reportSubtype) { this.reportSubtype = reportSubtype; }

    // "notGenerated", "generated", "failed"
    @Column(name = "report_status", nullable = false, length = 50)
    private String reportStatus = "notGenerated";

    @Column(name = "report_url", length = 4096)
    private String reportUrl;

    @Column(name = "visible_to_student", nullable = false, columnDefinition = "boolean default false")
    private Boolean visibleToStudent = false;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = new Date();
    }

    public GeneratedReport() {
    }

    public Long getGeneratedReportId() {
        return generatedReportId;
    }

    public void setGeneratedReportId(Long generatedReportId) {
        this.generatedReportId = generatedReportId;
    }

    public UserStudent getUserStudent() {
        return userStudent;
    }

    public void setUserStudent(UserStudent userStudent) {
        this.userStudent = userStudent;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public String getTypeOfReport() {
        return typeOfReport;
    }

    public void setTypeOfReport(String typeOfReport) {
        this.typeOfReport = typeOfReport;
    }

    public String getReportStatus() {
        return reportStatus;
    }

    public void setReportStatus(String reportStatus) {
        this.reportStatus = reportStatus;
    }

    public String getReportUrl() {
        return reportUrl;
    }

    public void setReportUrl(String reportUrl) {
        this.reportUrl = reportUrl;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getVisibleToStudent() {
        return visibleToStudent;
    }

    public void setVisibleToStudent(Boolean visibleToStudent) {
        this.visibleToStudent = visibleToStudent;
    }
}
