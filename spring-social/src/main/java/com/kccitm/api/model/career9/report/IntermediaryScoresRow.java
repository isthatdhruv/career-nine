package com.kccitm.api.model.career9.report;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Per-(student, assessment) RIASEC / MI / aptitude / SOI / values payload,
 * computed once and reused across all subtypes for the same student.
 * Navigator + Pager pipelines write here; BET skips (different shape).
 *
 * Named "Row" to avoid a name clash with the
 * {@code NavigatorReportGenerationService.IntermediaryScores} inner DTO class.
 */
@Entity
@Table(name = "intermediary_scores",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_intermediary_student_assessment",
        columnNames = {"user_student_id", "assessment_id"}),
    indexes = {
        @Index(name = "idx_intermediary_assessment", columnList = "assessment_id"),
        @Index(name = "idx_intermediary_student",    columnList = "user_student_id")
    }
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class IntermediaryScoresRow implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "intermediary_scores_id")
    private Long intermediaryScoresId;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "scores_json", nullable = false, columnDefinition = "JSON")
    private String scoresJson;

    @Column(name = "engine_version", nullable = false, length = 40)
    private String engineVersion;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "calculated_at", nullable = false)
    private Date calculatedAt;

    public IntermediaryScoresRow() {}

    public Long getIntermediaryScoresId() { return intermediaryScoresId; }
    public void setIntermediaryScoresId(Long id) { this.intermediaryScoresId = id; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getScoresJson() { return scoresJson; }
    public void setScoresJson(String scoresJson) { this.scoresJson = scoresJson; }

    public String getEngineVersion() { return engineVersion; }
    public void setEngineVersion(String engineVersion) { this.engineVersion = engineVersion; }

    public Date getCalculatedAt() { return calculatedAt; }
    public void setCalculatedAt(Date calculatedAt) { this.calculatedAt = calculatedAt; }
}
