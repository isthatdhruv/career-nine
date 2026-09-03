package com.kccitm.api.service.mail;

import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationAdapter;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailAutomationDelivery;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailEventContext;
import com.kccitm.api.model.mail.MailJob;
import com.kccitm.api.model.mail.MailJobStatus;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.model.mail.MailSettings;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.EmailNotificationRecipientService;

/**
 * The engine's front door. {@link #publish} is a no-op while the engine is off; otherwise,
 * after the caller's transaction commits, the event cancels pending jobs that listed it as a
 * stop event, then every active automation triggered by it is matched: scope, conditions,
 * recipients, timing, dedupe and cap. Matches become Redis jobs, or send inline for
 * IMMEDIATE automations. Every decision not to send is logged as SKIPPED with its reason.
 */
@Service
public class MailEventsImpl implements MailEvents {

    private static final Logger logger = LoggerFactory.getLogger(MailEventsImpl.class);
    private static final Duration DEDUPE_TTL = Duration.ofDays(30);

    @Autowired private MailSettingsService settings;
    @Autowired private MailAutomationService automations;
    @Autowired private RedisMailQueue queue;
    @Autowired private MailPredicateRegistry predicates;
    @Autowired private MailJobSender sender;
    @Autowired private EmailDispatchService dispatcher;
    @Autowired private EmailNotificationRecipientService internalLists;

    @Override
    public void publish(MailEventContext ctx) {
        if (ctx == null) return;
        try {
            if (!settings.engineEnabled()) return;
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronizationAdapter() {
                    @Override
                    public void afterCommit() {
                        safeDispatch(ctx);
                    }
                });
            } else {
                safeDispatch(ctx);
            }
        } catch (Exception e) {
            logger.warn("Mail event {} not published: {}", ctx.event.key(), e.getMessage());
        }
    }

    private void safeDispatch(MailEventContext ctx) {
        try {
            dispatch(ctx);
        } catch (Exception e) {
            logger.error("Mail event {} failed inside the engine: {}", ctx.event.key(), e.getMessage(), e);
        }
    }

    void dispatch(MailEventContext ctx) {
        long now = System.currentTimeMillis();
        cancelOnEvent(ctx);
        for (MailAutomation a : automations.activeFor(ctx.event)) {
            dispatchAutomation(a, ctx, now);
        }
    }

    /** Run one automation for one context; used for event matches and for scheduled audiences. */
    public void dispatchAutomation(MailAutomation a, MailEventContext ctx, long now) {
        if (!inScope(a, ctx.instituteCode)) {
            return; // out of scope is not a decision worth a log row per student
        }
        Map<String, String> fields = fieldsOf(ctx);
        String failing = predicates.firstFailing(a.conditionList(), ctx.refs, fields);
        if (failing != null) {
            logSkip(a, ctx, primaryEmail(ctx), "condition not met: " + failing);
            return;
        }
        List<Target> targets = resolveTargets(a, ctx);
        if (targets.isEmpty()) {
            logSkip(a, ctx, null, "no recipient for roles " + a.roleList());
            return;
        }
        List<MailTiming.Occurrence> occurrences = MailTiming.plan(a, ctx, now);
        if (occurrences.isEmpty()) {
            logSkip(a, ctx, primaryEmail(ctx), "no send time: relative date missing or already past");
            return;
        }
        for (Target t : targets) {
            for (MailTiming.Occurrence o : occurrences) {
                createJob(a, ctx, fields, t, o, now);
            }
        }
    }

    private void cancelOnEvent(MailEventContext ctx) {
        if (ctx.subjects.isEmpty()) return;
        Set<Long> cancelling = new HashSet<>();
        for (MailAutomation a : automations.active()) {
            if (a.cancelEventList().contains(ctx.event.key()) && a.getId() != null) {
                cancelling.add(a.getId());
            }
        }
        if (cancelling.isEmpty()) return;
        String reason = "cancelled by " + ctx.event.key();
        List<MailJob> cancelled = queue.cancelBySubjects(ctx.subjects,
                job -> job.automationId != null && cancelling.contains(job.automationId), reason);
        for (MailJob job : cancelled) {
            sender.logSkipped(job, reason);
        }
    }

    private void createJob(MailAutomation a, MailEventContext ctx, Map<String, String> fields, Target t,
                           MailTiming.Occurrence o, long now) {
        MailJob job = new MailJob();
        job.id = newId();
        job.automationId = a.getId();
        job.automationKey = a.getAutomationKey();
        job.automationName = a.getName();
        job.eventKey = ctx.event.key();
        job.subjectKey = ctx.primarySubject();
        job.subjects = new ArrayList<>(ctx.subjects);
        job.role = t.role;
        job.to = new ArrayList<>(t.to);
        job.cc = new ArrayList<>(t.cc);
        job.bcc = new ArrayList<>(t.bcc);
        job.fields = new LinkedHashMap<>(fields);
        if (t.name != null && !t.name.trim().isEmpty()) {
            job.fields.put("recipient_name", t.name);
        }
        job.refs = new LinkedHashMap<>(ctx.refs);
        job.instituteCode = ctx.instituteCode;
        job.userStudentId = ctx.userStudentId;
        job.templateId = a.getTemplateId();
        job.emailType = a.getEmailType();
        job.seq = o.seq;
        job.offsetMinutes = o.offsetMinutes;
        job.maxSends = a.getMaxSends();
        job.repeatEveryMinutes = a.getRepeatEveryMinutes();
        job.recheck = Boolean.TRUE.equals(a.getRecheckBeforeSend());
        job.respectQuietHours = Boolean.TRUE.equals(a.getRespectQuietHours());
        job.conditions = new ArrayList<>(a.conditionList());
        job.createdAt = now;
        job.fireAt = o.fireAt;
        if (job.respectQuietHours) {
            LocalTime[] w = settings.quietWindow();
            if (w != null) {
                job.fireAt = MailTiming.applyQuietHours(job.fireAt, w[0], w[1], settings.zone());
            }
        }
        String who = t.to.isEmpty() ? "-" : t.to.get(0).toLowerCase();
        job.dedupeKey = a.getId() + ":" + (job.subjectKey == null ? "none" : job.subjectKey) + ":" + who + ":"
                + o.seq + ":" + (o.offsetMinutes == null ? "d" : o.offsetMinutes);
        job.capKey = a.getId() + ":" + who;

        if (!queue.tryDedupe(job.dedupeKey, DEDUPE_TTL)) {
            logSkip(a, ctx, who, "duplicate: this send already happened for this subject");
            return;
        }
        if (a.getMaxSends() != null && queue.capCount(job.capKey) >= a.getMaxSends()) {
            logSkip(a, ctx, who, "cap reached: " + a.getMaxSends() + " sends to this recipient");
            return;
        }
        MailSettings s = settings.get();
        if (s.stagingSinkEmail != null) {
            job.fields.put("original_recipient", String.join(", ", job.to));
            job.to = new ArrayList<>();
            job.to.add(s.stagingSinkEmail);
            job.cc = new ArrayList<>();
            job.bcc = new ArrayList<>();
        }
        if (a.getDeliveryMode() == MailAutomationDelivery.IMMEDIATE) {
            job.status = MailJobStatus.PROCESSING.name();
            queue.save(job, RedisMailQueue.TERMINAL_TTL);
            boolean ok = false;
            try {
                ok = sender.send(job).isSuccess();
            } catch (Exception e) {
                job.lastError = e.getMessage();
            }
            if (ok && job.capKey != null) {
                queue.incrementCap(job.capKey);
            }
            queue.finish(job, ok ? MailJobStatus.SENT : MailJobStatus.FAILED, job.lastError, null);
            return;
        }
        queue.enqueue(job);
    }

    // ─── recipients ───────────────────────────────────────────────────────

    static final class Target {
        final String role;
        final List<String> to = new ArrayList<>();
        final List<String> cc = new ArrayList<>();
        final List<String> bcc = new ArrayList<>();
        final String name;

        Target(String role, String email, String name) {
            this.role = role;
            if (email != null) this.to.add(email);
            this.name = name;
        }
    }

    private List<Target> resolveTargets(MailAutomation a, MailEventContext ctx) {
        List<Target> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String roleKey : a.roleList()) {
            MailRecipientRole role = MailRecipientRole.from(roleKey);
            if (role == null) continue;
            if (role == MailRecipientRole.INTERNAL_LIST) {
                EmailType type = EmailType.from(a.getEmailType());
                EmailNotificationRecipientService.Resolved r = internalLists.resolve(
                        type != null ? type : EmailType.GENERIC, ctx.fields.get("lead_type"), ctx.fields.get("lead_source"));
                if (r != null && !r.isEmpty()) {
                    Target t = new Target(role.name(), null, null);
                    t.to.addAll(r.to);
                    t.cc.addAll(r.cc);
                    t.bcc.addAll(r.bcc);
                    out.add(t);
                }
                continue;
            }
            for (MailEventContext.Recipient rc : ctx.recipients(role)) {
                if (seen.add(rc.email.toLowerCase())) {
                    out.add(new Target(role.name(), rc.email, rc.name));
                }
            }
        }
        for (String extra : a.extraRecipientList()) {
            if (extra.contains("@") && seen.add(extra.toLowerCase())) {
                out.add(new Target("EXTRA", extra, null));
            }
        }
        return out;
    }

    private static boolean inScope(MailAutomation a, Integer instituteCode) {
        List<Integer> scope = a.scopeList();
        if (scope == null) return true;
        return instituteCode != null && scope.contains(instituteCode);
    }

    private static Map<String, String> fieldsOf(MailEventContext ctx) {
        Map<String, String> f = new LinkedHashMap<>(ctx.fields);
        f.put("has_parent_email", ctx.recipients(MailRecipientRole.PARENT).isEmpty() ? "" : "true");
        f.putIfAbsent("event_key", ctx.event.key());
        return f;
    }

    private static String primaryEmail(MailEventContext ctx) {
        for (MailRecipientRole r : MailRecipientRole.values()) {
            List<MailEventContext.Recipient> l = ctx.recipients(r);
            if (!l.isEmpty()) return l.get(0).email;
        }
        return null;
    }

    private void logSkip(MailAutomation a, MailEventContext ctx, String recipient, String reason) {
        try {
            EmailSendRequest req = new EmailSendRequest();
            EmailType type = EmailType.from(a.getEmailType());
            req.setEmailType(type != null ? type : EmailType.GENERIC);
            if (recipient != null) req.getTo().add(recipient);
            req.setSubject(a.getName());
            req.setInstituteCode(ctx.instituteCode);
            req.setUserStudentId(ctx.userStudentId);
            req.setAutomationId(a.getId());
            req.setEventKey(ctx.event.key());
            dispatcher.logSkipped(req, reason);
        } catch (Exception e) {
            logger.warn("Could not log skip for automation {}: {}", a.getId(), e.getMessage());
        }
    }

    private static String newId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }
}
