package com.kccitm.api.service.mail;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.mail.MailJob;
import com.kccitm.api.model.mail.MailJobStatus;

/**
 * The job queue, entirely in Redis (the production instance runs AOF with no eviction).
 *
 * <pre>
 * mail:due            ZSET  jobId -> fireAt (ms)          jobs waiting to fire
 * mail:processing     ZSET  jobId -> claimedAt (ms)       claimed by a runner; stale ones are requeued
 * mail:job:{id}       STRING JSON MailJob                 terminal jobs expire after 7 days
 * mail:subject:{key}  SET   jobIds pending for a subject  cancel-on-event lookups
 * mail:dedupe:{key}   STRING SET NX                       "this send already happened"
 * mail:cap:{key}      STRING counter                      sends per automation per recipient
 * mail:recent         LIST  last 200 terminal job ids     the Queue page's "recent outcomes"
 * mail:paused         STRING "1" while the queue is paused
 * </pre>
 *
 * Claiming is one Lua script, so several containers can poll without double-processing.
 */
@Service
public class RedisMailQueue {

    private static final Logger logger = LoggerFactory.getLogger(RedisMailQueue.class);

    static final String DUE = "mail:due";
    static final String PROCESSING = "mail:processing";
    static final String PAUSED = "mail:paused";
    static final String RECENT = "mail:recent";
    static final Duration TERMINAL_TTL = Duration.ofDays(7);
    static final int RECENT_KEEP = 200;

    private static final String CLAIM_LUA =
            "local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])\n"
            + "for i, id in ipairs(due) do\n"
            + "  redis.call('ZREM', KEYS[1], id)\n"
            + "  redis.call('ZADD', KEYS[2], ARGV[1], id)\n"
            + "end\n"
            + "return due";

    @SuppressWarnings("rawtypes")
    private final DefaultRedisScript<List> claimScript = new DefaultRedisScript<>(CLAIM_LUA, List.class);

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private ObjectMapper mapper;

    // ─── job storage ──────────────────────────────────────────────────────

    public static String jobKey(String id) {
        return "mail:job:" + id;
    }

    public MailJob load(String id) {
        if (id == null) return null;
        String json = redis.opsForValue().get(jobKey(id));
        if (json == null) return null;
        try {
            return mapper.readValue(json, MailJob.class);
        } catch (Exception e) {
            logger.warn("Unreadable mail job {}: {}", id, e.getMessage());
            return null;
        }
    }

    public void save(MailJob job, Duration ttl) {
        job.updatedAt = System.currentTimeMillis();
        try {
            String json = mapper.writeValueAsString(job);
            if (ttl == null) {
                redis.opsForValue().set(jobKey(job.id), json);
            } else {
                redis.opsForValue().set(jobKey(job.id), json, ttl);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Could not store mail job " + job.id, e);
        }
    }

    // ─── guards ───────────────────────────────────────────────────────────

    /** True the first time a key is seen; false when the same send already happened. */
    public boolean tryDedupe(String key, Duration ttl) {
        Boolean ok = redis.opsForValue().setIfAbsent("mail:dedupe:" + key, "1", ttl);
        return Boolean.TRUE.equals(ok);
    }

    public long incrementCap(String capKey) {
        String k = "mail:cap:" + capKey;
        Long n = redis.opsForValue().increment(k);
        if (n != null && n == 1L) {
            redis.expire(k, 180, TimeUnit.DAYS);
        }
        return n == null ? 0L : n;
    }

    public long capCount(String capKey) {
        String v = redis.opsForValue().get("mail:cap:" + capKey);
        return v == null ? 0L : Long.parseLong(v);
    }

    // ─── scheduling ───────────────────────────────────────────────────────

    public void enqueue(MailJob job) {
        job.status = MailJobStatus.PENDING.name();
        save(job, null);
        redis.opsForZSet().add(DUE, job.id, job.fireAt);
        for (String s : job.subjects) {
            redis.opsForSet().add("mail:subject:" + s, job.id);
        }
    }

    /** Atomically move up to {@code limit} due jobs to processing and return them. */
    @SuppressWarnings("unchecked")
    public List<MailJob> claimDue(long now, int limit) {
        List<String> ids = redis.execute(claimScript, Arrays.asList(DUE, PROCESSING),
                String.valueOf(now), String.valueOf(limit));
        List<MailJob> out = new ArrayList<>();
        if (ids == null) return out;
        for (String id : ids) {
            MailJob job = load(id);
            if (job == null) {
                redis.opsForZSet().remove(PROCESSING, id);
                continue;
            }
            job.status = MailJobStatus.PROCESSING.name();
            save(job, null);
            out.add(job);
        }
        return out;
    }

    public void finish(MailJob job, MailJobStatus status, String error, String skipReason) {
        redis.opsForZSet().remove(PROCESSING, job.id);
        redis.opsForZSet().remove(DUE, job.id);
        job.status = status.name();
        job.lastError = error;
        job.skipReason = skipReason;
        save(job, TERMINAL_TTL);
        for (String s : job.subjects) {
            redis.opsForSet().remove("mail:subject:" + s, job.id);
        }
        redis.opsForList().leftPush(RECENT, job.id);
        redis.opsForList().trim(RECENT, 0, RECENT_KEEP - 1);
        if (status == MailJobStatus.CANCELLED && job.dedupeKey != null) {
            // A cancelled send did not happen, so the same event may legitimately schedule it again
            // (a reschedule cancels the old reminders and creates new ones for the same appointment).
            redis.delete("mail:dedupe:" + job.dedupeKey);
        }
    }

    public void reschedule(MailJob job, long fireAt, MailJobStatus status) {
        redis.opsForZSet().remove(PROCESSING, job.id);
        job.fireAt = fireAt;
        job.status = status.name();
        save(job, null);
        redis.opsForZSet().add(DUE, job.id, fireAt);
    }

    public boolean cancel(String id, String reason) {
        MailJob job = load(id);
        if (job == null || isTerminal(job.status)) return false;
        finish(job, MailJobStatus.CANCELLED, null, reason);
        return true;
    }

    /** Cancel every pending job on any of the subjects that {@code matcher} accepts; returns them. */
    public List<MailJob> cancelBySubjects(Collection<String> subjects, Predicate<MailJob> matcher, String reason) {
        List<MailJob> cancelled = new ArrayList<>();
        Set<String> ids = new LinkedHashSet<>();
        for (String s : subjects) {
            Set<String> members = redis.opsForSet().members("mail:subject:" + s);
            if (members != null) ids.addAll(members);
        }
        for (String id : ids) {
            MailJob job = load(id);
            if (job == null) {
                for (String s : subjects) redis.opsForSet().remove("mail:subject:" + s, id);
                continue;
            }
            if (isTerminal(job.status) || !matcher.test(job)) continue;
            finish(job, MailJobStatus.CANCELLED, null, reason);
            cancelled.add(job);
        }
        return cancelled;
    }

    public boolean fireNow(String id) {
        MailJob job = load(id);
        if (job == null || isTerminal(job.status)) return false;
        long now = System.currentTimeMillis();
        redis.opsForZSet().remove(PROCESSING, job.id);
        job.fireAt = now;
        job.status = MailJobStatus.PENDING.name();
        save(job, null);
        redis.opsForZSet().add(DUE, job.id, now);
        return true;
    }

    /** Jobs claimed longer than {@code olderThanMs} ago went with a crashed runner; put them back. */
    public int requeueStale(long olderThanMs, long now) {
        Set<String> ids = redis.opsForZSet().rangeByScore(PROCESSING, Double.NEGATIVE_INFINITY, now - olderThanMs);
        int n = 0;
        if (ids == null) return 0;
        for (String id : ids) {
            MailJob job = load(id);
            if (job == null) {
                redis.opsForZSet().remove(PROCESSING, id);
                continue;
            }
            reschedule(job, now, MailJobStatus.RETRY);
            n++;
        }
        return n;
    }

    // ─── views ────────────────────────────────────────────────────────────

    public List<MailJob> listPending(int limit) {
        Set<String> ids = redis.opsForZSet().range(DUE, 0, Math.max(0, limit - 1));
        return loadAll(ids);
    }

    public List<MailJob> listProcessing() {
        return loadAll(redis.opsForZSet().range(PROCESSING, 0, -1));
    }

    public List<MailJob> recent(int limit) {
        List<String> ids = redis.opsForList().range(RECENT, 0, Math.max(0, limit - 1));
        return loadAll(ids);
    }

    public long pendingCount() {
        Long n = redis.opsForZSet().zCard(DUE);
        return n == null ? 0L : n;
    }

    public long processingCount() {
        Long n = redis.opsForZSet().zCard(PROCESSING);
        return n == null ? 0L : n;
    }

    public boolean isPaused() {
        return "1".equals(redis.opsForValue().get(PAUSED));
    }

    public void setPaused(boolean paused) {
        if (paused) {
            redis.opsForValue().set(PAUSED, "1");
        } else {
            redis.delete(PAUSED);
        }
    }

    private List<MailJob> loadAll(Collection<String> ids) {
        List<MailJob> out = new ArrayList<>();
        if (ids == null) return out;
        for (String id : ids) {
            MailJob j = load(id);
            if (j != null) out.add(j);
        }
        return out;
    }

    public static boolean isTerminal(String status) {
        return MailJobStatus.SENT.name().equals(status) || MailJobStatus.FAILED.name().equals(status)
                || MailJobStatus.CANCELLED.name().equals(status) || MailJobStatus.SKIPPED.name().equals(status);
    }
}
