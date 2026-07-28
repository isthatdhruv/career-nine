package com.kccitm.api.model.email;

/** Lifecycle status of a single send, recorded in {@code email_send_log}. */
public enum EmailSendStatus {
    /** Handed to the async executor; not yet confirmed sent. */
    QUEUED,
    /** Provider accepted the message. */
    SENT,
    /** Provider call threw / rejected. */
    FAILED,
    /** Intentionally not sent (e.g. no recipient, no account configured). */
    SKIPPED
}
