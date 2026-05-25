package com.kccitm.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.CommunicationLog;
import com.kccitm.api.repository.Career9.CommunicationLogRepository;

/**
 * Records every email/WhatsApp send attempt in the communication_log table.
 * Failures while logging are swallowed and just logged — they must never
 * break the actual send flow.
 */
@Service
public class CommunicationLogService {

    private static final Logger logger = LoggerFactory.getLogger(CommunicationLogService.class);

    public static final String CHANNEL_EMAIL = "EMAIL";
    public static final String CHANNEL_WHATSAPP = "WHATSAPP";
    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_FAILED = "FAILED";

    @Autowired
    private CommunicationLogRepository repository;

    /** Log an email send. errorMessage may be null for successful sends. */
    public void logEmail(String recipientName, String recipientEmail, String messageType,
                         boolean success, String errorMessage) {
        try {
            CommunicationLog log = new CommunicationLog();
            log.setChannel(CHANNEL_EMAIL);
            log.setRecipientName(recipientName);
            log.setRecipientEmail(recipientEmail);
            log.setMessageType(messageType);
            log.setStatus(success ? STATUS_SENT : STATUS_FAILED);
            log.setErrorMessage(errorMessage);
            log.setSentBy(currentUser());
            repository.save(log);
        } catch (Exception e) {
            logger.warn("Failed to record email communication log: {}", e.getMessage());
        }
    }

    /** Log a WhatsApp send. errorMessage may be null for successful sends. */
    public void logWhatsApp(String recipientName, String recipientPhone, String messageType,
                            boolean success, String errorMessage) {
        try {
            CommunicationLog log = new CommunicationLog();
            log.setChannel(CHANNEL_WHATSAPP);
            log.setRecipientName(recipientName);
            log.setRecipientPhone(recipientPhone);
            log.setMessageType(messageType);
            log.setStatus(success ? STATUS_SENT : STATUS_FAILED);
            log.setErrorMessage(errorMessage);
            log.setSentBy(currentUser());
            repository.save(log);
        } catch (Exception e) {
            logger.warn("Failed to record whatsapp communication log: {}", e.getMessage());
        }
    }

    private String currentUser() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
                return auth.getName();
            }
        } catch (Exception ignored) {}
        return null;
    }
}
