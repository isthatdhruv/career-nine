package com.kccitm.api.model.career9;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import javax.persistence.Lob;

@Entity
@Table(name = "omr_column_mapping", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"assessment_id", "institute_id"})
})
public class OmrColumnMapping implements java.io.Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "institute_id", nullable = false)
    private Long instituteId;

    @Column(name = "questionnaire_id")
    private Long questionnaireId;

    @Column(name = "mapping_name")
    private String mappingName;

    @Lob
    @Column(name = "mapping_json", nullable = false, columnDefinition = "TEXT")
    private String mappingJson;

    @Column(name = "created_at")
    private String createdAt;

    @Column(name = "updated_at")
    private String updatedAt;

    public OmrColumnMapping() {}

    public OmrColumnMapping(Long assessmentId, Long instituteId, String mappingName, String mappingJson) {
        this.assessmentId = assessmentId;
        this.instituteId = instituteId;
        this.mappingName = mappingName;
        this.mappingJson = mappingJson;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Long getInstituteId() { return instituteId; }
    public void setInstituteId(Long instituteId) { this.instituteId = instituteId; }

    public String getMappingName() { return mappingName; }
    public void setMappingName(String mappingName) { this.mappingName = mappingName; }

    public String getMappingJson() { return mappingJson; }
    public void setMappingJson(String mappingJson) { this.mappingJson = mappingJson; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public Long getQuestionnaireId() { return questionnaireId; }
    public void setQuestionnaireId(Long questionnaireId) { this.questionnaireId = questionnaireId; }
}
