package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "report_template")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ReportTemplate implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_template_id")
    private Long id;

    @Column(name = "template_name", nullable = false)
    private String templateName;

    // Legacy direct mapping for the generic preview/PDF feature. Nullable now —
    // engine-backed templates are mapped to assessments via
    // assessment_report_template instead.
    @Column(name = "assessment_id")
    private Long assessmentId;

    @Column(name = "template_url", length = 2048)
    private String templateUrl;

    // JSON string: { "{{placeholder}}": "dataField", ... }
    @Column(name = "field_mappings", columnDefinition = "TEXT")
    private String fieldMappings;

    @Column(name = "created_at")
    private String createdAt;

    @Column(name = "updated_at")
    private String updatedAt;

    // ── Engine-backed report pipeline fields (unified report_template) ──────

    /** Globally-unique stable code (e.g. pager_insight). Null for legacy/generic rows. */
    @Column(name = "code", length = 50)
    private String code;

    /** Selects the PlaceholderCalculator engine: bet | pager | legacy. */
    @Column(name = "engine_code", length = 50)
    private String engineCode;

    /** Output folder on Spaces for rendered student reports. */
    @Column(name = "spaces_render_folder")
    private String spacesRenderFolder;

    /** Object key of the uploaded template HTML on Spaces. */
    @Column(name = "template_spaces_key", length = 512)
    private String templateSpacesKey;

    /** Upload timestamp — keys the TemplateCache so re-uploads auto-invalidate. */
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "template_uploaded_at")
    private Date templateUploadedAt;

    public ReportTemplate() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public String getTemplateUrl() {
        return templateUrl;
    }

    public void setTemplateUrl(String templateUrl) {
        this.templateUrl = templateUrl;
    }

    public String getFieldMappings() {
        return fieldMappings;
    }

    public void setFieldMappings(String fieldMappings) {
        this.fieldMappings = fieldMappings;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getEngineCode() { return engineCode; }
    public void setEngineCode(String engineCode) { this.engineCode = engineCode; }

    public String getSpacesRenderFolder() { return spacesRenderFolder; }
    public void setSpacesRenderFolder(String spacesRenderFolder) { this.spacesRenderFolder = spacesRenderFolder; }

    public String getTemplateSpacesKey() { return templateSpacesKey; }
    public void setTemplateSpacesKey(String templateSpacesKey) { this.templateSpacesKey = templateSpacesKey; }

    public Date getTemplateUploadedAt() { return templateUploadedAt; }
    public void setTemplateUploadedAt(Date templateUploadedAt) { this.templateUploadedAt = templateUploadedAt; }

    // ── Aliases used by the engine-backed report pipeline ──────────────────

    public Long getReportTemplateId() { return id; }

    public String getDisplayName() { return templateName; }
    public void setDisplayName(String displayName) { this.templateName = displayName; }

    /** The uploaded HTML lives in template_url. */
    public String getTemplateSpacesUrl() { return templateUrl; }
    public void setTemplateSpacesUrl(String url) { this.templateUrl = url; }
}
