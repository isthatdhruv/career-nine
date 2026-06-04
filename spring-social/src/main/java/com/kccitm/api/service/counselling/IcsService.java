package com.kccitm.api.service.counselling;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;

/**
 * Builds an iCalendar (.ics) invite for a counselling appointment so the
 * student's calendar (Google/Apple/Outlook) picks up the event from the
 * confirmation email attachment. India has no DST and is a fixed UTC+5:30, so
 * local IST times are converted to UTC and emitted with a trailing 'Z' — the
 * most portable form across clients (no VTIMEZONE block needed).
 */
@Service
public class IcsService {

    private static final DateTimeFormatter UTC_FMT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    // India Standard Time offset relative to UTC.
    private static final int IST_OFFSET_HOURS = 5;
    private static final int IST_OFFSET_MINUTES = 30;

    /** Returns the .ics bytes, or null if the appointment lacks slot timing. */
    public byte[] buildInvite(CounsellingAppointment appt) {
        if (appt == null || appt.getSlot() == null
                || appt.getSlot().getDate() == null || appt.getSlot().getStartTime() == null) {
            return null;
        }

        LocalDateTime startLocal = LocalDateTime.of(appt.getSlot().getDate(), appt.getSlot().getStartTime());
        LocalDateTime endLocal = appt.getSlot().getEndTime() != null
                ? LocalDateTime.of(appt.getSlot().getDate(), appt.getSlot().getEndTime())
                : startLocal.plusMinutes(appt.getSlot().getDurationMinutes() != null
                        ? appt.getSlot().getDurationMinutes() : 60);

        String dtStart = toUtc(startLocal);
        String dtEnd = toUtc(endLocal);
        String dtStamp = toUtc(LocalDateTime.now());

        boolean offline = "OFFLINE".equals(appt.getMode());
        // Escape dynamic values once; they are single-line so no newline handling.
        String location = offline
                ? escapeText(safe(appt.getLocation()))
                : escapeText(safe(appt.getMeetingLink()));
        String counsellorName = appt.getCounsellor() != null ? escapeText(safe(appt.getCounsellor().getName())) : "";

        // Assemble DESCRIPTION from already-escaped pieces joined with the ICS
        // line-break token (literal backslash-n), which must NOT be re-escaped.
        StringBuilder desc = new StringBuilder("Your Career-9 counselling session.");
        if (!counsellorName.isEmpty()) desc.append("\\nCounsellor: ").append(counsellorName);
        desc.append("\\nMode: ").append(offline ? "In-person" : "Online");
        if (offline && !location.isEmpty()) desc.append("\\nVenue: ").append(location);
        if (!offline && !location.isEmpty()) desc.append("\\nMeeting link: ").append(location);

        String uid = "counselling-appt-" + appt.getId() + "@career-9.net";

        String ics = "BEGIN:VCALENDAR\r\n"
                + "VERSION:2.0\r\n"
                + "PRODID:-//Career-9//Counselling//EN\r\n"
                + "CALSCALE:GREGORIAN\r\n"
                + "METHOD:PUBLISH\r\n"
                + "BEGIN:VEVENT\r\n"
                + "UID:" + uid + "\r\n"
                + "DTSTAMP:" + dtStamp + "\r\n"
                + "DTSTART:" + dtStart + "\r\n"
                + "DTEND:" + dtEnd + "\r\n"
                + "SUMMARY:Career-9 Counselling Session\r\n"
                + (location.isEmpty() ? "" : "LOCATION:" + location + "\r\n")
                + "DESCRIPTION:" + desc.toString() + "\r\n"
                + "STATUS:CONFIRMED\r\n"
                + "BEGIN:VALARM\r\n"
                + "TRIGGER:-PT2H\r\n"
                + "ACTION:DISPLAY\r\n"
                + "DESCRIPTION:Career-9 Counselling Session reminder\r\n"
                + "END:VALARM\r\n"
                + "END:VEVENT\r\n"
                + "END:VCALENDAR\r\n";

        return ics.getBytes(StandardCharsets.UTF_8);
    }

    public String fileName(CounsellingAppointment appt) {
        return "counselling-session.ics";
    }

    private String toUtc(LocalDateTime istLocal) {
        return istLocal.minusHours(IST_OFFSET_HOURS).minusMinutes(IST_OFFSET_MINUTES).format(UTC_FMT);
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    // Escape a single-line value per RFC 5545: backslash, comma, semicolon.
    // Newlines are stripped (callers join multi-line text with the literal
    // "\n" token themselves, after escaping the individual pieces).
    private String escapeText(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace(",", "\\,")
                .replace(";", "\\;")
                .replace("\r", "")
                .replace("\n", " ");
    }
}
