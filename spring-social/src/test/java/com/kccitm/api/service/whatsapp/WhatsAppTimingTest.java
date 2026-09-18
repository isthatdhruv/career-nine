package com.kccitm.api.service.whatsapp;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.TimeZone;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The time in a WhatsApp is the time in the email, on a JVM running UTC.
 *
 * <p>This application forces the whole JVM to UTC at startup, while counselling slots are stored
 * as bare wall-clock values that counsellors entered meaning IST. That combination has already
 * caused one real fault — reminders computing "how long until this session" against a UTC now,
 * landing five and a half hours adrift — so the second channel is worth pinning down before it
 * repeats the mistake in a new place.
 *
 * <p>It does not, and these say why: the times a message shows are {@code LocalDate} and
 * {@code LocalTime} read straight off the slot and formatted. Neither type carries a zone, so
 * formatting cannot convert one, and the default timezone is not consulted. The WhatsApp and the
 * email format the same two values with the same two formatters, so they cannot disagree.
 *
 * <p>The separate question of <i>when</i> a notification fires is not decided here at all. It is
 * decided by the scheduler, through {@code CounsellingClock}, and the WhatsApp is dispatched
 * from inside the same send as the email rather than on a schedule of its own — so there is one
 * decision, not two that have to be kept in step.
 */
class WhatsAppTimingTest {

    /** The two formatters CounsellingNotificationService uses for every channel. */
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a");

    private final TimeZone original = TimeZone.getDefault();

    @AfterEach
    void restoreTimezone() {
        TimeZone.setDefault(original);
    }

    /**
     * A 9:30am session reads as 9:30am whatever the JVM thinks the time is. If this ever fails,
     * a zone has been introduced somewhere between the slot and the message.
     */
    @Test
    void slotTimesDoNotShiftWithTheJvmTimezone() {
        LocalDate date = LocalDate.of(2026, 3, 12);
        LocalTime start = LocalTime.of(9, 30);

        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        String utcDate = date.format(DATE_FMT);
        String utcTime = start.format(TIME_FMT);

        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        assertEquals(utcDate, date.format(DATE_FMT), "the date must not move with the JVM zone");
        assertEquals(utcTime, start.format(TIME_FMT), "the time must not move with the JVM zone");

        TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"));
        assertEquals(utcDate, date.format(DATE_FMT));
        assertEquals(utcTime, start.format(TIME_FMT));

        assertEquals("March 12, 2026", utcDate);
        assertEquals("9:30 AM", utcTime);
    }

    /**
     * The WhatsApp parameter and the email row are built from the same two values, so they say
     * the same thing. This is the assertion that would break if one channel ever started
     * formatting through a zoned type.
     */
    @Test
    void theWhatsAppTimeMatchesTheEmailTime() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        LocalDate date = LocalDate.of(2026, 3, 12);
        LocalTime start = LocalTime.of(14, 0);

        // As CounsellingMails.Session builds it for the email.
        String emailDate = date.format(DATE_FMT);
        String emailTime = start.format(TIME_FMT);

        // As sessionParams builds it for the WhatsApp template.
        String whatsAppWhen = date.format(DATE_FMT) + " " + start.format(TIME_FMT);

        assertEquals(emailDate + " " + emailTime, whatsAppWhen);
        assertEquals("March 12, 2026 2:00 PM", whatsAppWhen);
    }
}
