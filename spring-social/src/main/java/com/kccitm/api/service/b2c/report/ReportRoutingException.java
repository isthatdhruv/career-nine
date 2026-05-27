package com.kccitm.api.service.b2c.report;

/**
 * Thrown when ReportService can't resolve a (ReportType, ReportSubtype) pair
 * for a given assessment — either because the questionnaire hasn't been
 * backfilled yet AND the grade-based fallback also failed, OR because the
 * resolved subtype isn't seeded in {@code report_subtype}.
 */
public class ReportRoutingException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    public ReportRoutingException(String message) { super(message); }
}
