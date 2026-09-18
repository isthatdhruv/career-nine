package com.kccitm.api.archtest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * A WhatsApp goes out <em>with</em> its email, not instead of it.
 *
 * <p>This exists because the arrangement it guards against was already here once. WhatsApp was
 * wired into a handful of counselling flows by hand, each one shaped the same way:
 *
 * <pre>
 *   boolean sent = whatsApp.sendTemplate(...);
 *   if (!sent) sendTheEmail();          // ← email only when WhatsApp failed
 * </pre>
 *
 * <p>Which worked, in the sense that everybody got something — but only because no API key was
 * ever configured, so {@code sent} was always false and the email always went. The day a key
 * was added, those reminders would have stopped being emailed. Nothing would have failed and no
 * log would have shown a problem; students would simply have had one channel instead of two,
 * and whichever ones had no WhatsApp number would have had none.
 *
 * <p>So sending is routed the same way email is: {@code EmailDispatchService} takes the
 * {@code WhatsAppMessage} riding on the request and hands it to {@code WhatsAppDispatchService},
 * which means one recipient list, one moment, and a {@code communication_log} row either way. A
 * hand-rolled {@code sendTemplate} call outside that path is how the pattern above comes back,
 * so it fails the build unless it is listed here with a reason.
 */
public class WhatsAppDispatchRoutingTest {

    /** The transport. A {@code sendTemplate} call on this bypasses the dispatcher. */
    private static final String TRANSPORT = "com.kccitm.api.service.counselling.WhatsAppService";

    /** The dispatcher's own package — this <em>is</em> the plumbing. */
    private static final String DISPATCH_PACKAGE = "com.kccitm.api.service.whatsapp.";

    /**
     * Classes allowed to send directly. Keep this list short: each entry is a message whose
     * delivery is decided somewhere other than the one place that decides it for everything else.
     */
    private static final Set<String> EXCLUSIONS = new HashSet<>(Arrays.asList(
            // Admin-triggered ad-hoc sends from the Communication screen: a person picks the
            // recipients and the template by hand and there is no accompanying email to ride
            // with. These write their own communication_log rows.
            "com.kccitm.api.controller.ContactPersonController",
            // sendCheckinCodeToStudent sends the OTP synchronously on both channels and returns
            // which ones took it, because a counsellor is standing at the button waiting to be
            // told. Its email marks the companion already-sent so the code is not sent twice —
            // both channels still go out. The booking nudge also sends directly, but only for a
            // student with a phone number and no email address: there is no mail to ride with.
            "com.kccitm.api.service.counselling.CounsellingNotificationService"
    ));

    /**
     * The other half of the rule, and the half that was missed first time round.
     *
     * <p>{@link EmailDispatchRoutingTest} lets a small number of classes reach a mail transport
     * directly — today, the report pipeline's senders, which compose and transport their own
     * message because the send has to be synchronous and throw to hold the delivery guarantee.
     * Those emails do not pass through {@code EmailDispatchService}, so they do not get a
     * WhatsApp companion for free, and the report-ready mail is the highest-volume email in the
     * system: every student, every batch. It went out on one channel.
     *
     * <p>{@code ReportEmailConsumer} is the only caller of those senders, so it is where the
     * companion is sent from. This asserts it still is. Anything else that starts sending email
     * outside the dispatcher has to do the same and be named here.
     */
    private static final Set<String> SENDS_EMAIL_OUTSIDE_THE_DISPATCHER = new HashSet<>(Arrays.asList(
            "com.kccitm.api.service.b2c.report.pipeline.ReportEmailConsumer"
    ));

    private static final String WHATSAPP_DISPATCHER =
            "com.kccitm.api.service.whatsapp.WhatsAppDispatchService";

    @Test
    public void emailSentOutsideTheDispatcherStillSendsWhatsApp() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.kccitm.api");

        List<String> missing = new ArrayList<>();
        for (String name : SENDS_EMAIL_OUTSIDE_THE_DISPATCHER) {
            JavaClass cls = classes.stream()
                    .filter(c -> c.getFullName().equals(name))
                    .findFirst()
                    .orElse(null);
            if (cls == null) {
                missing.add(name + " — class not found; was it renamed? Update this test.");
                continue;
            }
            boolean sendsCompanion = cls.getMethodCallsFromSelf().stream()
                    .anyMatch(call -> WHATSAPP_DISPATCHER.equals(call.getTargetOwner().getFullName()));
            if (!sendsCompanion) {
                missing.add(name + " sends email without going through EmailDispatchService, "
                        + "and no longer sends a WhatsApp companion either");
            }
        }

        if (!missing.isEmpty()) {
            StringBuilder sb = new StringBuilder("Emails going out on one channel only:\n");
            for (String m : missing) {
                sb.append("  - ").append(m).append('\n');
            }
            sb.append("\nEvery email sends a WhatsApp. For a sender that bypasses the dispatcher, ")
              .append("call WhatsAppDispatchService.sendForExternalEmail(...) once the email is away.");
            fail(sb.toString());
        }
    }

    @Test
    public void everyWhatsAppMustGoOutWithItsEmail() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.kccitm.api");

        // A set: two call sites in one method are one problem to fix.
        Set<String> violations = new LinkedHashSet<>();

        for (JavaClass cls : classes) {
            String caller = cls.getFullName();
            if (caller.startsWith(DISPATCH_PACKAGE)) continue;
            if (TRANSPORT.equals(caller)) continue;
            if (EXCLUSIONS.contains(caller)) continue;

            for (JavaMethodCall call : cls.getMethodCallsFromSelf()) {
                if (!TRANSPORT.equals(call.getTargetOwner().getFullName())) continue;
                // Only the act of sending matters; asking for a campaign name does not.
                if (!"sendTemplate".equals(call.getName())) continue;

                violations.add(caller + "#" + call.getOrigin().getName()
                        + " → WhatsAppService.sendTemplate()");
            }
        }

        if (!violations.isEmpty()) {
            List<String> sorted = new ArrayList<>(violations);
            Collections.sort(sorted);
            StringBuilder sb = new StringBuilder();
            sb.append("WhatsApp sent outside the email dispatch path (")
              .append(violations.size()).append("):\n");
            for (String v : sorted) {
                sb.append("  - ").append(v).append('\n');
            }
            sb.append("\nFix by attaching a WhatsAppMessage to the EmailSendRequest (or to the ")
              .append("sendMail(type, to, mail, whatsApp) overload) so both channels leave in one ")
              .append("dispatch — or add the class to EXCLUSIONS in ")
              .append(WhatsAppDispatchRoutingTest.class.getSimpleName())
              .append(".java with a one-line justification.");
            fail(sb.toString());
        }
    }
}
