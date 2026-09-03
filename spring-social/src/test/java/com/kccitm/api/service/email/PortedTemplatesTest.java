package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.service.email.port.AuthAndRegistrationPorts;
import com.kccitm.api.service.email.port.CounsellingLifecyclePorts;
import com.kccitm.api.service.email.port.CounsellingOpsAndReportPorts;
import com.kccitm.api.service.email.port.PaymentAndB2cPorts;
import com.kccitm.api.service.email.port.PortedTemplate;
import com.kccitm.api.service.email.port.PortedTemplateSource;
import com.kccitm.api.service.email.port.SchoolReportAndReminderPorts;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The ported templates are the catalogue's source of truth for what the system sends today.
 * These checks keep them honest: every mail key is unique, every section marker closes,
 * every placeholder exists in the palette (so the editor can offer it and the resolver can
 * fill it), and every variant flag the body branches on is declared for the preview.
 */
class PortedTemplatesTest {

    private static final Pattern TOKEN = Pattern.compile("\\{\\{([#^/]?)([A-Za-z0-9_]+)\\}\\}");

    private static List<PortedTemplateSource> sources() {
        return Arrays.asList(
                new AuthAndRegistrationPorts(),
                new PaymentAndB2cPorts(),
                new CounsellingLifecyclePorts(),
                new CounsellingOpsAndReportPorts(),
                new SchoolReportAndReminderPorts());
    }

    private static List<PortedTemplate> all() {
        List<PortedTemplate> out = new ArrayList<>();
        for (PortedTemplateSource s : sources()) {
            out.addAll(s.templates());
        }
        return out;
    }

    @Test
    @DisplayName("mail keys are unique across every source")
    void uniqueKeys() {
        Set<String> seen = new HashSet<>();
        List<String> dupes = new ArrayList<>();
        for (PortedTemplate t : all()) {
            if (!seen.add(t.mailKey)) {
                dupes.add(t.mailKey);
            }
        }
        assertTrue(dupes.isEmpty(), "duplicate mail keys: " + dupes);
        assertTrue(seen.size() >= 50, "expected the full port, found " + seen.size());
    }

    @Test
    @DisplayName("every placeholder used is in the EmailPlaceholder palette")
    void placeholdersKnown() {
        Set<String> palette = new HashSet<>();
        for (EmailPlaceholder p : EmailPlaceholder.values()) {
            palette.add(p.key());
        }
        List<String> problems = new ArrayList<>();
        for (PortedTemplate t : all()) {
            Set<String> flags = new HashSet<>(t.variantFlags);
            for (String part : new String[] {t.subject, t.body, t.text}) {
                if (part == null) continue;
                Matcher m = TOKEN.matcher(part);
                while (m.find()) {
                    String key = m.group(2);
                    boolean isSection = !m.group(1).isEmpty();
                    if (isSection) {
                        if (!flags.contains(key) && !palette.contains(key)) {
                            problems.add(t.mailKey + ": undeclared section flag " + key);
                        }
                    } else if (!palette.contains(key)) {
                        problems.add(t.mailKey + ": unknown placeholder " + key);
                    }
                }
            }
        }
        assertTrue(problems.isEmpty(), String.join("\n", problems));
    }

    @Test
    @DisplayName("sections balance and render cleanly with flags on and off")
    void sectionsRender() {
        EmailTemplateRenderer renderer = new EmailTemplateRenderer();
        List<String> problems = new ArrayList<>();
        for (PortedTemplate t : all()) {
            for (String flagValue : new String[] {"true", ""}) {
                Map<String, String> ctx = new HashMap<>();
                for (String f : t.variantFlags) {
                    ctx.put(f, flagValue);
                }
                for (String part : new String[] {t.subject, t.body, t.text}) {
                    if (part == null) continue;
                    String rendered = renderer.render(part, ctx);
                    if (rendered.contains("{{#") || rendered.contains("{{^") || rendered.contains("{{/")) {
                        problems.add(t.mailKey + ": unbalanced section with flags=" + flagValue);
                        break;
                    }
                }
            }
        }
        assertTrue(problems.isEmpty(), String.join("\n", problems));
    }

    @Test
    @DisplayName("every template names its source and has a subject and body")
    void provenance() {
        for (PortedTemplate t : all()) {
            assertTrue(t.sourceRef != null && t.sourceRef.contains("#") || t.sourceRef.contains("reminder_config"),
                    t.mailKey + " has no source reference");
            assertFalse(t.subject == null || t.subject.trim().isEmpty(), t.mailKey + " has no subject");
            assertFalse(t.body.trim().isEmpty(), t.mailKey + " has an empty body");
            assertTrue(t.name.length() > 3, t.mailKey + " has no name");
        }
    }
}
