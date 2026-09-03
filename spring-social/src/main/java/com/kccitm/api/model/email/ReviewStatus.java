package com.kccitm.api.model.email;

/** Admin review state of a template in the mail catalogue. */
public enum ReviewStatus {
    NOT_REVIEWED,
    APPROVED,
    NEEDS_CHANGE;

    public static ReviewStatus from(String value) {
        if (value == null) return null;
        try {
            return ReviewStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
