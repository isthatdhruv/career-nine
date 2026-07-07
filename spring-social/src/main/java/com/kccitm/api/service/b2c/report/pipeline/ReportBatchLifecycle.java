package com.kccitm.api.service.b2c.report.pipeline;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Redis-backed lifecycle for admin enqueue batches (Generate Queue modal).
 *
 * <p>A batch is alive while its lease key exists. The modal heartbeats the
 * lease on every status poll; when the tab dies for ANY reason (close,
 * refresh, logout, crash, network loss) the heartbeats stop, the lease
 * expires, and the worker skips every remaining event of that batch —
 * "closing the modal stops the queue" without relying on the frontend
 * getting a last request out.
 *
 * <p>Explicit cancel (confirmed close) additionally sets a cancelled marker
 * so the batch stays dead even if a stale heartbeat lands afterwards.
 *
 * <p>Legacy on-submission events carry no batchId and are never checked.
 */
@Component
public class ReportBatchLifecycle {

    @Autowired private StringRedisTemplate redis;

    /** Lease TTL. Heartbeats every ~4s (poll tick) keep it alive; 60s tolerates blips. */
    @Value("${report.pipeline.batch-lease-seconds:60}")
    private long leaseSeconds;

    /** How long the explicit cancelled marker persists (covers topic backlog). */
    @Value("${report.pipeline.batch-cancel-days:1}")
    private long cancelDays;

    private String aliveKey(String batchId) { return "report:batch:alive:" + batchId; }
    private String cancelKey(String batchId) { return "report:batch:cancelled:" + batchId; }

    /** Start the lease when the batch is enqueued. */
    public void start(String batchId) {
        if (batchId == null || batchId.isBlank()) return;
        redis.opsForValue().set(aliveKey(batchId), "alive", Duration.ofSeconds(leaseSeconds));
    }

    /** Refresh the lease — called from the modal's poll loop. */
    public void heartbeat(String batchId) {
        if (batchId == null || batchId.isBlank()) return;
        redis.opsForValue().set(aliveKey(batchId), "alive", Duration.ofSeconds(leaseSeconds));
    }

    /** Explicit cancel: mark cancelled and drop the lease immediately. */
    public void cancel(String batchId) {
        if (batchId == null || batchId.isBlank()) return;
        redis.opsForValue().set(cancelKey(batchId), "cancelled", Duration.ofDays(cancelDays));
        redis.delete(aliveKey(batchId));
    }

    /**
     * Should the worker skip this event? True when the batch was explicitly
     * cancelled OR its lease expired (modal gone). Null/blank batchId — the
     * automatic on-submission pipeline — is never stopped.
     */
    public boolean isStopped(String batchId) {
        if (batchId == null || batchId.isBlank()) return false;
        if (Boolean.TRUE.equals(redis.hasKey(cancelKey(batchId)))) return true;
        return !Boolean.TRUE.equals(redis.hasKey(aliveKey(batchId)));
    }
}
