package com.kccitm.api.model.mail;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One scheduled send, stored as JSON in Redis. Carries a snapshot of everything needed to
 * render and send without touching MySQL: recipients, placeholder values, typed refs for
 * fire-time rechecks, and the automation's timing so the next repeat can be scheduled.
 */
public class MailJob {
    public String id;
    public Long automationId;
    public String automationKey;
    public String automationName;
    public String eventKey;
    /** Primary subject the job is indexed under, e.g. {@code entitlement:123}. */
    public String subjectKey;
    public List<String> subjects = new ArrayList<>();
    public String role;
    public List<String> to = new ArrayList<>();
    public List<String> cc = new ArrayList<>();
    public List<String> bcc = new ArrayList<>();
    public Map<String, String> fields = new LinkedHashMap<>();
    public Map<String, Long> refs = new LinkedHashMap<>();
    public Integer instituteCode;
    public Long userStudentId;
    public Long templateId;
    public String templateName;
    public String emailType;
    public long fireAt;
    public long createdAt;
    public int attempts;
    /** 1-based send number for repeating automations. */
    public int seq = 1;
    /** Offset in minutes from the relative date, when the automation is relative. */
    public Integer offsetMinutes;
    public Integer maxSends;
    public Integer repeatEveryMinutes;
    public String dedupeKey;
    public String capKey;
    public String status = MailJobStatus.PENDING.name();
    public String lastError;
    public String skipReason;
    public boolean recheck;
    public boolean respectQuietHours = true;
    public List<String> conditions = new ArrayList<>();
    public long updatedAt;

    public String primaryRecipient() {
        return to.isEmpty() ? null : to.get(0);
    }
}
