package com.kccitm.api.model.email;

/**
 * Catalog of every send-scenario in the system. Each value is a configurable
 * "slot": the admin picks a default template (Phase 3) and the dispatcher logs
 * sends under this key. {@link #defaultDeliveryMode()} is used until a template's
 * own per-template mode applies.
 *
 * <p>Phase 1 ships the auth/account scenarios that are migrated first; the full
 * catalog (credentials, payments, reports, B2C, counselling, KCCITM…) is filled in
 * as each call site moves onto the dispatcher in later phases.
 */
public enum EmailType {

    PASSWORD_RESET("Password reset link", EmailDeliveryMode.SYNC),
    PASSWORD_RESET_CONFIRM("Password reset confirmation", EmailDeliveryMode.ASYNC),
    ACCOUNT_WELCOME("Account welcome / under review", EmailDeliveryMode.ASYNC),
    ACCOUNT_ACTIVATED("Account activated", EmailDeliveryMode.ASYNC),
    ADMIN_PASSWORD_RESET("Admin-issued password reset", EmailDeliveryMode.SYNC),
    ACCOUNT_TEST("Email-account test message", EmailDeliveryMode.SYNC),
    GENERIC("Generic / ad-hoc email", EmailDeliveryMode.ASYNC);

    private final String label;
    private final EmailDeliveryMode defaultDeliveryMode;

    EmailType(String label, EmailDeliveryMode defaultDeliveryMode) {
        this.label = label;
        this.defaultDeliveryMode = defaultDeliveryMode;
    }

    public String label() {
        return label;
    }

    public EmailDeliveryMode defaultDeliveryMode() {
        return defaultDeliveryMode;
    }

    /** Null-safe lookup by name; returns null for unknown keys. */
    public static EmailType from(String name) {
        if (name == null) return null;
        try {
            return EmailType.valueOf(name.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
