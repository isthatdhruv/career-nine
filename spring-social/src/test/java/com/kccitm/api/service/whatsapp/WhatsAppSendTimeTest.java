package com.kccitm.api.service.whatsapp;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.TimeZone;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.kccitm.api.model.career9.CommunicationLog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * When a WhatsApp is recorded as having been sent.
 *
 * <p>Separate from {@link WhatsAppTimingTest}, which covers the times a message <i>shows</i>.
 * This is about the timestamp written against the send, and it had the classic fault: the JVM is
 * forced to UTC at startup, {@code LocalDateTime} carries no zone, so {@code LocalDateTime.now()}
 * wrote a UTC wall-clock reading into a plain datetime column. Read back by an India-based admin
 * it is five and a half hours early — a message sent at 9:00 am appears in the Communication Log
 * at 3:30 am, which is not a rounding error but a different night.
 *
 * <p>The email log never had this, because it stamps a {@code java.util.Date} — an absolute
 * instant. So the two channels disagreed with each other as well as with reality.
 */
class WhatsAppSendTimeTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final TimeZone original = TimeZone.getDefault();

    @AfterEach
    void restoreTimezone() {
        TimeZone.setDefault(original);
    }

    /**
     * The row stamps itself in IST even when the JVM is UTC — which in this application it
     * always is, set in a static block before any bean exists.
     */
    @Test
    void logRowIsStampedInIstOnAUtcJvm() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        CommunicationLog row = new CommunicationLog();
        row.prePersist();

        LocalDateTime expected = LocalDateTime.now(IST);
        long driftSeconds = Math.abs(Duration.between(expected, row.getCreatedAt()).getSeconds());

        assertTrue(driftSeconds < 5,
                "expected an IST stamp near " + expected + " but got " + row.getCreatedAt());
    }

    /**
     * The specific regression, stated as the gap it used to leave. A UTC stamp sits 19800
     * seconds behind an IST one; anything near that is the bug returning.
     */
    @Test
    void theStampIsNotFiveAndAHalfHoursBehind() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        CommunicationLog row = new CommunicationLog();
        row.prePersist();

        long behindIst = Duration.between(row.getCreatedAt(), LocalDateTime.now(IST)).getSeconds();
        assertTrue(behindIst < 60,
                "the WhatsApp send time is " + behindIst + "s behind IST — a UTC stamp is 19800s behind");
    }

    /** An explicitly-set timestamp is left alone; only a missing one is filled in. */
    @Test
    void anExplicitTimestampIsNotOverwritten() {
        LocalDateTime chosen = LocalDateTime.of(2026, 3, 12, 9, 0);

        CommunicationLog row = new CommunicationLog();
        row.setCreatedAt(chosen);
        row.prePersist();

        assertEquals(chosen, row.getCreatedAt());
    }
}
