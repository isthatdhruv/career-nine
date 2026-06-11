package com.kccitm.api.service.b2c.report.pipeline;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

/**
 * Simple global pacing for outbound report emails so a backlog burst can't trip
 * the Odoo/provider rate limits. {@code report.pipeline.email-rate-per-sec <= 0}
 * disables it. Process-local (per worker JVM) — adequate for the single-worker
 * v1; revisit if the worker is scaled horizontally.
 */
@Component
public class EmailRateLimiter {

    @Value("${report.pipeline.email-rate-per-sec:0}")
    private double ratePerSec;

    private long minIntervalNanos;
    private long nextAllowedNanos;

    @PostConstruct
    void init() {
        minIntervalNanos = ratePerSec > 0 ? (long) (1_000_000_000L / ratePerSec) : 0L;
    }

    public synchronized void acquire() {
        if (minIntervalNanos <= 0) {
            return;
        }
        long now = System.nanoTime();
        if (now < nextAllowedNanos) {
            long waitNanos = nextAllowedNanos - now;
            try {
                Thread.sleep(waitNanos / 1_000_000L, (int) (waitNanos % 1_000_000L));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            now = System.nanoTime();
        }
        nextAllowedNanos = Math.max(now, nextAllowedNanos) + minIntervalNanos;
    }
}
