package com.kccitm.api.service.b2c.report;

/**
 * A strategy decided the report must not be generated (Navigator Pro gates
 * R1–R5). ReportService records a {@code suppressed} generated_report row and
 * rethrows; the worker acknowledges without retry; the controller returns 422.
 */
public class ReportSuppressedException extends RuntimeException {

    private final String ruleCode;
    private final String reason;

    public ReportSuppressedException(String ruleCode, String reason) {
        super(ruleCode + ": " + reason);
        this.ruleCode = ruleCode;
        this.reason = reason;
    }

    public String getRuleCode() { return ruleCode; }
    public String getReason() { return reason; }
}
