package com.kccitm.api.model.email;

/**
 * Outcome of an {@code EmailDispatchService.send(...)} call. For SYNC sends the caller
 * can inspect {@link #isSuccess()} / {@link #getError()}; for ASYNC sends it reflects only
 * that the message was queued (the terminal status lands in {@code email_send_log}).
 */
public class EmailSendResult {

    private final boolean success;
    private final EmailSendStatus status;
    private final Long logId;
    private final Long accountId;
    private final String error;

    public EmailSendResult(boolean success, EmailSendStatus status, Long logId, Long accountId, String error) {
        this.success = success;
        this.status = status;
        this.logId = logId;
        this.accountId = accountId;
        this.error = error;
    }

    public static EmailSendResult queued(Long logId, Long accountId) {
        return new EmailSendResult(true, EmailSendStatus.QUEUED, logId, accountId, null);
    }

    public static EmailSendResult sent(Long logId, Long accountId) {
        return new EmailSendResult(true, EmailSendStatus.SENT, logId, accountId, null);
    }

    public static EmailSendResult failed(Long logId, Long accountId, String error) {
        return new EmailSendResult(false, EmailSendStatus.FAILED, logId, accountId, error);
    }

    public static EmailSendResult skipped(Long logId, String error) {
        return new EmailSendResult(false, EmailSendStatus.SKIPPED, logId, null, error);
    }

    public boolean isSuccess() { return success; }
    public EmailSendStatus getStatus() { return status; }
    public Long getLogId() { return logId; }
    public Long getAccountId() { return accountId; }
    public String getError() { return error; }
}
