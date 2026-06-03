package com.kccitm.api.controller.career9.report;

import com.kccitm.api.model.career9.report.QuestionnaireReportTemplate;

/** A questionnaire's mapped template plus whether it is the default. */
public class QuestionnaireTemplateMappingDto {

    public Long              mappingId;
    public boolean           isDefault;
    public ReportTemplateDto template;

    public QuestionnaireTemplateMappingDto() {}

    public static QuestionnaireTemplateMappingDto from(QuestionnaireReportTemplate m) {
        QuestionnaireTemplateMappingDto d = new QuestionnaireTemplateMappingDto();
        d.mappingId = m.getId();
        d.isDefault = Boolean.TRUE.equals(m.getIsDefault());
        d.template  = m.getReportTemplate() != null ? ReportTemplateDto.from(m.getReportTemplate()) : null;
        return d;
    }
}
