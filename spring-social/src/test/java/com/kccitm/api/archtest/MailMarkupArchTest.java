package com.kccitm.api.archtest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * Rules 2, 4 and 10 at build time: nobody outside the theme package writes email markup, uses a
 * gradient, or bakes a production host into a string. The fix is always the same — build a
 * {@code Mail} and let the theme render it.
 */
public class MailMarkupArchTest {

    private static final List<String> FORBIDDEN = Arrays.asList("<html", "<table", "<div style", "linear-gradient",
            "https://assessment.career-9.com", "https://dashboard.career-9.com", "https://api.career-9.com");

    private static final String THEME = "com.kccitm.api.service.email.theme.";

    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList(
            // The "link expired" page is a web page, not a mail; it keeps its own markup.
            "com.kccitm.api.controller.ShortLinkController",
            // Old seed bodies, kept only so the upgrader can recognise untouched rows.
            "com.kccitm.api.service.email.LegacySeeds",
            // Placeholder samples for the admin editor preview.
            "com.kccitm.api.service.email.EmailTemplateService",
            "com.kccitm.api.service.reminder.ReminderTemplateRenderer",
            // Config defaults for the environment-specific bases live here on purpose.
            "com.kccitm.api.service.b2c.LinkBuilder",
            "com.kccitm.api.service.email.theme.MailLinks",
            // Report and PDF markup, not mail.
            "com.kccitm.api.controller.career9.ReportTemplateController",
            "com.kccitm.api.model.userDefinedModel.htmlToPdfString",
            // No markup of its own: javac inlines LegacySeeds' compile-time constants into this class file.
            "com.kccitm.api.service.email.MailSeedUpgrader"));

    @Test
    public void noMailMarkupOutsideTheTheme() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.kccitm.api");
        List<String> violations = new ArrayList<>();
        for (JavaClass cls : classes) {
            String name = cls.getFullName();
            if (name.startsWith(THEME) || ALLOWED.contains(name) || ALLOWED.contains(name.replaceAll("\\$.*$", ""))) continue;
            // ArchUnit does not expose string constants; read them from the class file's constant pool instead.
            for (String s : ConstantPool.strings(cls)) {
                for (String f : FORBIDDEN) if (s.contains(f)) violations.add(name + " contains \"" + f + "\"");
            }
        }
        if (!violations.isEmpty()) {
            Collections.sort(violations);
            fail("Email markup or hardcoded hosts outside the theme (" + violations.size() + "):\n  - "
                    + String.join("\n  - ", violations)
                    + "\n\nBuild a Mail with the theme blocks instead, or add the class to ALLOWED with a reason.");
        }
    }
}
