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
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * Every outbound email must go through {@code EmailDispatchService}, because that is the only
 * thing that writes an {@code email_send_log} row.
 *
 * <p>The log is what the admin Email Logs screen reads, and it is the only record that a student
 * was ever written to. A send that goes straight to a mail transport still arrives in the
 * student's inbox, which is exactly what makes the omission hard to notice: nothing is broken,
 * there is simply no trace. The gap only shows up months later, when someone asks whether a
 * reminder went out and the honest answer is that we cannot tell.
 *
 * <p>So this is a build-time gate rather than a convention. Calling a transport directly fails
 * the build, and the fix is one of two things: route through {@code EmailDispatchService}, or add
 * the class here with a line saying why it is allowed to be invisible.
 */
public class EmailDispatchRoutingTest {

    /**
     * The transports. A {@code send*} call landing on one of these leaves no log row unless the
     * caller writes one itself.
     */
    private static final Set<String> TRANSPORTS = new HashSet<>(Arrays.asList(
            "com.kccitm.api.service.SmtpEmailService",
            "com.kccitm.api.service.SmtpEmailServiceImpl",
            "com.kccitm.api.service.GmailApiEmailServiceImpl",
            "com.kccitm.api.service.OdooEmailService",
            "com.kccitm.api.service.email.GmailApiSender",
            "com.kccitm.api.service.email.GmailSmtpSender",
            "org.springframework.mail.javamail.JavaMailSender",
            "org.springframework.mail.javamail.JavaMailSenderImpl"
    ));

    /** The dispatcher and the senders it owns — these <em>are</em> the plumbing. */
    private static final String DISPATCH_PACKAGE = "com.kccitm.api.service.email.";

    /**
     * Classes allowed to reach a transport directly. Keep this list short: each entry is a set of
     * emails that will never appear on the Email Logs screen.
     */
    private static final Set<String> EXCLUSIONS = new HashSet<>(Arrays.asList(
            // The report pipeline's own sender abstraction. GmailReportEmailSender writes its own
            // email_send_log row (it holds EmailSendLogRepository) rather than going through the
            // dispatcher, because it composes and renders the report mail itself.
            "com.kccitm.api.service.b2c.report.pipeline.GmailReportEmailSender",
            "com.kccitm.api.service.b2c.report.pipeline.SmtpReportEmailSender",
            // Opt-in Odoo transport for the report pipeline
            // (report.pipeline.email-transport=odoo, off by default). This one genuinely does NOT
            // log — if that transport is ever switched on, give it a log row first.
            "com.kccitm.api.service.b2c.report.pipeline.OdooEmailSender"
    ));

    @Test
    public void everyEmailMustBeSentThroughTheDispatcher() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.kccitm.api");

        // A set: two call sites in one method (an if/else pair, say) are one problem to
        // fix, and listing it twice only makes the failure harder to read.
        Set<String> violations = new LinkedHashSet<>();

        for (JavaClass cls : classes) {
            String caller = cls.getFullName();
            if (caller.startsWith(DISPATCH_PACKAGE)) continue;
            // A transport calling another transport is the transport doing its job.
            if (TRANSPORTS.contains(caller)) continue;
            if (EXCLUSIONS.contains(caller)) continue;

            for (JavaMethodCall call : cls.getMethodCallsFromSelf()) {
                String target = call.getTargetOwner().getFullName();
                if (!TRANSPORTS.contains(target)) continue;
                // Only the act of sending matters; wiring a bean up does not.
                if (!call.getName().startsWith("send")) continue;

                violations.add(caller + "#" + call.getOrigin().getName()
                        + " → " + simpleName(target) + "." + call.getName() + "()");
            }
        }

        if (!violations.isEmpty()) {
            List<String> sorted = new ArrayList<>(violations);
            Collections.sort(sorted);
            StringBuilder sb = new StringBuilder();
            sb.append("Emails sent outside EmailDispatchService (")
              .append(violations.size()).append(") — these leave no email_send_log row:\n");
            for (String v : sorted) {
                sb.append("  - ").append(v).append('\n');
            }
            sb.append("\nFix by routing through EmailDispatchService (sendText / sendHtml / send), ")
              .append("or add the class to EXCLUSIONS in ")
              .append(EmailDispatchRoutingTest.class.getSimpleName())
              .append(".java with a one-line justification.");
            fail(sb.toString());
        }
    }

    private static String simpleName(String fqn) {
        int dot = fqn.lastIndexOf('.');
        return dot < 0 ? fqn : fqn.substring(dot + 1);
    }
}
