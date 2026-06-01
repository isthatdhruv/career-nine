package com.kccitm.api.model.career9.report;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "report_subtype",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_report_subtype_type_code", columnNames = {"report_type_id", "code"})
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ReportSubtype implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_subtype_id")
    private Long reportSubtypeId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "report_type_id", referencedColumnName = "report_type_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReportType reportType;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "template_spaces_url", length = 2048)
    private String templateSpacesUrl;

    @Column(name = "template_spaces_key", length = 512)
    private String templateSpacesKey;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "template_uploaded_at")
    private Date templateUploadedAt;

    @Column(name = "spaces_render_folder", nullable = false)
    private String spacesRenderFolder;

    public ReportSubtype() {}

    public Long getReportSubtypeId() { return reportSubtypeId; }
    public void setReportSubtypeId(Long reportSubtypeId) { this.reportSubtypeId = reportSubtypeId; }

    public ReportType getReportType() { return reportType; }
    public void setReportType(ReportType reportType) { this.reportType = reportType; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getTemplateSpacesUrl() { return templateSpacesUrl; }
    public void setTemplateSpacesUrl(String templateSpacesUrl) { this.templateSpacesUrl = templateSpacesUrl; }

    public String getTemplateSpacesKey() { return templateSpacesKey; }
    public void setTemplateSpacesKey(String templateSpacesKey) { this.templateSpacesKey = templateSpacesKey; }

    public Date getTemplateUploadedAt() { return templateUploadedAt; }
    public void setTemplateUploadedAt(Date templateUploadedAt) { this.templateUploadedAt = templateUploadedAt; }

    public String getSpacesRenderFolder() { return spacesRenderFolder; }
    public void setSpacesRenderFolder(String spacesRenderFolder) { this.spacesRenderFolder = spacesRenderFolder; }
}
