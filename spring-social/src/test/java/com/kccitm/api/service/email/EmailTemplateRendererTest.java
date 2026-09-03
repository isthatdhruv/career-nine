package com.kccitm.api.service.email;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Ported templates carry the if/else of their Java builders as {{#flag}} sections. These
 * pin the contract the port relies on: sections honour truthiness, nest, and never swallow
 * content when a marker is unmatched.
 */
class EmailTemplateRendererTest {

    private final EmailTemplateRenderer renderer = new EmailTemplateRenderer();

    private static Map<String, String> ctx(String... kv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(kv[i], kv[i + 1]);
        }
        return m;
    }

    @Test
    @DisplayName("plain tokens are replaced and unknown tokens stay visible")
    void tokens() {
        assertEquals("Hi Aanya, {{missing}}", renderer.render("Hi {{first_name}}, {{missing}}", ctx("first_name", "Aanya")));
        assertEquals("", renderer.render(null, ctx()));
        assertEquals("x {{a}}", renderer.render("x {{a}}", null));
    }

    @Test
    @DisplayName("{{#flag}} renders only when the flag is truthy")
    void positiveSection() {
        String t = "A{{#has_credentials}} user={{username}}{{/has_credentials}} Z";
        assertEquals("A user=aanya01 Z", renderer.render(t, ctx("has_credentials", "true", "username", "aanya01")));
        assertEquals("A Z", renderer.render(t, ctx("has_credentials", "", "username", "aanya01")));
        assertEquals("A Z", renderer.render(t, ctx("has_credentials", "false")));
        assertEquals("A Z", renderer.render(t, ctx("has_credentials", "0")));
        assertEquals("A Z", renderer.render(t, ctx("username", "x")));
    }

    @Test
    @DisplayName("{{^flag}} renders only when the flag is falsy")
    void inverseSection() {
        String t = "{{^has_parent}}no parent{{/has_parent}}{{#has_parent}}parent {{parent_name}}{{/has_parent}}";
        assertEquals("no parent", renderer.render(t, ctx()));
        assertEquals("parent Rohan", renderer.render(t, ctx("has_parent", "yes", "parent_name", "Rohan")));
    }

    @Test
    @DisplayName("sections nest, including the same key inside itself")
    void nesting() {
        String t = "{{#a}}[{{#b}}b{{/b}}{{^b}}!b{{/b}}]{{/a}}";
        assertEquals("[b]", renderer.render(t, ctx("a", "1", "b", "1")));
        assertEquals("[!b]", renderer.render(t, ctx("a", "1")));
        assertEquals("", renderer.render(t, ctx("b", "1")));
        String same = "{{#a}}x{{#a}}y{{/a}}z{{/a}}";
        assertEquals("xyz", renderer.render(same, ctx("a", "1")));
    }

    @Test
    @DisplayName("an unmatched opener leaves the rest of the template untouched")
    void unmatched() {
        String t = "start {{#a}} dangling {{b}}";
        assertEquals("start {{#a}} dangling B", renderer.render(t, ctx("a", "1", "b", "B")));
    }

    @Test
    void truthiness() {
        assertTrue(EmailTemplateRenderer.isTruthy("true"));
        assertTrue(EmailTemplateRenderer.isTruthy("anything"));
        assertFalse(EmailTemplateRenderer.isTruthy(null));
        assertFalse(EmailTemplateRenderer.isTruthy("  "));
        assertFalse(EmailTemplateRenderer.isTruthy("FALSE"));
        assertFalse(EmailTemplateRenderer.isTruthy("no"));
    }
}
