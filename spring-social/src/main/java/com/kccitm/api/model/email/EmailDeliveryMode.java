package com.kccitm.api.model.email;

/**
 * Whether a send blocks the caller or is handed off.
 *
 * <p>{@code SYNC} — the dispatcher sends inline and returns a result (failures are
 * surfaced to the caller / frontend); use for important mail (credentials, payment,
 * reports). {@code ASYNC} — fire-and-forget on the bounded async executor; the result
 * is captured in {@code email_send_log} only. Set per template (Phase 3); before
 * templates exist it defaults per {@link EmailType}.
 */
public enum EmailDeliveryMode {
    SYNC,
    ASYNC
}
