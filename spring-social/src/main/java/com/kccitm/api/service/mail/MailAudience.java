package com.kccitm.api.service.mail;

import java.util.List;

import com.kccitm.api.model.mail.MailEventContext;

/**
 * A cohort a scheduled automation can address: "counsellors with sessions tomorrow", "students
 * with an unbooked counselling session". Resolved when the automation's cron fires; each
 * member comes back as a full event context (recipients, fields, subjects) so the same
 * template machinery applies. Implement as a Spring bean and it appears in the editor.
 */
public interface MailAudience {
    String key();
    String label();
    String description();
    List<MailEventContext> resolve();
}
