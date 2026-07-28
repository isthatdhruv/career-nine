package com.kccitm.api.config;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Pushes the configured email-credential encryption key into {@link EncryptedStringConverter}
 * at startup. The converter is instantiated by Hibernate (not Spring) and so can't inject the
 * property itself; this Spring-managed configurer reads it from the resolved environment
 * (covering both {@code .env} imports and real OS env vars) and hands it over.
 */
@Configuration
public class EmailCryptoKeyConfigurer {

    @Value("${app.email.crypto-key:${EMAIL_CRYPTO_KEY:}}")
    private String cryptoKey;

    @PostConstruct
    public void init() {
        EncryptedStringConverter.setConfiguredKey(cryptoKey);
    }
}
