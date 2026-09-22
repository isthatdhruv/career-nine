package com.kccitm.api.service.counselling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * The reminder offsets and their firing windows, including the 5-minute
 * "join now" call added alongside the existing 12h / 4h / 2h / 15min ones.
 *
 * <p>The scheduler's own job needs a database, so these exercise the window
 * arithmetic directly: it decides whether a reminder is skipped, sent once, or
 * sent twice, and a 5-minute offset sits close enough to the 15-minute one that
 * an over-wide window would make them overlap.
 */
class ReminderOffsetWindowTest {

    private static final int CRON_INTERVAL_MIN = 5;

    @SuppressWarnings("unchecked")
    private static Map<String, Long> offsets(String field) throws Exception {
        Field f = ReminderSchedulerService.class.getDeclaredField(field);
        f.setAccessible(true);
        return new LinkedHashMap<>((Map<String, Long>) f.get(null));
    }

    private static boolean due(long minutesUntil, long offset) throws Exception {
        Method m = ReminderSchedulerService.class.getDeclaredMethod("due", long.class, long.class);
        m.setAccessible(true);
        return (boolean) m.invoke(new ReminderSchedulerService(), minutesUntil, offset);
    }

    /** Offset codes that fire at a given time-to-start, mirroring sendDueReminders. */
    private static List<String> firing(Map<String, Long> offsets, long minutesUntil) throws Exception {
        List<String> hit = new ArrayList<>();
        if (minutesUntil <= 0) return hit;              // the scheduler's own guard
        for (Map.Entry<String, Long> e : offsets.entrySet()) {
            if (due(minutesUntil, e.getValue())) hit.add(e.getKey());
        }
        return hit;
    }

    @Test
    void bothAudiencesCarryTheFiveMinuteCall() throws Exception {
        assertEquals(Long.valueOf(5L), offsets("STUDENT_OFFSETS").get("T5M"));
        assertEquals(Long.valueOf(5L), offsets("COUNSELLOR_OFFSETS").get("T5M"));
        assertEquals(java.util.Arrays.asList("T12H", "T4H", "T2H", "T15M", "T5M"),
                new ArrayList<>(offsets("STUDENT_OFFSETS").keySet()));
        assertEquals(java.util.Arrays.asList("T12H", "T2H", "T15M", "T5M"),
                new ArrayList<>(offsets("COUNSELLOR_OFFSETS").keySet()));
    }

    @Test
    void noMinuteEverFiresTwoOffsetsAtOnce() throws Exception {
        Map<String, Long> student = offsets("STUDENT_OFFSETS");
        for (long m = 1; m <= 800; m++) {
            List<String> hit = firing(student, m);
            assertTrue(hit.size() <= 1, "minutes=" + m + " fired " + hit);
        }
    }

    /**
     * Every session must actually receive the 5-minute call: whatever minute
     * the 5-minutely job lands on, some run has to fall inside the window.
     */
    @Test
    void theFiveMinuteCallCannotBeMissed() throws Exception {
        Map<String, Long> student = offsets("STUDENT_OFFSETS");
        // A session can start at any offset from the cron grid; walk them all.
        for (int phase = 0; phase < CRON_INTERVAL_MIN; phase++) {
            int fired = 0;
            // Runs at ..., 15, 10, 5, 0 minutes before the start, shifted by phase.
            for (long run = 30; run >= 0; run -= CRON_INTERVAL_MIN) {
                long minutesUntil = run + phase;
                if (firing(student, minutesUntil).contains("T5M")) fired++;
            }
            assertEquals(1, fired, "phase=" + phase + " fired T5M " + fired + " time(s)");
        }
    }

    @Test
    void theFiveMinuteWindowStopsShortOfTheFifteenMinuteOne() throws Exception {
        // 15-minute reminder owns (8, 15]; the join-now call owns (0, 5].
        for (long m = 9; m <= 15; m++) {
            assertTrue(due(m, 15L), "T15M should fire at " + m);
            assertTrue(!due(m, 5L), "T5M must not fire at " + m);
        }
        for (long m = 1; m <= 5; m++) {
            assertTrue(due(m, 5L), "T5M should fire at " + m);
            assertTrue(!due(m, 15L), "T15M must not fire at " + m);
        }
        // The gap between the two windows carries no reminder at all.
        for (long m = 6; m <= 8; m++) {
            assertTrue(!due(m, 5L) && !due(m, 15L), "unexpected reminder at " + m);
        }
    }

    /** A session booked minutes ahead gets the join-now call and nothing earlier. */
    @Test
    void aLateBookingIsNotSpammedWithEarlierReminders() throws Exception {
        assertEquals(java.util.Arrays.asList("T5M"), firing(offsets("STUDENT_OFFSETS"), 4));
        assertEquals(java.util.Arrays.asList("T5M"), firing(offsets("COUNSELLOR_OFFSETS"), 1));
    }
}
