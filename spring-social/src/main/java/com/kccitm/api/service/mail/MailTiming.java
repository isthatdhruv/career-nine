package com.kccitm.api.service.mail;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailEventContext;

/**
 * Pure timing arithmetic for the engine: when an automation's sends should fire for a given
 * event, when a repeat follows a send, and how a fire time moves out of a quiet window.
 */
public final class MailTiming {

    /** Grace for relative sends whose moment already passed while the event was being published. */
    static final long PAST_GRACE_MS = 5 * 60_000L;

    public static final class Occurrence {
        public final int seq;
        public final Integer offsetMinutes;
        public final long fireAt;

        Occurrence(int seq, Integer offsetMinutes, long fireAt) {
            this.seq = seq;
            this.offsetMinutes = offsetMinutes;
            this.fireAt = fireAt;
        }
    }

    private MailTiming() {
    }

    /**
     * The first sends an event produces for an automation. Relative automations yield one
     * occurrence per offset around the event's date field (offsets already in the past are
     * dropped, except within a short grace so "at booking time" still fires). Delay
     * automations yield the first send only; repeats are scheduled after each send by
     * {@link #nextRepeat}.
     */
    public static List<Occurrence> plan(MailAutomation a, MailEventContext ctx, long now) {
        List<Occurrence> out = new ArrayList<>();
        String field = a.getRelativeToField();
        if (field != null && !field.trim().isEmpty()) {
            Date base = ctx.dates.get(field.trim());
            if (base == null) {
                return out;
            }
            int seq = 0;
            for (Integer offset : a.offsetList()) {
                long fireAt = base.getTime() + offset * 60_000L;
                if (fireAt < now - PAST_GRACE_MS) {
                    continue;
                }
                out.add(new Occurrence(++seq, offset, Math.max(fireAt, now)));
            }
            return out;
        }
        int delay = a.getDelayMinutes() == null ? 0 : Math.max(0, a.getDelayMinutes());
        out.add(new Occurrence(1, null, now + delay * 60_000L));
        return out;
    }

    /** Fire time of the next repeat after a send, or -1 when the automation is done repeating. */
    public static long nextRepeat(MailAutomation a, int seqJustSent, long sentAt) {
        Integer every = a.getRepeatEveryMinutes();
        if (every == null || every <= 0) return -1L;
        if (a.getMaxSends() != null && seqJustSent >= a.getMaxSends()) return -1L;
        return sentAt + every * 60_000L;
    }

    /**
     * Moves {@code fireAt} to the end of the quiet window when it falls inside it. Handles
     * windows that cross midnight (22:00 to 08:00).
     */
    public static long applyQuietHours(long fireAt, LocalTime start, LocalTime end, ZoneId zone) {
        if (start == null || end == null || start.equals(end)) return fireAt;
        ZonedDateTime t = Instant.ofEpochMilli(fireAt).atZone(zone);
        LocalTime lt = t.toLocalTime();
        boolean crossesMidnight = end.isBefore(start);
        boolean inWindow = crossesMidnight
                ? (!lt.isBefore(start) || lt.isBefore(end))
                : (!lt.isBefore(start) && lt.isBefore(end));
        if (!inWindow) return fireAt;
        LocalDate day = t.toLocalDate();
        if (crossesMidnight && !lt.isBefore(start)) {
            day = day.plusDays(1);
        }
        return LocalDateTime.of(day, end).atZone(zone).toInstant().toEpochMilli();
    }

    /** Fire time deferred to five minutes past the next local midnight, for a send that hit the daily ceiling. */
    public static long nextDay(long now, ZoneId zone) {
        ZonedDateTime t = Instant.ofEpochMilli(now).atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).plusMinutes(5);
        return t.toInstant().toEpochMilli();
    }
}
