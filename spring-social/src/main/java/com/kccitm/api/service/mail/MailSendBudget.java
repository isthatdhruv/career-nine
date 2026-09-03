package com.kccitm.api.service.mail;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.mail.MailSettings;

/**
 * Daily send counters per sending account, in Redis. Every send in the system is counted
 * (the dispatcher and the async executor call {@link #recordSend}); queued automation mail
 * stops at the ceiling minus the reserve so OTPs and password resets always have headroom.
 * A Redis failure never blocks a send: counting is best effort, and the check fails open.
 */
@Service
public class MailSendBudget {

    private static final Logger logger = LoggerFactory.getLogger(MailSendBudget.class);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private MailSettingsService settings;

    public void recordSend(Long accountId) {
        try {
            String day = today();
            for (String key : new String[] {key(accountId, day), key(null, day)}) {
                Long n = redis.opsForValue().increment(key);
                if (n != null && n == 1L) {
                    redis.expire(key, 2, TimeUnit.DAYS);
                }
            }
        } catch (Exception e) {
            logger.debug("send budget not recorded: {}", e.getMessage());
        }
    }

    public long sentToday(Long accountId) {
        try {
            String v = redis.opsForValue().get(key(accountId, today()));
            return v == null ? 0L : Long.parseLong(v);
        } catch (Exception e) {
            return 0L;
        }
    }

    /** Whether a queued (non-urgent) send may go out on this account right now. */
    public boolean allowQueued(Long accountId) {
        MailSettings s = settings.get();
        long limit = Math.max(0, s.dailyCeilingPerAccount - s.reserveForImmediate);
        return sentToday(accountId) < limit;
    }

    private String today() {
        return LocalDate.now(settings.zone()).format(DAY);
    }

    private static String key(Long accountId, String day) {
        return "mail:quota:" + (accountId == null ? "all" : accountId) + ":" + day;
    }
}
