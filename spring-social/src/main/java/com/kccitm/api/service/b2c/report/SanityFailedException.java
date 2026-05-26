package com.kccitm.api.service.b2c.report;

/**
 * Thrown by ReportService when the SanityCheckService pre-flight returns a
 * non-OK result. Carries the failure code so the controller can shape the
 * HTTP response accordingly (e.g. 503 for NOT_COMPLETED, 422 for NO_MAPPING).
 */
public class SanityFailedException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final String code;

    public SanityFailedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() { return code; }
}
