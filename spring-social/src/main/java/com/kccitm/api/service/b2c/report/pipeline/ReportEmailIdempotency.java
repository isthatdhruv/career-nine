package com.kccitm.api.service.b2c.report.pipeline;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Redis-backed idempotency for the email stage — guarantees one email per
 * (student, assessment) without a per-send DB query. Kafka is at-least-once, so
 * a redelivery (crash/rebalance before offset commit) could re-process an event;
 * this lock makes the re-send a no-op.
 *
 * <p>Two-phase lock: {@code claim()} atomically sets a short "sending" lock
 * (SET NX EX). On a real send success the caller {@code markSent()} promotes it
 * to a long-lived "sent" marker; on failure {@code release()} frees it so a
 * retry can re-acquire. A crashed worker's "sending" lock self-expires, so the
 * message simply retries — never permanently stuck.
 */
@Component
public class ReportEmailIdempotency {

    public enum Claim { PROCEED, ALREADY_SENT, IN_PROGRESS }

    @Autowired private StringRedisTemplate redis;

    @Value("${report.pipeline.idem-lock-seconds:300}")
    private long lockSeconds;

    @Value("${report.pipeline.idem-sent-days:7}")
    private long sentDays;

    private String key(long studentId, long assessmentId) {
        return "report:sent:" + studentId + ":" + assessmentId;
    }

    /** Atomically attempt to claim the send. */
    public Claim claim(long studentId, long assessmentId) {
        String key = key(studentId, assessmentId);
        Boolean acquired = redis.opsForValue()
                .setIfAbsent(key, "sending", Duration.ofSeconds(lockSeconds));
        if (Boolean.TRUE.equals(acquired)) {
            return Claim.PROCEED;
        }
        String existing = redis.opsForValue().get(key);
        if ("sent".equals(existing)) {
            return Claim.ALREADY_SENT;
        }
        return Claim.IN_PROGRESS;
    }

    /** Promote the lock to a durable "sent" marker after a successful send. */
    public void markSent(long studentId, long assessmentId) {
        redis.opsForValue().set(key(studentId, assessmentId), "sent", Duration.ofDays(sentDays));
    }

    /** Release the lock so a retry can re-claim (call on send failure). */
    public void release(long studentId, long assessmentId) {
        redis.delete(key(studentId, assessmentId));
    }
}
