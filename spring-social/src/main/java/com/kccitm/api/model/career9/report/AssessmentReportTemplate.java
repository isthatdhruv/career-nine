package com.kccitm.api.model.career9.report;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.ReportTemplate;

/**
 * Join row mapping an assessment to a {@link ReportTemplate} (many-to-many).
 * One assessment offers several templates; exactly one may be flagged
 * {@code isDefault} so report generation can run without an explicit template
 * id. The first template mapped to an assessment is auto-flagged default and
 * stays so until an admin changes it.
 *
 * <p>Supersedes the former questionnaire&rarr;template mapping: the template
 * (and its default) is now chosen per assessment, so assessments that share a
 * questionnaire can carry different report templates. Standalone join entity
 * (not cascade-managed from AssessmentTable) so membership/default queries are
 * simple repository lookups.
 */
@Entity
@Table(name = "assessment_report_template",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_art_assessment_template",
        columnNames = {"assessment_id", "report_template_id"})
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentReportTemplate implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_report_template_id")
    private Long id;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "report_template_id", referencedColumnName = "report_template_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReportTemplate reportTemplate;

    @Column(name = "is_default", nullable = false)
    private Boolean isDefault = false;

    public AssessmentReportTemplate() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public ReportTemplate getReportTemplate() { return reportTemplate; }
    public void setReportTemplate(ReportTemplate reportTemplate) { this.reportTemplate = reportTemplate; }

    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
}
