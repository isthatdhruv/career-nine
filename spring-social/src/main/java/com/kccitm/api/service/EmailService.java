package com.kccitm.api.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;

/**
 * Legacy KCCITM template-email service. The third-party provider — and its hardcoded API
 * keys — has been retired; this is now a no-op kept only so the call sites still compile.
 * All real email now flows through {@code EmailDispatchService}.
 */
@Service
public class EmailService {

    public void sendMessageUsingTemplates(String subject, User recipientsUser, String senderName,
            String senderEmail, String templateName, Map<String, Object> data) {
        // Legacy KCCITM provider email retired — no-op.
    }
}
