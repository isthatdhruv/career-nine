package com.kccitm.api.service.b2c.report.pipeline;

/**
 * Marks a <i>transient</i> failure in the report pipeline that should be retried
 * (e.g. scores not yet persisted, mapping not yet visible as completed). The
 * generate consumer's {@code @RetryableTopic} is configured to retry ONLY this
 * exception; any other exception (e.g. {@code ReportRoutingException} = no
 * template) is terminal and goes straight to the DLT.
 */
public class RetryablePipelineException extends RuntimeException {

    public RetryablePipelineException(String message) {
        super(message);
    }

    public RetryablePipelineException(String message, Throwable cause) {
        super(message, cause);
    }
}
