package com.kccitm.api.service.email;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailAccountCredentials;
import com.kccitm.api.model.email.EmailMode;
import com.kccitm.api.model.email.EmailProvider;

/**
 * Builds a {@link ConfiguredEmailSender} for an {@link EmailAccount}, replacing the old
 * compile-time {@code @Primary}/{@code @ConditionalOnProperty} transport selection with a
 * runtime registry. Senders are cached per (account id + updatedAt) so the (expensive)
 * Gmail/SMTP/Odoo client is reused until the account is edited.
 */
@Component
public class SenderFactory {

    @Value("classpath:firebase-service-account.json")
    private Resource classpathServiceAccount;

    private final ConcurrentHashMap<String, ConfiguredEmailSender> cache = new ConcurrentHashMap<>();

    public ConfiguredEmailSender forAccount(EmailAccount account) {
        if (account.getId() == null) {
            // Transient draft (pre-save "test connection") — build fresh, never cache.
            return build(account);
        }
        long version = account.getUpdatedAt() != null ? account.getUpdatedAt().getTime() : 0L;
        String key = account.getId() + ":" + version;
        return cache.computeIfAbsent(key, k -> build(account));
    }

    private ConfiguredEmailSender build(EmailAccount account) {
        EmailAccountCredentials creds = EmailAccountCredentials.parse(account.getCredentials());
        if (account.getProvider() == EmailProvider.ODOO) {
            return new OdooSender(account, creds);
        }
        // GMAIL
        if (account.getMode() == EmailMode.SMTP) {
            return new GmailSmtpSender(account, creds);
        }
        return new GmailApiSender(account, creds, classpathServiceAccount);
    }
}
