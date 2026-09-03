package com.kccitm.api.service.mail;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailEventContext;
import com.kccitm.api.model.mail.MailJob;
import com.kccitm.api.model.mail.MailJobStatus;

/**
 * Drains the Redis queue. Every second it claims up to {@code paceSendsPerSecond} due jobs
 * and, for each: defers it if inside quiet hours or over the daily budget, rechecks
 * conditions when the automation asked for it, enforces the per-recipient cap, sends through
 * the dispatcher, schedules the next repeat, and retries failures with backoff. Once a
 * minute it puts back jobs a crashed runner left claimed and fires scheduled automations
 * whose cron is due. Runs only where {@code @Scheduled} is enabled (not the report worker).
 */
@Service
public class MailJobRunner {

    private static final Logger logger = LoggerFactory.getLogger(MailJobRunner.class);
    private static final long STALE_CLAIM_MS = 10 * 60_000L;
    private static final int MAX_ATTEMPTS = 3;

    @Autowired private RedisMailQueue queue;
    @Autowired private MailSettingsService settings;
    @Autowired private MailPredicateRegistry predicates;
    @Autowired private MailJobSender sender;
    @Autowired private MailSendBudget budget;
    @Autowired private MailAutomationService automations;
    @Autowired private MailAudienceRegistry audiences;
    @Autowired private MailEventsImpl events;
    @Autowired private StringRedisTemplate redis;

    private final AtomicBoolean polling = new AtomicBoolean(false);

    @Scheduled(fixedDelay = 1000)
    public void poll() {
        if (!settings.engineEnabled()) return;
        if (!polling.compareAndSet(false, true)) return;
        try {
            if (queue.isPaused()) return;
            long now = System.currentTimeMillis();
            int pace = Math.max(1, settings.get().paceSendsPerSecond);
            List<MailJob> jobs = queue.claimDue(now, pace);
            for (MailJob job : jobs) {
                process(job, now);
            }
        } catch (Exception e) {
            logger.error("Mail queue poll failed: {}", e.getMessage(), e);
        } finally {
            polling.set(false);
        }
    }

    void process(MailJob job, long now) {
        try {
            if (job.respectQuietHours) {
                LocalTime[] w = settings.quietWindow();
                if (w != null) {
                    long adjusted = MailTiming.applyQuietHours(now, w[0], w[1], settings.zone());
                    if (adjusted > now + 1000) {
                        queue.reschedule(job, adjusted, MailJobStatus.PENDING);
                        return;
                    }
                }
            }
            if (!budget.allowQueued(null)) {
                queue.reschedule(job, MailTiming.nextDay(now, settings.zone()), MailJobStatus.PENDING);
                return;
            }
            if (job.recheck) {
                String failing = predicates.firstFailing(job.conditions, job.refs, job.fields);
                if (failing != null) {
                    skip(job, "condition no longer holds: " + failing);
                    return;
                }
            }
            if (job.maxSends != null && job.capKey != null && queue.capCount(job.capKey) >= job.maxSends) {
                skip(job, "cap reached: " + job.maxSends + " sends to this recipient");
                return;
            }
            EmailSendResult r = sender.send(job);
            if (r != null && r.isSuccess()) {
                if (job.capKey != null) queue.incrementCap(job.capKey);
                queue.finish(job, MailJobStatus.SENT, null, null);
                scheduleRepeat(job, now);
            } else if (r != null && r.getStatus() == EmailSendStatus.SKIPPED) {
                queue.finish(job, MailJobStatus.SKIPPED, null, r.getError());
            } else {
                retry(job, r == null ? "no result from dispatcher" : r.getError(), now);
            }
        } catch (Exception e) {
            retry(job, e.getMessage(), now);
        }
    }

    private void skip(MailJob job, String reason) {
        queue.finish(job, MailJobStatus.SKIPPED, null, reason);
        try {
            sender.logSkipped(job, reason);
        } catch (Exception e) {
            logger.warn("Could not log skip for job {}: {}", job.id, e.getMessage());
        }
    }

    private void retry(MailJob job, String error, long now) {
        job.attempts++;
        job.lastError = error;
        if (job.attempts >= MAX_ATTEMPTS) {
            queue.finish(job, MailJobStatus.FAILED, error, null);
            return;
        }
        long delay = job.attempts == 1 ? 60_000L : 5 * 60_000L;
        queue.reschedule(job, now + delay, MailJobStatus.RETRY);
    }

    private void scheduleRepeat(MailJob sent, long now) {
        Integer every = sent.repeatEveryMinutes;
        if (every == null || every <= 0) return;
        if (sent.maxSends != null && sent.seq >= sent.maxSends) return;
        MailJob next = new MailJob();
        next.id = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        next.automationId = sent.automationId;
        next.automationKey = sent.automationKey;
        next.automationName = sent.automationName;
        next.eventKey = sent.eventKey;
        next.subjectKey = sent.subjectKey;
        next.subjects = new java.util.ArrayList<>(sent.subjects);
        next.role = sent.role;
        next.to = new java.util.ArrayList<>(sent.to);
        next.cc = new java.util.ArrayList<>(sent.cc);
        next.bcc = new java.util.ArrayList<>(sent.bcc);
        next.fields = new java.util.LinkedHashMap<>(sent.fields);
        next.refs = new java.util.LinkedHashMap<>(sent.refs);
        next.instituteCode = sent.instituteCode;
        next.userStudentId = sent.userStudentId;
        next.templateId = sent.templateId;
        next.emailType = sent.emailType;
        next.seq = sent.seq + 1;
        next.offsetMinutes = sent.offsetMinutes;
        next.maxSends = sent.maxSends;
        next.repeatEveryMinutes = sent.repeatEveryMinutes;
        next.recheck = sent.recheck;
        next.respectQuietHours = sent.respectQuietHours;
        next.conditions = new java.util.ArrayList<>(sent.conditions);
        next.createdAt = now;
        next.fireAt = now + every * 60_000L;
        if (next.respectQuietHours) {
            LocalTime[] w = settings.quietWindow();
            if (w != null) next.fireAt = MailTiming.applyQuietHours(next.fireAt, w[0], w[1], settings.zone());
        }
        String who = next.to.isEmpty() ? "-" : next.to.get(0).toLowerCase();
        next.dedupeKey = sent.automationId + ":" + (sent.subjectKey == null ? "none" : sent.subjectKey) + ":" + who + ":"
                + next.seq + ":" + (next.offsetMinutes == null ? "d" : next.offsetMinutes);
        next.capKey = sent.capKey;
        if (queue.tryDedupe(next.dedupeKey, java.time.Duration.ofDays(30))) {
            queue.enqueue(next);
        }
    }

    // ─── housekeeping + schedules ─────────────────────────────────────────

    @Scheduled(fixedDelay = 60_000)
    public void housekeeping() {
        if (!settings.engineEnabled()) return;
        long now = System.currentTimeMillis();
        try {
            int n = queue.requeueStale(STALE_CLAIM_MS, now);
            if (n > 0) logger.warn("Requeued {} mail job(s) left claimed by a stopped runner", n);
        } catch (Exception e) {
            logger.warn("Stale-claim sweep failed: {}", e.getMessage());
        }
        try {
            if (!queue.isPaused()) cronTick(now);
        } catch (Exception e) {
            logger.error("Scheduled automations tick failed: {}", e.getMessage(), e);
        }
    }

    /** Fire every scheduled automation whose cron has come due since it last fired. */
    void cronTick(long now) {
        ZoneId zone = settings.zone();
        for (MailAutomation a : automations.activeScheduled()) {
            if (a.getCron() == null || !CronExpression.isValidExpression(a.getCron())) continue;
            String key = "mail:cron:last:" + a.getId();
            String last = redis.opsForValue().get(key);
            ZonedDateTime nowZ = Instant.ofEpochMilli(now).atZone(zone);
            if (last == null) {
                // First sighting: arm from now so an old schedule does not fire retroactively.
                redis.opsForValue().set(key, String.valueOf(now), 400, TimeUnit.DAYS);
                continue;
            }
            ZonedDateTime lastZ = Instant.ofEpochMilli(Long.parseLong(last)).atZone(zone);
            LocalDateTime next = CronExpression.parse(a.getCron()).next(lastZ.toLocalDateTime());
            if (next == null || next.isAfter(nowZ.toLocalDateTime())) continue;
            redis.opsForValue().set(key, String.valueOf(now), 400, TimeUnit.DAYS);
            MailAudience audience = audiences.byKey(a.getAudienceKey());
            if (audience == null) {
                logger.warn("Scheduled automation {} has no audience '{}'", a.getName(), a.getAudienceKey());
                continue;
            }
            List<MailEventContext> members = audience.resolve();
            logger.info("Scheduled automation '{}' fired for {} member(s)", a.getName(), members.size());
            for (MailEventContext ctx : members) {
                events.dispatchAutomation(a, ctx, now);
            }
        }
    }
}
