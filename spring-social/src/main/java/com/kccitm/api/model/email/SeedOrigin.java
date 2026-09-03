package com.kccitm.api.model.email;

/**
 * Where a template's content came from. {@code SEED} is one of the original flagship seeds,
 * {@code CODE_PORT} was lifted verbatim from an inline Java HTML builder for review,
 * {@code REMINDER_CONFIG} came from the legacy reminder_config table, {@code MANUAL} was
 * written by an admin in the editor.
 */
public enum SeedOrigin {
    SEED,
    CODE_PORT,
    REMINDER_CONFIG,
    MANUAL
}
