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
    public final String pdfUrl;     // null until the async render completes
    public final String pdfStatus;  // notRequested | pending | rendering | ready | failed

    public ReportResult(String reportUrl, String typeCode, String subtypeCode,
                        Date calculatedAt, Date renderedAt, boolean alreadyExisted,
                        String pdfUrl, String pdfStatus) {
        this.reportUrl = reportUrl;
        this.typeCode = typeCode;
        this.subtypeCode = subtypeCode;
        this.calculatedAt = calculatedAt;
        this.renderedAt = renderedAt;
        this.alreadyExisted = alreadyExisted;
        this.pdfUrl = pdfUrl;
        this.pdfStatus = pdfStatus;
    }
}
