package com.kccitm.api.config;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.persistence.AttributeConverter;
import javax.persistence.Converter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Transparent AES-GCM encryption for sensitive entity columns (email-account
 * credentials). Applied explicitly via {@code @Convert(converter = ...)} — NOT
 * {@code autoApply}, so only opted-in columns are encrypted.
 *
 * <p>The key is read from the {@code EMAIL_CRYPTO_KEY} env var (or system property)
 * as base64-encoded 32 bytes. AttributeConverters are instantiated by Hibernate, not
 * Spring, so we read the key from the environment directly rather than via injection.
 *
 * <p>Stored form is prefix-tagged so the column can hold mixed states during rollout:
 * <ul>
 *   <li>{@code v1:<base64(iv||ciphertext||tag)>} — AES-GCM encrypted (key present).</li>
 *   <li>{@code plain:<value>} — written when no key is set (dev convenience; logs a
 *       one-time warning). Production MUST set the key.</li>
 *   <li>anything else — returned as-is (e.g. a value seeded by a migration).</li>
 * </ul>
 */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(EncryptedStringConverter.class);

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String ENC_PREFIX = "v1:";
    private static final String PLAIN_PREFIX = "plain:";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile boolean warnedNoKey = false;

    /**
     * Key resolved from Spring properties ({@code app.email.crypto-key} →
     * {@code EMAIL_CRYPTO_KEY}), set at startup by {@link EmailCryptoKeyConfigurer}. This
     * matters because secrets are loaded via {@code spring.config.import} (.env files) into
     * Spring's Environment, NOT into {@code System.getenv}. Falls back to the OS env /
     * system property so a key set directly on the container also works.
     */
    private static volatile String configuredKeyB64;

    public static void setConfiguredKey(String b64) {
        configuredKeyB64 = b64;
    }

    private static byte[] key() {
        String b64 = configuredKeyB64;
        if (b64 == null || b64.trim().isEmpty()) {
            b64 = System.getenv("EMAIL_CRYPTO_KEY");
        }
        if (b64 == null || b64.trim().isEmpty()) {
            b64 = System.getProperty("EMAIL_CRYPTO_KEY");
        }
        if (b64 == null || b64.trim().isEmpty()) {
            return null;
        }
        return Base64.getDecoder().decode(b64.trim());
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) {
            return null;
        }
        byte[] key = key();
        if (key == null) {
            if (!warnedNoKey) {
                warnedNoKey = true;
                log.warn("EMAIL_CRYPTO_KEY not set — storing email-account credentials WITHOUT "
                        + "encryption. Set EMAIL_CRYPTO_KEY (base64 32 bytes) before production.");
            }
            return PLAIN_PREFIX + attribute;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(cipherText, 0, out, iv.length, cipherText.length);
            return ENC_PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt credentials", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        if (dbData.startsWith(PLAIN_PREFIX)) {
            return dbData.substring(PLAIN_PREFIX.length());
        }
        if (!dbData.startsWith(ENC_PREFIX)) {
            // Legacy / migration-seeded plaintext (e.g. the bootstrap default account).
            return dbData;
        }
        byte[] key = key();
        if (key == null) {
            throw new IllegalStateException(
                    "EMAIL_CRYPTO_KEY not set but encrypted credentials are present in the DB");
        }
        try {
            byte[] all = Base64.getDecoder().decode(dbData.substring(ENC_PREFIX.length()));
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(all, 0, iv, 0, IV_LENGTH);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            byte[] plain = cipher.doFinal(all, IV_LENGTH, all.length - IV_LENGTH);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt credentials", e);
        }
    }
}
