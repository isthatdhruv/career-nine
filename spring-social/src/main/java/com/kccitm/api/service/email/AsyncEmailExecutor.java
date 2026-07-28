package com.kccitm.api.service.email;

import java.util.Date;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailSendLog;
import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.repository.email.EmailSendLogRepository;

/**
 * Runs ASYNC sends on the bounded {@code applicationTaskExecutor} pool. Kept as a separate
 * bean (not a method on {@code EmailDispatchService}) so Spring's {@code @Async} proxy
 * actually applies — a self-invoked {@code @Async} method would run inline.
 */
@Component
public class AsyncEmailExecutor {

    private static final Logger logger = LoggerFactory.getLogger(AsyncEmailExecutor.class);

    @Autowired
    private SenderFactory senderFactory;

    @Autowired
    private EmailSendLogRepository logRepository;

    /** Send and update the pre-created {@code email_send_log} row to SENT/FAILED. */
    @Async
    public void sendAsync(Long logId, EmailAccount account, SmtpEmailRequest message) {
        try {
            senderFactory.forAccount(account).send(message);
            updateLog(logId, EmailSendStatus.SENT, null);
        } catch (Exception e) {
            logger.error("Async email send failed (logId={}, account={}): {}",
                    logId, account.getId(), e.getMessage(), e);
            updateLog(logId, EmailSendStatus.FAILED, e.getMessage());
        }
    }

    private void updateLog(Long logId, EmailSendStatus status, String error) {
        if (logId == null) {
            return;
        }
        try {
            Optional<EmailSendLog> opt = logRepository.findById(logId);
            if (!opt.isPresent()) {
                return;
            }
            EmailSendLog row = opt.get();
            row.setStatus(status);
            if (status == EmailSendStatus.SENT) {
                row.setSentAt(new Date());
            }
            if (error != null) {
                row.setErrorMessage(error.length() > 2000 ? error.substring(0, 2000) : error);
            }
            logRepository.save(row);
        } catch (Exception e) {
            logger.error("Failed to update email_send_log row {}: {}", logId, e.getMessage(), e);
        }
    }
}
