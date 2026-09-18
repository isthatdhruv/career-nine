package com.kccitm.api.service.whatsapp;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.model.whatsapp.WhatsAppMessage;
import com.kccitm.api.service.CommunicationLogService;
import com.kccitm.api.service.counselling.WhatsAppService;

/**
 * The WhatsApp companion to every email the system sends.
 *
 * <p>{@code EmailDispatchService} is the single point every email in the system flows through.
 * This is called from it, on the same request, in the same call — so a notification goes out on
 * both channels from one decision, addressed to one set of people, at one moment. There is no
 * separate schedule to keep in step and no second copy of "who should hear about this", which
 * is what made the earlier arrangement drift: WhatsApp was wired into six counselling flows by
 * hand and absent from the other two dozen, and where it was wired in it was an
 * <i>alternative</i> to the email rather than a companion to it — a working API key would have
 * stopped the reminder emails rather than doubling them up.
 *
 * <p><b>Never blocks, never fails a send.</b> {@code @Async} on its <i>own</i> pool — not the one
 * the emails go out on — so a slow provider holds WhatsApp threads rather than the threads the
 * emails need. Every failure is caught: no WhatsApp problem can prevent, delay or fail the email
 * it accompanies.
 *
 * <p><b>Both channels leave at the same moment, and nothing here re-derives that moment.</b> The
 * time a notification fires is decided once, by the caller — a scheduler reading
 * {@code CounsellingClock}, or a person pressing a button — and this is invoked from inside that
 * same send. There is no clock read anywhere in this class beyond the dedupe window, which
 * measures elapsed milliseconds and so has no timezone to get wrong. The times a message
 * <i>shows</i> are the slot's own {@code LocalDate} and {@code LocalTime}, formatted exactly as
 * the email formats them: bare wall-clock values with no zone attached, which is why they read
 * the same in both channels on a JVM running UTC.
 *
 * <p><b>Until the API key is configured</b> the transport reports every send as not-delivered
 * and logs one line saying why. That is the intended resting state of this code today: the
 * routing, recipients, campaigns and logging are all live and exercised, and adding
 * {@code AISENSY_API_KEY} is the only step left to make messages actually leave.
 */
@Service
public class WhatsAppDispatchService {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppDispatchService.class);

    /** First link in the rendered text, used as the generic template's action parameter. */
    private static final Pattern URL = Pattern.compile("https?://\\S+");

    /** How long a dedupe key suppresses repeats. Covers the booking mail's three retry rounds. */
    private static final long DEDUPE_TTL_MS = 30 * 60 * 1000L;

    /** Bounded so a long-running process cannot accumulate keys without limit. */
    private static final int DEDUPE_MAX = 5000;

    private final Map<String, Long> recentSends = new LinkedHashMap<String, Long>() {
        private static final long serialVersionUID = 1L;

        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            return size() > DEDUPE_MAX;
        }
    };

    @Autowired
    private WhatsAppService whatsAppService;

    @Autowired
    private WhatsAppCampaigns campaigns;

    @Autowired
    private WhatsAppRecipientResolver recipientResolver;

    @Autowired(required = false)
    private CommunicationLogService communicationLogService;

    /**
     * Master switch. Off leaves every email exactly as it was, with no lookups and no provider
     * calls — the way to turn the second channel off in an incident without a code change.
     */
    @Value("${app.whatsapp.enabled:true}")
    private boolean enabled;

    /**
     * Sends the WhatsApp that goes with an email. Called by the email dispatcher for every
     * send; decides for itself whether this particular one should produce a message.
     *
     * @param req     the request the email was built from — carries the scenario, the
     *                recipients and any explicit {@link WhatsAppMessage} the caller attached
     * @param message the rendered email, used for the subject and body text the generic
     *                template is filled from
     */
    @Async(com.kccitm.api.config.AsyncExecutorsConfig.WHATSAPP_EXECUTOR)
    public void sendAlongside(EmailSendRequest req, SmtpEmailRequest message) {
        dispatch(req, message);
    }

    /**
     * The same send, on the caller's own thread, for a mail going out synchronously.
     *
     * <p>The email dispatcher picks between this and {@link #sendAlongside} using the email's own
     * delivery mode, so the WhatsApp is timed exactly the way the email is timed rather than on a
     * policy of its own. A SYNC mail is one somebody is waiting on — a check-in code, a
     * verification OTP, a payment receipt — and it is sent inline, so its WhatsApp is sent inline
     * too and the two arrive together. Queueing that one would have put the code on the phone
     * some seconds after the inbox, which for an OTP is the difference between useful and not.
     *
     * <p>An ASYNC mail is handed to a pool, so its WhatsApp is handed to a pool. Same decision,
     * same moment, in both directions.
     */
    public void sendNow(EmailSendRequest req, SmtpEmailRequest message) {
        dispatch(req, message);
    }

    private void dispatch(EmailSendRequest req, SmtpEmailRequest message) {
        try {
            if (!enabled || req == null) return;

            WhatsAppMessage wa = req.getWhatsApp();
            if (wa != null && wa.isSuppressed()) return;

            EmailType type = req.getEmailType();
            String campaign = wa != null && isSet(wa.getCampaign())
                    ? wa.getCampaign()
                    : campaigns.forType(type);

            List<Target> targets = targets(req, wa);
            if (targets.isEmpty()) {
                // The one way a mail can go out without a WhatsApp: nobody it reached has a
                // number anywhere. That is a data gap an admin can close, so it is named at WARN
                // with the addresses in it rather than left to be inferred from a silence.
                logger.warn("Email sent with no WhatsApp companion — no phone number on record "
                        + "for any recipient of {} ({}). Subject: {}",
                        type, req.getTo(), message != null ? message.getSubject() : req.getSubject());
                return;
            }

            for (Target t : targets) {
                if (alreadySent(wa, campaign, t.phone)) {
                    logger.debug("WhatsApp '{}' to {} skipped — already sent for this notification",
                            campaign, t.phone);
                    continue;
                }

                // This recipient's own parameters, else the ones shared by the whole message,
                // else the generic four derived from the mail — each addressed to this person.
                List<String> params = t.params != null && !t.params.isEmpty()
                        ? t.params
                        : (wa != null && !wa.getParams().isEmpty()
                                ? wa.getParams()
                                : genericParams(t.name, req, message));

                boolean sent = whatsAppService.sendTemplate(t.phone, campaign, params);
                log(t, campaign, type, sent);
            }
        } catch (Exception e) {
            // The email has already gone. Nothing here is allowed to surface.
            logger.warn("WhatsApp companion send failed for {}: {}",
                    req != null ? req.getEmailType() : null, e.getMessage());
        }
    }

    /**
     * The same companion, for an email sent outside {@code EmailDispatchService}.
     *
     * <p>A handful of senders compose and transport their own mail — the report pipeline's
     * workers, chiefly, which run in their own container and hold their own delivery guarantee.
     * They still owe the recipient a WhatsApp, so they call this immediately after their send
     * succeeds. Everything downstream is identical: same campaign resolution, same phone lookup,
     * same {@code communication_log} row.
     *
     * @param type   the scenario, which chooses the template
     * @param to     the address the email went to; its number is looked up
     * @param name   the recipient's name, for the greeting
     * @param phone  a known number, if the caller has one — added to whatever the lookup finds
     * @param params the template's positional parameters, or null to derive the generic four
     * @param dedupeKey identifies the notification, so a retried email does not send a second
     *                  message; null when the caller's own machinery already guarantees one send
     */
    @Async(com.kccitm.api.config.AsyncExecutorsConfig.WHATSAPP_EXECUTOR)
    public void sendForExternalEmail(EmailType type, String to, String name, String phone,
                                     String subject, String body, List<String> params,
                                     String dedupeKey) {
        try {
            EmailSendRequest req = new EmailSendRequest();
            req.setEmailType(type);
            if (isSet(to)) req.getTo().add(to);
            req.setRecipientName(name);
            req.setSubject(subject);
            req.setTextContent(body);

            WhatsAppMessage wa = new WhatsAppMessage();
            if (isSet(to) && isSet(phone)) {
                wa.forAddress(to, phone);
            } else if (isSet(phone)) {
                wa.toPhone(phone);
            }
            if (params != null && !params.isEmpty()) wa.setParams(params);
            if (isSet(dedupeKey)) wa.dedupeOn(dedupeKey);
            req.setWhatsApp(wa);

            SmtpEmailRequest rendered = new SmtpEmailRequest();
            rendered.setSubject(subject);
            rendered.setTextContent(body);

            dispatch(req, rendered);
        } catch (Exception e) {
            logger.warn("WhatsApp companion failed for externally-sent {} to {}: {}",
                    type, to, e.getMessage());
        }
    }

    // ─── recipients ──────────────────────────────────────────────────────

    static final class Target {
        final String phone;
        final String name;
        /** This recipient's own template parameters, or null to use the message's shared ones. */
        final List<String> params;

        Target(String phone, String name, List<String> params) {
            this.phone = phone;
            this.name = name;
            this.params = params;
        }
    }

    /**
     * One WhatsApp per address the email went to — that pairing is the whole point.
     *
     * <p>For each address in turn: the number the caller supplied for <i>that</i> address if
     * there is one, otherwise the number held against it in the student, counsellor,
     * contact-person, lead or user record. So a mail to three people produces three messages,
     * and a mail to one produces one. Nothing is sent to a number merely because it appears
     * somewhere in the same conversation.
     *
     * <p>Deduplicated on the digits of the number, so one person listed twice on the same email
     * — their own address and a contact address that happens to carry the same number, or the
     * same number written with a country code in one place and without it in another — receives
     * one message rather than two.
     *
     * <p>Only the {@code to} list is used — never cc or bcc. Someone copied on a mail has been
     * kept informed deliberately at one remove; a WhatsApp to their personal number is not the
     * same gesture, and a bcc'd recipient is not supposed to be visible as a recipient at all.
     */
    List<Target> targets(EmailSendRequest req, WhatsAppMessage wa) {
        List<Target> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (String email : req.getTo()) {
            if (!isSet(email)) continue;

            WhatsAppMessage.Recipient named = wa != null ? wa.forEmail(email) : null;
            String phone = named != null ? named.phone : null;
            String name = named != null ? named.name : null;
            List<String> params = named != null ? named.params : null;

            if (!isSet(phone)) {
                WhatsAppRecipientResolver.Recipient found = recipientResolver.resolve(email);
                if (found == null || !isSet(found.phone)) continue;
                phone = found.phone;
                if (!isSet(name)) name = found.name;
            }
            if (!seen.add(digits(phone))) continue;
            if (!isSet(name)) name = req.getRecipientName();
            out.add(new Target(phone, name, params));
        }

        // Numbers with no address on this email. See WhatsAppMessage#toPhone — the only case
        // that can add a message the email did not send, and only where there was no address
        // to send one to.
        if (wa != null) {
            for (WhatsAppMessage.Recipient extra : wa.getExtras()) {
                if (!isSet(extra.phone) || !seen.add(digits(extra.phone))) continue;
                out.add(new Target(extra.phone,
                        isSet(extra.name) ? extra.name : req.getRecipientName(), extra.params));
            }
        }
        return out;
    }

    // ─── message body ────────────────────────────────────────────────────

    /**
     * The four parameters of the generic template: who it is for, what it is about, the gist,
     * and where to go. A scenario with its own approved template supplies its own list instead.
     *
     * <p>The gist is taken from the email's own plain-text rendering rather than written twice.
     * Two messages about one event that word it differently is how a recipient ends up
     * wondering whether they are about the same event.
     */
    private List<String> genericParams(String name, EmailSendRequest req, SmtpEmailRequest message) {
        String subject = message != null && isSet(message.getSubject())
                ? message.getSubject() : req.getSubject();
        String text = message != null ? message.getTextContent() : null;

        List<String> params = new ArrayList<>();
        params.add(greeting(name, req));
        params.add(clean(subject, 120));
        params.add(clean(summary(text), 500));
        params.add(clean(firstLink(text), 300));
        return params;
    }

    /** The name to greet. Falls back through the request's context to a neutral "there". */
    private String greeting(String name, EmailSendRequest req) {
        if (isSet(name)) return clean(name, 60);
        String first = req.getTemplateContext().get("first_name");
        if (isSet(first)) return clean(first, 60);
        String student = req.getTemplateContext().get("student_name");
        if (isSet(student)) return clean(student, 60);
        return "there";
    }

    /**
     * The opening prose of the mail — its title and first paragraphs, stopping before the
     * details table, the buttons and the signature. Enough to tell the reader what has happened
     * without reproducing a whole email inside a chat message.
     */
    private String summary(String text) {
        if (!isSet(text)) return "";
        StringBuilder out = new StringBuilder();
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("http")) break;
            if (out.length() > 0 && out.length() + line.length() > 400) break;
            if (out.length() > 0) out.append(' ');
            out.append(line);
        }
        return out.toString();
    }

    private String firstLink(String text) {
        if (!isSet(text)) return "";
        Matcher m = URL.matcher(text);
        return m.find() ? m.group() : "";
    }

    /**
     * AiSensy rejects template parameters containing newlines or tabs, and a parameter longer
     * than the template's variable allows is rejected whole — so a long value is trimmed here
     * rather than costing the whole message.
     */
    private String clean(String value, int max) {
        if (value == null) return "";
        String v = value.replaceAll("\\s+", " ").trim();
        if (v.length() <= max) return v;
        return v.substring(0, Math.max(0, max - 1)).trim() + "…";
    }

    // ─── dedupe + logging ────────────────────────────────────────────────

    /**
     * True when this exact message has already gone to this number recently. Keyed on the
     * caller's dedupe key, so only callers that ask for it are collapsed — two genuinely
     * different notifications on the same campaign are not.
     */
    private synchronized boolean alreadySent(WhatsAppMessage wa, String campaign, String phone) {
        if (wa == null || !isSet(wa.getDedupeKey())) return false;
        String key = wa.getDedupeKey() + "|" + campaign + "|" + digits(phone);
        long now = System.currentTimeMillis();
        Long previous = recentSends.get(key);
        if (previous != null && now - previous < DEDUPE_TTL_MS) return true;
        recentSends.put(key, now);
        return false;
    }

    /**
     * Records the attempt in {@code communication_log}, which is the one place email and
     * WhatsApp sends are visible side by side — the question being asked of it is "was this
     * person told?", not "did this mail go?".
     */
    private void log(Target t, String campaign, EmailType type, boolean sent) {
        if (communicationLogService == null) return;
        try {
            communicationLogService.logWhatsApp(t.name, t.phone,
                    type != null ? type.name() : campaign, sent,
                    sent ? null : "Not delivered to provider (campaign '" + campaign + "')");
        } catch (Exception e) {
            logger.debug("WhatsApp communication log failed: {}", e.getMessage());
        }
    }

    /**
     * The identity of a number, for deciding whether two recipients are the same person.
     *
     * <p>Delegates to the transport's own normalisation rather than stripping punctuation here:
     * a bare ten-digit number and the same number with its country code are one phone, and only
     * the transport knows that. Comparing raw digits made them two people, and sent the message
     * twice.
     */
    private String digits(String phone) {
        if (phone == null) return "";
        String normalised = whatsAppService.normalizePhone(phone);
        return normalised != null ? normalised : phone.replaceAll("[^0-9]", "");
    }

    private boolean isSet(String v) {
        return v != null && !v.trim().isEmpty();
    }
}
