package com.kccitm.api.controller.career9.report;

import java.util.Date;

import com.kccitm.api.model.career9.ReportTemplate;

public class ReportTemplateDto {

    public Long    reportTemplateId;
    public String  code;
    public String  displayName;
    public String  engineCode;
    public String  templateSpacesUrl;
    public Date    templateUploadedAt;
    public String  spacesRenderFolder;
    public boolean hasTemplate;

    public ReportTemplateDto() {}

    public static ReportTemplateDto from(ReportTemplate t) {
        ReportTemplateDto d = new ReportTemplateDto();
        d.reportTemplateId   = t.getReportTemplateId();
        d.code               = t.getCode();
        d.displayName        = t.getDisplayName();
        d.engineCode         = t.getEngineCode();
        d.templateSpacesUrl  = t.getTemplateSpacesUrl();
        d.templateUploadedAt = t.getTemplateUploadedAt();
        d.spacesRenderFolder = t.getSpacesRenderFolder();
        d.hasTemplate        = t.getTemplateSpacesUrl() != null && !t.getTemplateSpacesUrl().isEmpty();
        return d;
    }
}
