package com.kccitm.api.controller.career9.report;

import com.kccitm.api.model.career9.report.AssessmentReportTemplate;

/** An assessment's mapped template plus whether it is the default. */
public class TemplateMappingDto {

    public Long              mappingId;
    public boolean           isDefault;
    public ReportTemplateDto template;

    public TemplateMappingDto() {}

    public static TemplateMappingDto from(AssessmentReportTemplate m) {
        TemplateMappingDto d = new TemplateMappingDto();
        d.mappingId = m.getId();
        d.isDefault = Boolean.TRUE.equals(m.getIsDefault());
        d.template  = m.getReportTemplate() != null ? ReportTemplateDto.from(m.getReportTemplate()) : null;
        return d;
    }
}
