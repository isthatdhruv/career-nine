package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "school_report",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_school_report_inst_assess",
        columnNames = {"institute_code", "assessment_id"}
    ),
    indexes = {
        @Index(name = "idx_sr_institute", columnList = "institute_code"),
        @Index(name = "idx_sr_assessment", columnList = "assessment_id")
    }
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SchoolReport implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "school_report_id")
    private Long schoolReportId;

    @Column(name = "institute_code", nullable = false)
    private Long instituteCode;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "institute_name", length = 512)
    private String instituteName;

    @Column(name = "assessment_name", length = 512)
    private String assessmentName;

    // Full JSON blob of the school report data (MQ/MQT stats, grades, etc.)
    @Column(name = "report_data", columnDefinition = "LONGTEXT")
    private String reportData;

    // ChatGPT/AI-generated interpretive content stored as JSON
    @Column(name = "ai_insights", columnDefinition = "LONGTEXT")
    private String aiInsights;

    @Column(name = "total_students")
    private Integer totalStudents;

    @Column(name = "students_with_scores")
    private Integer studentsWithScores;

    // "generated", "stale"
    @Column(name = "status", length = 50)
    private String status = "generated";

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

    public SchoolReport() {}

    // Getters and setters

    public Long getSchoolReportId() { return schoolReportId; }
    public void setSchoolReportId(Long schoolReportId) { this.schoolReportId = schoolReportId; }

    public Long getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Long instituteCode) { this.instituteCode = instituteCode; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getInstituteName() { return instituteName; }
    public void setInstituteName(String instituteName) { this.instituteName = instituteName; }

    public String getAssessmentName() { return assessmentName; }
    public void setAssessmentName(String assessmentName) { this.assessmentName = assessmentName; }

    public String getReportData() { return reportData; }
    public void setReportData(String reportData) { this.reportData = reportData; }

    public String getAiInsights() { return aiInsights; }
    public void setAiInsights(String aiInsights) { this.aiInsights = aiInsights; }

    public Integer getTotalStudents() { return totalStudents; }
    public void setTotalStudents(Integer totalStudents) { this.totalStudents = totalStudents; }

    public Integer getStudentsWithScores() { return studentsWithScores; }
    public void setStudentsWithScores(Integer studentsWithScores) { this.studentsWithScores = studentsWithScores; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
