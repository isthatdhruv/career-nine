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
 * Join row mapping a questionnaire to a {@link ReportTemplate} (many-to-many).
 * One questionnaire offers several templates; exactly one may be flagged
 * {@code isDefault} so report generation can run without an explicit template
 * id. The first template mapped to a questionnaire is auto-flagged default and
 * stays so until an admin changes it.
 *
 * <p>Standalone join entity (not cascade-managed from Questionnaire) so the
 * Questionnaire entity stays untouched and membership/default queries are
 * simple repository lookups.
 */
@Entity
@Table(name = "questionire_report_template",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_qrt_questionnaire_template",
        columnNames = {"questionnaire_id", "report_template_id"})
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class QuestionnaireReportTemplate implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "questionire_report_template_id")
    private Long id;

    @Column(name = "questionnaire_id", nullable = false)
    private Long questionnaireId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "report_template_id", referencedColumnName = "report_template_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReportTemplate reportTemplate;

    @Column(name = "is_default", nullable = false)
    private Boolean isDefault = false;

    public QuestionnaireReportTemplate() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getQuestionnaireId() { return questionnaireId; }
    public void setQuestionnaireId(Long questionnaireId) { this.questionnaireId = questionnaireId; }

    public ReportTemplate getReportTemplate() { return reportTemplate; }
    public void setReportTemplate(ReportTemplate reportTemplate) { this.reportTemplate = reportTemplate; }

    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
}
