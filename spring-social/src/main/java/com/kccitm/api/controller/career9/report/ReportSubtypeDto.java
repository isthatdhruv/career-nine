package com.kccitm.api.controller.career9.report;

import java.util.Date;

import com.kccitm.api.model.career9.report.ReportSubtype;

public class ReportSubtypeDto {

    public Long   reportSubtypeId;
    public Long   reportTypeId;
    public String reportTypeCode;
    public String code;
    public String displayName;
    public String templateSpacesUrl;
    public Date   templateUploadedAt;
    public String spacesRenderFolder;

    public ReportSubtypeDto() {}

    public static ReportSubtypeDto from(ReportSubtype s) {
        ReportSubtypeDto d = new ReportSubtypeDto();
        d.reportSubtypeId    = s.getReportSubtypeId();
        d.reportTypeId       = s.getReportType() != null ? s.getReportType().getReportTypeId() : null;
        d.reportTypeCode     = s.getReportType() != null ? s.getReportType().getCode() : null;
        d.code               = s.getCode();
        d.displayName        = s.getDisplayName();
        d.templateSpacesUrl  = s.getTemplateSpacesUrl();
        d.templateUploadedAt = s.getTemplateUploadedAt();
        d.spacesRenderFolder = s.getSpacesRenderFolder();
        return d;
    }
}
