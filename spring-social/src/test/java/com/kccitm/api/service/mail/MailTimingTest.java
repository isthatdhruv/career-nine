package com.kccitm.api.service.mail;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailEventContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MailTimingTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @Test
    @DisplayName("a delay automation fires once, delay minutes after now")
    void delay() {
        MailAutomation a = new MailAutomation();
        a.setDelayMinutes(1440);
        MailEventContext ctx = MailEventContext.of(MailEvent.ENTITLEMENT_GRANTED).build();
        long now = 1_000_000_000L;
        List<MailTiming.Occurrence> occ = MailTiming.plan(a, ctx, now);
        assertEquals(1, occ.size());
        assertEquals(now + 1440 * 60_000L, occ.get(0).fireAt);
        assertEquals(1, occ.get(0).seq);
    }

    @Test
    @DisplayName("relative automations fire once per offset around the event date, dropping offsets already past")
    void relative() {
        MailAutomation a = new MailAutomation();
        a.setRelativeToField("session_start");
        a.setRelativeOffsetsMinutes("-720,-120,-15");
        long now = 1_000_000_000L;
        Date start = new Date(now + 3 * 60 * 60_000L); // in 3 hours
        MailEventContext ctx = MailEventContext.of(MailEvent.APPOINTMENT_CONFIRMED).date("session_start", start).build();
        List<MailTiming.Occurrence> occ = MailTiming.plan(a, ctx, now);
        assertEquals(2, occ.size()); // 12h before is already past
        assertEquals(start.getTime() - 120 * 60_000L, occ.get(0).fireAt);
        assertEquals(Integer.valueOf(-120), occ.get(0).offsetMinutes);
        assertEquals(start.getTime() - 15 * 60_000L, occ.get(1).fireAt);
        assertTrue(MailTiming.plan(a, MailEventContext.of(MailEvent.APPOINTMENT_CONFIRMED).build(), now).isEmpty());
    }

    @Test
    @DisplayName("repeats stop at max sends")
    void repeats() {
        MailAutomation a = new MailAutomation();
        a.setRepeatEveryMinutes(60);
        a.setMaxSends(2);
        assertEquals(1000 + 3_600_000L, MailTiming.nextRepeat(a, 1, 1000));
        assertEquals(-1L, MailTiming.nextRepeat(a, 2, 1000));
        a.setRepeatEveryMinutes(null);
        assertEquals(-1L, MailTiming.nextRepeat(a, 1, 1000));
    }

    @Test
    @DisplayName("quiet hours push a send to the end of the window, across midnight too")
    void quietHours() {
        LocalTime start = LocalTime.of(21, 0);
        LocalTime end = LocalTime.of(8, 0);
        long at2300 = ZonedDateTime.of(2026, 9, 3, 23, 0, 0, 0, IST).toInstant().toEpochMilli();
        long moved = MailTiming.applyQuietHours(at2300, start, end, IST);
        assertEquals(ZonedDateTime.of(2026, 9, 4, 8, 0, 0, 0, IST).toInstant().toEpochMilli(), moved);
        long at0300 = ZonedDateTime.of(2026, 9, 4, 3, 0, 0, 0, IST).toInstant().toEpochMilli();
        assertEquals(moved, MailTiming.applyQuietHours(at0300, start, end, IST));
        long at1200 = ZonedDateTime.of(2026, 9, 4, 12, 0, 0, 0, IST).toInstant().toEpochMilli();
        assertEquals(at1200, MailTiming.applyQuietHours(at1200, start, end, IST));
        assertEquals(at2300, MailTiming.applyQuietHours(at2300, null, null, IST));
    }

    @Test
    void nextDay() {
        long at = ZonedDateTime.of(2026, 9, 3, 15, 30, 0, 0, IST).toInstant().toEpochMilli();
        long next = MailTiming.nextDay(at, IST);
        assertEquals(ZonedDateTime.of(2026, 9, 4, 0, 5, 0, 0, IST).toInstant().toEpochMilli(), next);
        assertTrue(Instant.ofEpochMilli(next).isAfter(Instant.ofEpochMilli(at)));
    }
}
