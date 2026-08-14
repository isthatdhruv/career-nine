package com.kccitm.api.model.email;

/** Which header a configured notification recipient is placed in. */
public enum RecipientKind {
    TO,
    CC,
    BCC;

    /** Null-safe lookup; anything unrecognised falls back to TO. */
    public static RecipientKind from(String name) {
        if (name == null) {
            return TO;
        }
        try {
            return RecipientKind.valueOf(name.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return TO;
        }
    }
}
