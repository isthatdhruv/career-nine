package com.kccitm.api.model.email;

/**
 * What kind of mail a template is, for the sender guidelines. TRANSACTIONAL mail is something
 * the recipient directly caused (OTP, receipt, booking confirmation) and never carries
 * unsubscribe headers. SUBSCRIBED mail is a reminder or nudge the recipient did not ask for at
 * that moment and must offer a way out. INTERNAL mail goes to staff and counsellors.
 */
public enum MailClass {
    TRANSACTIONAL,
    SUBSCRIBED,
    INTERNAL;

    public static MailClass from(String value) {
        if (value == null) return null;
        try {
            return MailClass.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
