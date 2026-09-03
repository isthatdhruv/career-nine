package com.kccitm.api.model.mail;

/** Who an event can address. An automation picks one or more of the roles its event offers. */
public enum MailRecipientRole {
    STUDENT("Student"),
    PARENT("Parent"),
    COUNSELLOR("Counsellor"),
    SCHOOL_CONTACT("School contact person"),
    LEAD_CONTACT("Person who enquired"),
    INTERNAL_LIST("Internal recipient list");

    private final String label;

    MailRecipientRole(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static MailRecipientRole from(String v) {
        if (v == null) return null;
        try {
            return MailRecipientRole.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
