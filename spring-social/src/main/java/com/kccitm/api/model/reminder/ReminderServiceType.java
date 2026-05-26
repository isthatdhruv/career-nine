package com.kccitm.api.model.reminder;

/**
 * Identifies one of the four reminder pipelines managed centrally.
 */
public enum ReminderServiceType {
    ASSESSMENT_INVITE_B2C,
    COUNSELLING_24H,
    COUNSELLING_1H,
    ASSESSMENT_MAPPING;

    public static ReminderServiceType from(String value) {
        if (value == null) return null;
        try {
            return ReminderServiceType.valueOf(value);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
