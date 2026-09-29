package com.kccitm.api.service.whatsapp;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailType;

/**
 * Which WhatsApp template each send-scenario goes out on — the WhatsApp counterpart of the
 * {@code EmailType} catalog.
 *
 * <p>AiSensy calls these "campaigns"; each one wraps a Meta-approved message template and must
 * exist in the AiSensy dashboard before it will send. The slugs below are the names to create
 * there. Until a campaign exists the send simply fails at the provider and is logged — the
 * email has already gone out regardless, so nothing is lost.
 *
 * <p><b>Every scenario sends both channels. There are no exceptions.</b> Every {@code EmailType}
 * resolves to a campaign, and a scenario added later that nobody maps here falls through to
 * {@link #GENERIC_CAMPAIGN} rather than quietly becoming email-only. If an email goes out, a
 * WhatsApp goes with it.
 *
 * <p>An earlier version of this class kept an email-only list for the internal ops alerts, on the
 * grounds that a tabular alert reads badly in a chat message. That was the wrong call to make
 * here: it is a question about template wording, and it was being answered by dropping the
 * message. The generic template carries the subject, the gist and a link, which is enough for an
 * alert whose job is to make somebody go and look — and a lead alert that arrives while nobody
 * is at their desk is exactly the one worth putting on a phone.
 *
 * <p>Every slug is overridable without a deploy, most specific first:
 * <ol>
 *   <li>property {@code app.whatsapp.campaigns.<EMAIL_TYPE>}</li>
 *   <li>environment {@code AISENSY_CAMPAIGN_<EMAIL_TYPE>}</li>
 *   <li>the built-in default below</li>
 * </ol>
 */
@Component
public class WhatsAppCampaigns {

    /** Fallback template for any scenario without one of its own. Four generic parameters. */
    public static final String GENERIC_CAMPAIGN = "career9_notification";

    /** Slugs used by the counselling flows that already had dedicated templates. */
    public static final String COUNSELLING_REMINDER = "counselling_reminder";
    public static final String COUNSELLING_OTP = "counselling_otp";
    public static final String COUNSELLING_CONFIRMATION = "counselling_confirmation";
    public static final String COUNSELLOR_DIGEST = "counsellor_daily_digest";
    public static final String COUNSELLING_NUDGE = "counselling_booking_nudge";

    /** Per-event counselling templates: name, then the session's date/time (and extras), then a link. */
    public static final String COUNSELLING_CANCELLED = "counselling_cancelled";
    public static final String COUNSELLING_RESCHEDULED = "counselling_rescheduled";
    public static final String COUNSELLING_PICK_NEW_SLOT = "counselling_pick_new_slot";
    public static final String COUNSELLING_COUNSELLOR_CHANGED = "counselling_counsellor_changed";
    public static final String COUNSELLING_SESSION_ASSIGNED = "counselling_session_assigned";
    public static final String COUNSELLING_CHECKIN_PENDING = "counselling_checkin_pending";
    public static final String COUNSELLING_MARKED_ABSENT = "counselling_marked_absent";
    public static final String COUNSELLING_SESSION_COMPLETED = "counselling_session_completed";
    public static final String COUNSELLING_BOOKING_INVITE = "counselling_booking_invite";

    /**
     * Scenarios with a dedicated template. Everything else (internal alerts, rare mails) goes
     * out on {@link #GENERIC_CAMPAIGN} — name, subject, gist and link. A dedicated template here
     * is filled as name + link; one set by override must take the same two parameters.
     *
     * <p>Counselling events all share COUNSELLING_NOTIFICATION, so they name their templates on
     * the message itself ({@code WhatsAppMessage#onEvent}) rather than being listed here.
     */
    private static final Map<EmailType, String> DEFAULTS = new LinkedHashMap<>();
    static {
        DEFAULTS.put(EmailType.COUNSELLING_BOOKING, COUNSELLING_CONFIRMATION);

        // Utility templates filled as name + link (see WhatsAppDispatchService#eventParams).
        // The all-blanks generic template is billed as Marketing (~7x the Utility rate), so
        // every scenario a student, parent or counsellor receives regularly has its own.
        DEFAULTS.put(EmailType.LOGIN_CREDENTIALS, "career9_registration_done");
        DEFAULTS.put(EmailType.STUDENT_ID_EMAIL, "career9_registration_done");
        DEFAULTS.put(EmailType.ACCOUNT_WELCOME, "career9_registration_done");
        DEFAULTS.put(EmailType.ENTITLEMENT_GRANTED, "career9_registration_done");
        DEFAULTS.put(EmailType.ENTITLEMENT_REMINDER, "career9_assessment_pending");
        DEFAULTS.put(EmailType.ASSESSMENT_COMPLETION, "career9_assessment_completed");
        DEFAULTS.put(EmailType.REPORT_READY, "career9_report_ready");
        DEFAULTS.put(EmailType.CONTACT_PERSON_REPORT, "career9_report_ready");
        DEFAULTS.put(EmailType.PAYMENT_SUCCESS, "career9_payment_received");
        DEFAULTS.put(EmailType.PAYMENT_FAILED, "career9_payment_failed");
        DEFAULTS.put(EmailType.PAYMENT_REMINDER, "career9_payment_due");
        DEFAULTS.put(EmailType.PAYMENT_LINK, "career9_payment_due");
        DEFAULTS.put(EmailType.PASSWORD_RESET, "career9_password_reset");
        DEFAULTS.put(EmailType.ADMIN_PASSWORD_RESET, "career9_password_reset");
        DEFAULTS.put(EmailType.PASSWORD_RESET_CONFIRM, "career9_password_changed");
        DEFAULTS.put(EmailType.ACCOUNT_ACTIVATED, "career9_account_activated");
    }

    private final Environment environment;

    @Autowired
    public WhatsAppCampaigns(Environment environment) {
        this.environment = environment;
    }

    /**
     * The campaign for a scenario: property override, then environment override, then the
     * built-in default, then the generic template. <b>Never null</b> — every email that goes out
     * has a WhatsApp to go with it.
     */
    public String forType(EmailType type) {
        if (type != null) {
            String property = environment.getProperty("app.whatsapp.campaigns." + type.name());
            if (isSet(property)) return property.trim();

            String env = environment.getProperty("AISENSY_CAMPAIGN_" + type.name());
            if (isSet(env)) return env.trim();

            String preset = DEFAULTS.get(type);
            if (isSet(preset)) return preset;
        }
        return GENERIC_CAMPAIGN;
    }

    private boolean isSet(String v) {
        return v != null && !v.trim().isEmpty();
    }
}
