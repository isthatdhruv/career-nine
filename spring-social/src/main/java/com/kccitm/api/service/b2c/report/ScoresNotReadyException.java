package com.kccitm.api.service.b2c.report;

/**
 * Thrown by PagerPlaceholderCalculator when intermediary scores can't be
 * computed because the async submission processor hasn't finished persisting
 * yet (the same race window {@code PagerScoreSource} already covers with its
 * 5×200ms retry loop). The unified controller maps this to HTTP 503 so the
 * SPA can transparently retry.
 */
public class ScoresNotReadyException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    public ScoresNotReadyException(String message) { super(message); }
}
