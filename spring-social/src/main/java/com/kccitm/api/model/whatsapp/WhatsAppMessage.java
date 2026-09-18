package com.kccitm.api.model.whatsapp;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The WhatsApp half of a notification, carried on the {@code EmailSendRequest} it rides with.
 *
 * <p><b>One address, one message.</b> A WhatsApp is addressed to a <i>recipient of the email</i>,
 * not to the appointment or the account the email is about. So numbers are held here against the
 * address they belong to: the mail goes to three people, three people get a WhatsApp. That
 * pairing is what keeps the two channels at the same count, and it is the reason this is a map
 * rather than a list.
 *
 * <p>It was a list first, and the counts came apart immediately. A cancellation mail to the
 * counsellor carried the student's and the parent's numbers alongside the counsellor's, because
 * all three "belonged to the appointment" — so one email produced three WhatsApps, two of them
 * to people who had not been written to and were reading a message addressed to somebody else.
 *
 * <p><b>Why it lives on the email request.</b> Every notification in this system is already
 * built, addressed and dispatched in one place — {@code EmailDispatchService}. Sending the
 * WhatsApp from anywhere else would mean a second addressing pass, a second set of recipient
 * rules, and two moments in time that drift apart the first time one of them is made
 * {@code @Async}. Riding along means the two channels are dispatched from the same call, with
 * the same recipients, at the same instant.
 *
 * <p>Every field is optional. A mail that says nothing about WhatsApp still gets one per
 * recipient, on the campaign mapped to its {@code EmailType}, with the number looked up from
 * each address and the text taken from the mail itself. This class is for what a lookup cannot
 * work out on its own:
 *
 * <ul>
 *   <li>{@link #campaign} — a dedicated Meta-approved template for this exact event.</li>
 *   <li>{@link #params} — the positional variables that template expects, shared by every
 *       recipient unless one of them carries {@link Recipient#params} of its own.</li>
 *   <li>{@link #forAddress} — the number for one address, where no record holds it. A
 *       parent/guardian contact given at booking has an address and a number that belong to no
 *       student, counsellor or user row anywhere.</li>
 *   <li>{@link #toPhone} — a number with no address at all, for the rare send that has one.</li>
 *   <li>{@link #dedupeKey} — collapses <i>retries</i> of one email, not separate emails. The
 *       booking confirmation retries up to three rounds; that is one notification, so it is one
 *       WhatsApp per person however many rounds it takes.</li>
 *   <li>{@link #suppressed} — the one narrow exception, and it does <b>not</b> mean "email
 *       only": it is for a caller that has already sent this notification on WhatsApp itself.
 *       Both channels still go out; only the duplicate is stopped.</li>
 * </ul>
 */
public class WhatsAppMessage {

    /** A number to write to, and optionally the template parameters for this person only. */
    public static final class Recipient {
        public final String phone;
        public final String name;
        public final List<String> params;

        Recipient(String phone, String name, List<String> params) {
            this.phone = phone;
            this.name = name;
            this.params = params;
        }
    }

    private String campaign;
    private List<String> params = new ArrayList<>();

    /** Lower-cased email address → the number for that recipient. */
    private final Map<String, Recipient> byAddress = new LinkedHashMap<>();

    /** Numbers with no matching address on the email. Rare; see {@link #toPhone}. */
    private final List<Recipient> extras = new ArrayList<>();

    private boolean suppressed;
    private String dedupeKey;

    public WhatsAppMessage() {
    }

    /** A message on a named campaign whose parameters are the same for every recipient. */
    public static WhatsAppMessage of(String campaign, String... params) {
        WhatsAppMessage m = new WhatsAppMessage();
        m.campaign = campaign;
        if (params != null) m.params = new ArrayList<>(Arrays.asList(params));
        return m;
    }

    /**
     * "This notification has already been sent on WhatsApp by the caller — do not send it
     * again." Not an email-only switch: the recipient still gets both channels, and the only
     * thing suppressed is a second copy of the WhatsApp they already have.
     */
    public static WhatsAppMessage alreadySentByCaller() {
        WhatsAppMessage m = new WhatsAppMessage();
        m.suppressed = true;
        return m;
    }

    /**
     * The number to use for one of the email's addresses, where it cannot be looked up. Blanks
     * are ignored so callers need no null checks, and the address is matched case-insensitively.
     */
    public WhatsAppMessage forAddress(String email, String phone) {
        return forAddress(email, phone, null, null);
    }

    /**
     * As above, with a name and parameters for this recipient alone — for a mail whose copies
     * greet their readers differently, such as a booking confirmation that names the student to
     * the student and the counsellor to the counsellor.
     */
    public WhatsAppMessage forAddress(String email, String phone, String name, List<String> params) {
        if (email == null || email.trim().isEmpty()) return this;
        if (phone == null || phone.trim().isEmpty()) return this;
        byAddress.put(email.trim().toLowerCase(), new Recipient(phone.trim(), name, params));
        return this;
    }

    /**
     * A number that belongs to no address on this email.
     *
     * <p>Used only where there is no address to pair it with — a nudge to a student who has a
     * phone number on file and no email at all. It adds a message the email did not send, so it
     * is the one thing here that can put the two counts out of step, and it exists for the case
     * where the alternative is reaching nobody.
     */
    public WhatsAppMessage toPhone(String phone) {
        if (phone != null && !phone.trim().isEmpty()) {
            extras.add(new Recipient(phone.trim(), null, null));
        }
        return this;
    }

    /** One WhatsApp per person per key, however many times the email is retried. */
    public WhatsAppMessage dedupeOn(String key) {
        this.dedupeKey = key;
        return this;
    }

    /** The number held for this address, or null to look it up. */
    public Recipient forEmail(String email) {
        return email == null ? null : byAddress.get(email.trim().toLowerCase());
    }

    public String getCampaign() { return campaign; }
    public void setCampaign(String campaign) { this.campaign = campaign; }
    public List<String> getParams() { return params; }
    public void setParams(List<String> params) { this.params = params != null ? params : new ArrayList<>(); }
    public List<Recipient> getExtras() { return extras; }
    public boolean isSuppressed() { return suppressed; }
    public void setSuppressed(boolean suppressed) { this.suppressed = suppressed; }
    public String getDedupeKey() { return dedupeKey; }
    public void setDedupeKey(String dedupeKey) { this.dedupeKey = dedupeKey; }
}
