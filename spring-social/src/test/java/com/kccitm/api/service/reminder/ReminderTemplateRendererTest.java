package com.kccitm.api.service.reminder;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Reminder token values are escaped before substitution: the seeded bodies drop them inside
 * {@code <b>} and {@code href}, so an unescaped ampersand or angle bracket in a student name
 * or a URL would break — or inject into — the markup around it.
 */
class ReminderTemplateRendererTest {

    private final ReminderTemplateRenderer renderer = new ReminderTemplateRenderer();

    @Test
    void valuesAreHtmlEscaped() {
        assertEquals("<b>A &amp; &lt;B&gt;</b>",
                renderer.render("<b>{{x}}</b>", Map.of("x", "A & <B>")));
    }

    @Test
    void quotesAreEscapedSoAnHrefCannotBeBrokenOut() {
        assertEquals("<a href=\"https://x/?a=1&amp;b=2\">go</a>",
                renderer.render("<a href=\"{{link}}\">go</a>", Map.of("link", "https://x/?a=1&b=2")));
    }

    @Test
    void unknownTokensAreLeftInPlace() {
        Map<String, String> ctx = new HashMap<>();
        ctx.put("known", "Aanya");
        assertEquals("Hi Aanya, see {{missing}}",
                renderer.render("Hi {{known}}, see {{missing}}", ctx));
    }

    @Test
    void surroundingTemplateMarkupIsUntouched() {
        assertEquals("<p>Hi <b>Aanya</b></p>",
                renderer.render("<p>Hi <b>{{name}}</b></p>", Map.of("name", "Aanya")));
    }

    @Test
    void nullTemplateRendersEmptyAndNullValueRendersBlank() {
        assertEquals("", renderer.render(null, Map.of("x", "y")));
        Map<String, String> ctx = new HashMap<>();
        ctx.put("x", null);
        assertEquals("[]", renderer.render("[{{x}}]", ctx));
    }
}
