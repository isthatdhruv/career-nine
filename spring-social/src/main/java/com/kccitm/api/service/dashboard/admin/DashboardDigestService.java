package com.kccitm.api.service.dashboard.admin;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.EmailNotificationRecipientService;
import com.kccitm.api.service.email.mails.InternalMails;

/**
 * Mails the admin dashboard's figures out at the end of the day.
 *
 * <p>One message, at 8 PM India time, carrying the same numbers the {@code /dashboard} page
 * shows for <em>today</em> — the calendar day in {@code app.dashboard.digest.timezone}, not a
 * running total and not a rolling window. A reader opening the page the next morning with the
 * date filter cleared will see different (larger) numbers; that is the point of the digest.
 *
 * <p>Recipients are not passed in. They come from {@code email_notification_recipient} under
 * {@link EmailType#ADMIN_DASHBOARD_DIGEST}, which is what the <b>Send email</b> toggle on the
 * User Management page writes. With nobody toggled on, the job computes nothing and sends
 * nothing — the feature is inert until somebody asks for it, so a deploy cannot surprise an
 * inbox.
 *
 * <p>The cards are read with an <em>unscoped</em> filter ({@code Optional.empty()}, the
 * super-admin view). There is no HTTP caller here and therefore no {@code AccessScope} to
 * resolve, so anyone toggled on receives the whole-system numbers regardless of the institutes
 * they are mapped to — the toggle is the access decision, and it lives with the admins who
 * manage users.
 */
@Service
public class DashboardDigestService {

    private static final Logger logger = LoggerFactory.getLogger(DashboardDigestService.class);

    /** "Thursday, 18 Sep 2026" — spelled out, because a bare date in an inbox is ambiguous. */
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEEE, d MMM yyyy", Locale.ENGLISH);

    @Value("${app.dashboard.digest.enabled:true}")
    private boolean enabled;

    @Value("${app.dashboard.digest.timezone:Asia/Kolkata}")
    private String timezone;

    @Autowired
    private AdminOverviewService overviewService;

    @Autowired
    private EmailNotificationRecipientService recipientService;

    @Autowired
    private EmailDispatchService emailDispatchService;

    /**
     * 8 PM in the digest timezone, every day.
     *
     * <p>The cron is a property so the send can be moved — or pointed a few minutes ahead to
     * check the mail end-to-end — without a code change.
     */
    @Scheduled(cron = "${app.dashboard.digest.cron:0 0 20 * * *}",
               zone = "${app.dashboard.digest.timezone:Asia/Kolkata}")
    public void sendDailyDigest() {
        if (!enabled) {
            return;
        }
        try {
            send(today());
        } catch (Exception e) {
            // A scheduled method that throws is logged by Spring and then forgotten; say what
            // broke here so the missing digest is explicable the next morning.
            logger.error("Daily dashboard digest failed: {}", e.getMessage(), e);
        }
    }

    /** The day being reported on, in the digest timezone rather than the JVM's (a UTC container). */
    public LocalDate today() {
        return LocalDate.now(ZoneId.of(timezone));
    }

    /**
     * Compute one day's numbers and mail them to everyone toggled on.
     *
     * @return how many recipients the digest was addressed to; 0 when nobody is subscribed
     */
    public int send(LocalDate day) {
        EmailNotificationRecipientService.Resolved who =
                recipientService.resolve(EmailType.ADMIN_DASHBOARD_DIGEST, null, null);
        if (who.isEmpty()) {
            // Debug, not warn: an empty list is the default state of the feature, and a daily
            // warning about it would be noise in every log for every install that never uses it.
            logger.debug("Dashboard digest: nobody is subscribed — nothing sent for {}", day);
            return 0;
        }

        // Deliberately not blocking here. The app runs a single scheduling thread and the
        // counselling reminder job shares this 8 PM slot, so the digest hands its work to the
        // dashboard pool and lets go: the mail is built and sent on whichever pool thread
        // finishes last, and a slow query cannot hold up the reminders behind it.
        collect(day).thenAccept(numbers -> dispatch(day, who, numbers))
                .exceptionally(e -> {
                    logger.error("Dashboard digest for {} could not be computed: {}", day, e.getMessage(), e);
                    return null;
                });

        logger.info("Dashboard digest for {} addressed to {} recipient(s)", day, who.size());
        return who.size();
    }

    private void dispatch(LocalDate day, EmailNotificationRecipientService.Resolved who, Numbers numbers) {
        try {
            EmailSendRequest req = new EmailSendRequest();
            req.setEmailType(EmailType.ADMIN_DASHBOARD_DIGEST);
            req.setTo(who.to);
            req.setCc(who.cc);
            req.setBcc(who.bcc);
            req.setMail(InternalMails.dashboardDigest(DAY.format(day),
                    summary(numbers.values, numbers.extras),
                    sections(numbers.values, numbers.ranged)));

            // The digest goes out on WhatsApp too, at the same moment and to the same people.
            // The numbers have to be named: these are subscriber addresses from the Notification
            // Recipients screen, belonging to no student, counsellor or contact-person record,
            // so there is nothing for the dispatcher to look a number up from.
            com.kccitm.api.model.whatsapp.WhatsAppMessage wa =
                    new com.kccitm.api.model.whatsapp.WhatsAppMessage();
            for (String address : who.to) {
                wa.forAddress(address, who.phoneFor(address));
            }
            req.setWhatsApp(wa);

            emailDispatchService.send(req);
            logger.info("Dashboard digest for {} queued to {} recipient(s)", day, who.size());
        } catch (Exception e) {
            logger.error("Dashboard digest for {} could not be sent: {}", day, e.getMessage(), e);
        }
    }

    /** One day's cards, already collected off the futures. */
    private static final class Numbers {
        final Map<String, Long> values = new LinkedHashMap<>();
        final Map<String, Map<String, Object>> extras = new LinkedHashMap<>();
        /** Whether the day window actually narrowed this card, straight off {@code AdminOverviewCard}. */
        final Map<String, Boolean> ranged = new LinkedHashMap<>();
    }

    // ─── the numbers ─────────────────────────────────────────────────────

    /**
     * Every card for one day, fanned out across the dashboard pool exactly as the
     * {@code /all} endpoint does. The future completes once the last card lands; nothing
     * waits on the calling thread.
     */
    @SuppressWarnings("unchecked")
    private CompletableFuture<Numbers> collect(LocalDate day) {
        AdminOverviewFilter f = new AdminOverviewFilter(day, day,
                Collections.<Integer>emptySet(), Collections.<Long>emptySet(), Optional.empty());

        CompletableFuture<AdminOverviewCard>[] jobs = new CompletableFuture[] {
                overviewService.signups(f),
                overviewService.activeAssessments(f),
                overviewService.assessmentsCompleted(f),
                overviewService.assessmentsInProgress(f),
                overviewService.assessmentsNotStarted(f),
                overviewService.reportsGenerated(f),
                overviewService.counsellingBooked(f),
                overviewService.counsellingSessions(f),
                overviewService.counsellingCompleted(f),
                overviewService.studentsAbsent(f),
                overviewService.counsellorsAbsent(f),
                overviewService.paymentsCompleted(f),
                overviewService.websiteRegistrations(f),
        };
        return CompletableFuture.allOf(jobs).thenApply(v -> {
            Numbers numbers = new Numbers();
            for (CompletableFuture<AdminOverviewCard> job : jobs) {
                AdminOverviewCard card = job.join();
                numbers.values.put(card.getKey(), card.getValue());
                numbers.extras.put(card.getKey(), card.getExtra() == null
                        ? Collections.<String, Object>emptyMap() : card.getExtra());
                numbers.ranged.put(card.getKey(), card.isRangeApplied());
            }
            return numbers;
        });
    }

    /**
     * The tables, under the same section headings the dashboard page uses. Metric titles are
     * copied from the tiles on purpose: somebody reading the mail and then opening the page
     * should not have to work out which tile a line came from.
     */
    private Map<String, List<String[]>> sections(Map<String, Long> v, Map<String, Boolean> ranged) {
        Map<String, List<String[]>> out = new LinkedHashMap<>();

        List<String[]> registrations = new ArrayList<>();
        registrations.add(row("New sign-ups / registrations", v, ranged, "signups"));
        registrations.add(row("Active assessments", v, ranged, "active-assessments"));
        registrations.add(row("Completed fully", v, ranged, "assessments-completed"));
        registrations.add(row("Partially completed / in progress", v, ranged, "assessments-in-progress"));
        registrations.add(row("Not started", v, ranged, "assessments-not-started"));
        registrations.add(row("Reports generated", v, ranged, "reports-generated"));
        out.put("Registrations & assessments", registrations);

        List<String[]> counselling = new ArrayList<>();
        counselling.add(row("Scheduled by students", v, ranged, "counselling-booked"));
        counselling.add(row("Sessions to be conducted", v, ranged, "counselling-sessions"));
        out.put("Counselling", counselling);

        List<String[]> outcomes = new ArrayList<>();
        outcomes.add(row("Sessions completed", v, ranged, "counselling-completed"));
        outcomes.add(row("Students absent", v, ranged, "students-absent"));
        outcomes.add(row("Counsellors absent", v, ranged, "counsellors-absent"));
        out.put("Counselling outcomes", outcomes);

        List<String[]> payments = new ArrayList<>();
        payments.add(row("Payments completed", v, ranged, "payments-completed"));
        out.put("Payments", payments);

        List<String[]> website = new ArrayList<>();
        website.add(row("Website registrations", v, ranged, "website-registrations"));
        out.put("Website", website);

        return out;
    }

    /** The preheader — what shows in the inbox before the mail is opened. */
    private String summary(Map<String, Long> v, Map<String, Map<String, Object>> x) {
        long signups = value(v, "signups");
        long completed = value(v, "assessments-completed");
        long sessions = value(v, "counselling-sessions");
        if (signups == 0 && completed == 0 && sessions == 0 && value(v, "payments-completed") == 0) {
            return "A quiet day — nothing was recorded on the dashboard.";
        }
        return signups + " sign-ups · " + completed + " assessments completed · "
                + sessions + " counselling sessions · " + rupees(x, "payments-completed", "amount") + " collected";
    }

    // ─── formatting ──────────────────────────────────────────────────────

    /**
     * One line of a table.
     *
     * <p>A card that does not honour the day window — {@code active-assessments} counts what is
     * switched on right now — is marked "(now)" rather than quietly sitting under a column
     * headed "Today". One wrong-looking figure is enough to make a reader distrust the rest.
     */
    private static String[] row(String metric, Map<String, Long> values, Map<String, Boolean> ranged,
                                String key) {
        String today = String.valueOf(value(values, key));
        if (!Boolean.TRUE.equals(ranged.get(key))) {
            today = today + " (now)";
        }
        return new String[]{metric, today};
    }

    private static long value(Map<String, Long> values, String key) {
        Long v = values.get(key);
        return v == null ? 0L : v;
    }

    /** A missing or non-numeric amount reads as zero — a digest must never fail over a caption. */
    private static String rupees(Map<String, Map<String, Object>> extras, String key, String field) {
        Map<String, Object> extra = extras.get(key);
        Object raw = extra == null ? null : extra.get(field);
        double amount = raw instanceof Number ? ((Number) raw).doubleValue() : 0d;
        return "₹" + String.format(Locale.ENGLISH, "%,.0f", amount);
    }
}
