package com.kccitm.api.service.mail;

import com.kccitm.api.model.mail.MailEventContext;

/**
 * The one call a flow makes to report that something happened. Safe to call from anywhere:
 * when the automation engine is switched off the call is a no-op, when it is on the event is
 * matched against admin automations after the surrounding transaction commits, and a failure
 * inside the engine is logged and never propagates to the caller.
 */
public interface MailEvents {
    void publish(MailEventContext context);
}
