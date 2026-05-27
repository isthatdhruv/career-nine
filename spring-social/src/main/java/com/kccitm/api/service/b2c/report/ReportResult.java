package com.kccitm.api.service.b2c.report;

import java.util.Date;

/** Return shape of {@code ReportService.generate(...)}. */
public class ReportResult {

    public final String reportUrl;
    public final String typeCode;
    public final String subtypeCode;
    public final Date calculatedAt;
    public final Date renderedAt;
    public final boolean alreadyExisted;

    public ReportResult(String reportUrl, String typeCode, String subtypeCode,
                        Date calculatedAt, Date renderedAt, boolean alreadyExisted) {
        this.reportUrl = reportUrl;
        this.typeCode = typeCode;
        this.subtypeCode = subtypeCode;
        this.calculatedAt = calculatedAt;
        this.renderedAt = renderedAt;
        this.alreadyExisted = alreadyExisted;
    }
}
