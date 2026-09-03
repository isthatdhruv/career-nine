package com.kccitm.api.service.mail;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.mail.MailSetting;
import com.kccitm.api.model.mail.MailSettings;
import com.kccitm.api.repository.mail.MailSettingRepository;

/**
 * Engine configuration, edited from the Settings tab and read on every publish and every
 * poll. Cached in process for 30 seconds so the hot path never reads MySQL; both containers
 * pick an edit up within that window.
 */
@Service
public class MailSettingsService {

    private static final Logger logger = LoggerFactory.getLogger(MailSettingsService.class);
    private static final long TTL_MS = 30_000L;

    public static final String ENGINE_ENABLED = "engine_enabled";
    public static final String DAILY_CEILING = "daily_ceiling_per_account";
    public static final String RESERVE = "reserve_for_immediate";
    public static final String PACE = "pace_sends_per_second";
    public static final String QUIET_START = "quiet_hours_start";
    public static final String QUIET_END = "quiet_hours_end";
    public static final String TIMEZONE = "timezone";
    public static final String STAGING_SINK = "staging_sink_email";

    @Autowired
    private MailSettingRepository repository;

    private volatile MailSettings cached;
    private volatile long loadedAt;

    public MailSettings get() {
        MailSettings c = cached;
        if (c != null && System.currentTimeMillis() - loadedAt < TTL_MS) {
            return c;
        }
        return reload();
    }

    public synchronized MailSettings reload() {
        MailSettings s = new MailSettings();
        try {
            Map<String, String> raw = new HashMap<>();
            Date newest = null;
            List<MailSetting> rows = repository.findAll();
            for (MailSetting row : rows) {
                raw.put(row.getKey(), row.getValue());
                if (row.getUpdatedAt() != null && (newest == null || row.getUpdatedAt().after(newest))) {
                    newest = row.getUpdatedAt();
                }
            }
            s.engineEnabled = "true".equalsIgnoreCase(raw.get(ENGINE_ENABLED));
            s.dailyCeilingPerAccount = intOr(raw.get(DAILY_CEILING), s.dailyCeilingPerAccount);
            s.reserveForImmediate = intOr(raw.get(RESERVE), s.reserveForImmediate);
            s.paceSendsPerSecond = Math.max(1, intOr(raw.get(PACE), s.paceSendsPerSecond));
            s.quietHoursStart = blankToNull(raw.get(QUIET_START));
            s.quietHoursEnd = blankToNull(raw.get(QUIET_END));
            s.timezone = raw.get(TIMEZONE) != null && !raw.get(TIMEZONE).trim().isEmpty() ? raw.get(TIMEZONE).trim() : s.timezone;
            s.stagingSinkEmail = blankToNull(raw.get(STAGING_SINK));
            s.updatedAt = newest;
        } catch (Exception e) {
            // A settings read failure must never stop the app; fall back to the safe defaults (engine off).
            logger.warn("Could not load mail settings, using defaults: {}", e.getMessage());
        }
        cached = s;
        loadedAt = System.currentTimeMillis();
        return s;
    }

    @Transactional
    public MailSettings update(MailSettings in, Long userId) {
        if (in.dailyCeilingPerAccount < 1) throw new IllegalArgumentException("dailyCeilingPerAccount must be at least 1");
        if (in.reserveForImmediate < 0 || in.reserveForImmediate >= in.dailyCeilingPerAccount) {
            throw new IllegalArgumentException("reserveForImmediate must be between 0 and the daily ceiling");
        }
        if (in.paceSendsPerSecond < 1 || in.paceSendsPerSecond > 20) throw new IllegalArgumentException("paceSendsPerSecond must be 1-20");
        if ((in.quietHoursStart == null) != (in.quietHoursEnd == null)) {
            throw new IllegalArgumentException("quiet hours need both a start and an end, or neither");
        }
        parseTime(in.quietHoursStart);
        parseTime(in.quietHoursEnd);
        try {
            ZoneId.of(in.timezone == null ? "Asia/Kolkata" : in.timezone);
        } catch (Exception e) {
            throw new IllegalArgumentException("unknown timezone: " + in.timezone);
        }
        put(ENGINE_ENABLED, String.valueOf(in.engineEnabled), userId);
        put(DAILY_CEILING, String.valueOf(in.dailyCeilingPerAccount), userId);
        put(RESERVE, String.valueOf(in.reserveForImmediate), userId);
        put(PACE, String.valueOf(in.paceSendsPerSecond), userId);
        put(QUIET_START, in.quietHoursStart, userId);
        put(QUIET_END, in.quietHoursEnd, userId);
        put(TIMEZONE, in.timezone == null ? "Asia/Kolkata" : in.timezone, userId);
        put(STAGING_SINK, in.stagingSinkEmail, userId);
        return reload();
    }

    public boolean engineEnabled() {
        return get().engineEnabled;
    }

    public ZoneId zone() {
        try {
            return ZoneId.of(get().timezone);
        } catch (Exception e) {
            return ZoneId.of("Asia/Kolkata");
        }
    }

    /** [start, end] or null when no quiet window is configured. */
    public LocalTime[] quietWindow() {
        MailSettings s = get();
        LocalTime a = parseTime(s.quietHoursStart);
        LocalTime b = parseTime(s.quietHoursEnd);
        return (a == null || b == null) ? null : new LocalTime[] {a, b};
    }

    private void put(String key, String value, Long userId) {
        MailSetting row = repository.findById(key).orElse(new MailSetting(key, null));
        row.setValue(value);
        row.setUpdatedBy(userId);
        repository.save(row);
    }

    static LocalTime parseTime(String hhmm) {
        if (hhmm == null || hhmm.trim().isEmpty()) return null;
        try {
            return LocalTime.parse(hhmm.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("time must be HH:mm, got " + hhmm);
        }
    }

    private static int intOr(String v, int dflt) {
        if (v == null || v.trim().isEmpty()) return dflt;
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return dflt;
        }
    }

    private static String blankToNull(String v) {
        return v == null || v.trim().isEmpty() ? null : v.trim();
    }
}
