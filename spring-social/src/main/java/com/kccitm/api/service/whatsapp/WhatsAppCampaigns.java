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

    private static final Map<EmailType, String> DEFAULTS = new LinkedHashMap<>();
    static {
        // Auth / account
        DEFAULTS.put(EmailType.PASSWORD_RESET, "career9_password_reset");
        DEFAULTS.put(EmailType.PASSWORD_RESET_CONFIRM, "career9_password_changed");
        DEFAULTS.put(EmailType.ACCOUNT_WELCOME, "career9_welcome");
        DEFAULTS.put(EmailType.ACCOUNT_ACTIVATED, "career9_account_activated");
        DEFAULTS.put(EmailType.ADMIN_PASSWORD_RESET, "career9_password_reset");

        // Credentials / verification
        DEFAULTS.put(EmailType.LOGIN_CREDENTIALS, "career9_login_credentials");
        DEFAULTS.put(EmailType.STUDENT_ID_EMAIL, "career9_student_id");
        DEFAULTS.put(EmailType.EMAIL_VERIFICATION_OTP, "career9_verification_otp");

        // Lead capture — the acknowledgement to the enquirer, and the internal alert to the
        // team, which is the one most worth having reach a phone.
        DEFAULTS.put(EmailType.LEAD_WELCOME, "career9_lead_welcome");
        DEFAULTS.put(EmailType.LEAD_NOTIFICATION, "career9_lead_alert");

        // Assessment / B2C
        DEFAULTS.put(EmailType.ASSESSMENT_COMPLETION, "career9_assessment_complete");
        DEFAULTS.put(EmailType.ENTITLEMENT_GRANTED, "career9_access_granted");
        DEFAULTS.put(EmailType.ENTITLEMENT_REMINDER, "career9_assessment_nudge");
        DEFAULTS.put(EmailType.COUNSELLING_REQUEST, "career9_counselling_request");
        DEFAULTS.put(EmailType.CAMPAIGN_INVITE, "career9_campaign_invite");

        // Payments
        DEFAULTS.put(EmailType.PAYMENT_SUCCESS, "career9_payment_success");
        DEFAULTS.put(EmailType.PAYMENT_FAILED, "career9_payment_failed");
        DEFAULTS.put(EmailType.PAYMENT_REMINDER, "career9_payment_reminder");
        DEFAULTS.put(EmailType.PAYMENT_LINK, "career9_payment_link");

        // Reports
        DEFAULTS.put(EmailType.REPORT_READY, "career9_report_ready");
        DEFAULTS.put(EmailType.CONTACT_PERSON_REPORT, "career9_report_ready");
        DEFAULTS.put(EmailType.SCHOOL_DASHBOARD_READY, "career9_dashboard_ready");

        // B2B
        DEFAULTS.put(EmailType.SCHOOL_REGISTRATION, "career9_school_registration");
        DEFAULTS.put(EmailType.ASSESSMENT_INSTITUTE_MAPPING, "career9_assessment_assigned");

        // Reminders + counselling
        DEFAULTS.put(EmailType.REMINDER, COUNSELLING_REMINDER);
        DEFAULTS.put(EmailType.COUNSELLING_NOTIFICATION, COUNSELLING_REMINDER);
        DEFAULTS.put(EmailType.COUNSELLING_BOOKING, COUNSELLING_CONFIRMATION);

        // Counsellor deactivation alert to the ops list, and the account test mail — the test
        // mail included, because "did this mailbox work?" is asked from a phone as often as not.
        DEFAULTS.put(EmailType.COUNSELLOR_DEACTIVATED_ALERT, "career9_counsellor_deactivated_alert");
        DEFAULTS.put(EmailType.ADMIN_DASHBOARD_DIGEST, "career9_dashboard_digest");
        DEFAULTS.put(EmailType.ACCOUNT_TEST, GENERIC_CAMPAIGN);

        // Legacy + ad-hoc fall through to the generic template.
        DEFAULTS.put(EmailType.KCCITM_NOTIFICATION, GENERIC_CAMPAIGN);
        DEFAULTS.put(EmailType.GENERIC, GENERIC_CAMPAIGN);
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
