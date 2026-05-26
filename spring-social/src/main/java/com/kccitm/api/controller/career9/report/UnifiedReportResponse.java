package com.kccitm.api.controller.career9.report;

import java.util.Date;

public class UnifiedReportResponse {

    public String status;          // "generated" | "not_ready" | "failed"
    public String reportType;      // type.code
    public String reportSubtype;   // subtype.code
    public String reportUrl;
    public Date   calculatedAt;
    public Date   renderedAt;
    public Boolean alreadyExisted;
    public String error;           // null on success
    public String errorCode;       // null on success — SanityFailedException.code for transient

    public UnifiedReportResponse() {}

    public static UnifiedReportResponse ok(String typeCode, String subtypeCode,
                                           String reportUrl, Date calculatedAt,
                                           Date renderedAt, boolean alreadyExisted) {
        UnifiedReportResponse r = new UnifiedReportResponse();
        r.status = "generated";
        r.reportType = typeCode;
        r.reportSubtype = subtypeCode;
        r.reportUrl = reportUrl;
        r.calculatedAt = calculatedAt;
        r.renderedAt = renderedAt;
        r.alreadyExisted = alreadyExisted;
        return r;
    }

    public static UnifiedReportResponse transient_(String code, String message) {
        UnifiedReportResponse r = new UnifiedReportResponse();
        r.status = "not_ready";
        r.errorCode = code;
        r.error = message;
        return r;
    }

    public static UnifiedReportResponse failed(String code, String message) {
        UnifiedReportResponse r = new UnifiedReportResponse();
        r.status = "failed";
        r.errorCode = code;
        r.error = message;
        return r;
    }
}
