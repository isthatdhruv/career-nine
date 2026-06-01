package com.kccitm.api.controller.career9.report;

import com.kccitm.api.model.career9.report.ReportType;

public class ReportTypeDto {

    public Long   reportTypeId;
    public String code;
    public String displayName;

    public ReportTypeDto() {}

    public static ReportTypeDto from(ReportType t) {
        ReportTypeDto d = new ReportTypeDto();
        d.reportTypeId = t.getReportTypeId();
        d.code         = t.getCode();
        d.displayName  = t.getDisplayName();
        return d;
    }
}
