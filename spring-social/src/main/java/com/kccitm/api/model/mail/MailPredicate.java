package com.kccitm.api.model.mail;

/**
 * Fixed conditions an automation can require. Each is evaluated by {@code MailPredicateRegistry}
 * against the event context and, where it says "still", against the database at fire time.
 * Events declare which predicates make sense for them.
 */
public enum MailPredicate {
    ASSESSMENT_NOT_STARTED("assessment_not_started", "Assessment not started yet"),
    ASSESSMENT_NOT_COMPLETED("assessment_not_completed", "Assessment not completed yet"),
    ENTITLEMENT_ACTIVE("entitlement_active", "Access is still active (not expired)"),
    HAS_COUNSELLING_SESSIONS("has_counselling_sessions", "Plan includes unused counselling sessions"),
    COUNSELLING_NOT_BOOKED("counselling_not_booked", "No counselling session booked yet"),
    PAYMENT_STILL_PENDING("payment_still_pending", "Payment still not made"),
    APPOINTMENT_STILL_SCHEDULED("appointment_still_scheduled", "Appointment still scheduled (not cancelled)"),
    HAS_MEETING_LINK("has_meeting_link", "Session has an online meeting link"),
    IS_OFFLINE_SESSION("is_offline_session", "Session is in person"),
    HAS_PARENT_EMAIL("has_parent_email", "A parent email is on record");

    private final String key;
    private final String label;

    MailPredicate(String key, String label) {
        this.key = key;
        this.label = label;
    }

    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    public static MailPredicate fromKey(String key) {
        if (key == null) return null;
        for (MailPredicate p : values()) {
            if (p.key.equals(key.trim())) return p;
        }
        return null;
    }
}
