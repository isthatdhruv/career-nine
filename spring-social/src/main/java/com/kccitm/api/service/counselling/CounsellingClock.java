package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * "What time is it now?" for counselling, answered in the counselling timezone.
 *
 * <p><b>Why this exists.</b> Slot dates and times are stored as bare {@code LocalDate} +
 * {@code LocalTime} with no zone attached — counsellors enter them meaning IST. The JVM,
 * however, has no timezone configured anywhere in this repo (no {@code TZ} env var, no
 * {@code user.timezone}), so in a container it runs on <b>UTC</b>. Comparing a UTC "now"
 * against an IST wall-clock slot time is wrong by 5h30m, in the direction that
 * <i>under-restricts</i>: a plain {@code LocalDateTime.now()} would let a session be
 * cancelled hours after it had already finished.
 *
 * <p>Every counselling check that compares a time of day against the present moment must go
 * through this class rather than calling {@code LocalDateTime.now()} directly.
 *
 * <p>Three rules, each guarding a real failure mode:
 * <ol>
 *   <li><b>Only "now" is shifted — the stored slot time is never touched.</b> Slot times are
 *       already IST and correct as stored. Shifting those too produces the same 5h30m error
 *       in the opposite direction.</li>
 *   <li><b>Date and time shift together.</b> Callers that need both must take them from here,
 *       not mix {@link #today()} with a raw {@code LocalTime.now()} — between 00:00 and 05:30
 *       IST that pairs yesterday's date with today's time.</li>
 *   <li><b>The conversion lives in exactly one place.</b> Written inline at each call site it
 *       would eventually be applied twice, or missed once.</li>
 * </ol>
 *
 * <p>The zone is configured as a name ({@code Asia/Kolkata}) rather than a fixed +05:30
 * offset. Identical for India, which has no daylight saving — but a named zone is the only
 * form that survives a second country later.
 */
@Component
public class CounsellingClock {

    private final ZoneId zone;

    public CounsellingClock(@Value("${app.counselling.timezone:Asia/Kolkata}") String timezone) {
        this.zone = ZoneId.of(timezone);
    }

    /** Present moment in the counselling timezone. Compare slot date+time against this. */
    public LocalDateTime now() {
        return LocalDateTime.now(zone);
    }

    /** Today's date in the counselling timezone. */
    public LocalDate today() {
        return LocalDate.now(zone);
    }

    /** Current time of day in the counselling timezone. */
    public LocalTime timeNow() {
        return LocalTime.now(zone);
    }

    /** The configured zone, for callers that need to convert something else. */
    public ZoneId zone() {
        return zone;
    }

    /**
     * The start of a slot as a comparable instant in counselling-local terms. Pairs with
     * {@link #now()} — both are wall-clock in the same zone, so the subtraction is meaningful.
     */
    public LocalDateTime sessionStart(LocalDate date, LocalTime startTime) {
        return LocalDateTime.of(date, startTime);
    }

    /** True when {@code start} is less than {@code hours} away (or already past). */
    public boolean isWithinHoursOfNow(LocalDateTime start, int hours) {
        return now().plusHours(hours).isAfter(start);
    }

    /** Minutes elapsed since {@code start}; negative when {@code start} is still in the future. */
    public long minutesSince(LocalDateTime start) {
        return java.time.Duration.between(start, now()).toMinutes();
    }
}
