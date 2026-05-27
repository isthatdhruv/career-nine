package com.kccitm.api.model.career9.report;

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
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Per-(student, assessment, type, subtype) placeholder JSON payload. Computed
 * once by the matching PlaceholderCalculator strategy, reused on every report
 * call (unless force=true or engine_version changed). The HTML template is
 * always re-loaded and re-rendered against this payload so template edits
 * propagate without recomputing.
 */
@Entity
@Table(name = "calculated_report_data",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_calc_student_assessment_type_subtype",
        columnNames = {"user_student_id", "assessment_id", "report_type_id", "report_subtype_id"}),
    indexes = {
        @Index(name = "idx_calc_assessment", columnList = "assessment_id"),
        @Index(name = "idx_calc_student",    columnList = "user_student_id")
    }
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CalculatedReportData implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "calculated_report_data_id")
    private Long calculatedReportDataId;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "report_type_id", referencedColumnName = "report_type_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReportType reportType;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "report_subtype_id", referencedColumnName = "report_subtype_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReportSubtype reportSubtype;

    @Column(name = "calculated_json", nullable = false, columnDefinition = "JSON")
    private String calculatedJson;

    @Column(name = "engine_version", nullable = false, length = 40)
    private String engineVersion;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "calculated_at", nullable = false)
    private Date calculatedAt;

    public CalculatedReportData() {}

    public Long getCalculatedReportDataId() { return calculatedReportDataId; }
    public void setCalculatedReportDataId(Long id) { this.calculatedReportDataId = id; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public ReportType getReportType() { return reportType; }
    public void setReportType(ReportType reportType) { this.reportType = reportType; }

    public ReportSubtype getReportSubtype() { return reportSubtype; }
    public void setReportSubtype(ReportSubtype reportSubtype) { this.reportSubtype = reportSubtype; }

    public String getCalculatedJson() { return calculatedJson; }
    public void setCalculatedJson(String calculatedJson) { this.calculatedJson = calculatedJson; }

    public String getEngineVersion() { return engineVersion; }
    public void setEngineVersion(String engineVersion) { this.engineVersion = engineVersion; }

    public Date getCalculatedAt() { return calculatedAt; }
    public void setCalculatedAt(Date calculatedAt) { this.calculatedAt = calculatedAt; }
}
