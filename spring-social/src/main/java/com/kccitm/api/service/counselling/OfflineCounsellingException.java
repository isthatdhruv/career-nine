package com.kccitm.api.service.counselling;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * A refusal from the offline-counselling flow, carrying everything its response needs: the HTTP
 * status, a stable machine {@code code} the page branches on, the sentence to show, and any extra
 * fields (attempts left, who already recorded the session, ...).
 *
 * <p>Its own type rather than the shared {@code BadRequestException} family because those map to
 * a fixed body with no code, and the page must tell apart, say, "already done by you" (treated as
 * success after a dropped response) from "already done by someone else". The controller renders
 * it; a RuntimeException, so it also rolls back the recording transaction.
 */
public class OfflineCounsellingException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final HttpStatus status;
    private final String code;
    private final Map<String, Object> extras = new LinkedHashMap<>();

    public OfflineCounsellingException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static OfflineCounsellingException badRequest(String code, String message) {
        return new OfflineCounsellingException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static OfflineCounsellingException forbidden(String code, String message) {
        return new OfflineCounsellingException(HttpStatus.FORBIDDEN, code, message);
    }

    public static OfflineCounsellingException notFound(String code, String message) {
        return new OfflineCounsellingException(HttpStatus.NOT_FOUND, code, message);
    }

    public static OfflineCounsellingException conflict(String code, String message) {
        return new OfflineCounsellingException(HttpStatus.CONFLICT, code, message);
    }

    public static OfflineCounsellingException locked(String code, String message) {
        return new OfflineCounsellingException(HttpStatus.LOCKED, code, message);
    }

    /** Adds a field to the error body next to {@code code} and {@code message}. */
    public OfflineCounsellingException with(String key, Object value) {
        extras.put(key, value);
        return this;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public Map<String, Object> getExtras() { return Collections.unmodifiableMap(extras); }
}
