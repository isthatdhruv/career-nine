package com.kccitm.api.service.email;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * SHA-256 over a template's subject, body and text. Stored at seed time and compared against
 * the current content so the catalogue can say "untouched since it was lifted from code".
 */
public final class TemplateContentHash {

    private TemplateContentHash() {
    }

    public static String of(String subject, String body, String text) {
        String joined = nz(subject) + "\n\u0000" + nz(body) + "\n\u0000" + nz(text);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(joined.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : d) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
