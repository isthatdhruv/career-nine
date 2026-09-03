package com.kccitm.api.service.email;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailTemplateLinterTest {

    private final EmailTemplateLinter linter = new EmailTemplateLinter();

    private static boolean has(List<EmailTemplateLinter.Finding> f, String code) {
        return f.stream().anyMatch(x -> x.code.equals(code));
    }

    private static String message(List<EmailTemplateLinter.Finding> f, String code) {
        return f.stream().filter(x -> x.code.equals(code)).findFirst().map(x -> x.message).orElse("");
    }

    @Test
    @DisplayName("a password in the body is flagged, whether as a placeholder or as prose")
    void credentials() {
        assertTrue(has(linter.lint("s", "<p>Password: {{password}}</p>", null, null, EmailType.LOGIN_CREDENTIALS, null), "CREDENTIALS_IN_BODY"));
        assertTrue(has(linter.lint("s", "<p>Your password is 12-05-2008</p>", null, null, EmailType.GENERIC, null), "CREDENTIALS_IN_BODY"));
        assertFalse(has(linter.lint("s", "<p>Reset your password here</p>", null, null, EmailType.GENERIC, null), "CREDENTIALS_IN_BODY"));
    }

    @Test
    @DisplayName("emoji are caught as raw characters and as numeric entities")
    void emoji() {
        assertTrue(has(linter.lint("🎉 Done", "<p>x</p>", null, null, EmailType.GENERIC, null), "EMOJI_IN_SUBJECT"));
        assertTrue(has(linter.lint("s", "<h2>&#127881; Your report is ready</h2>", null, null, EmailType.GENERIC, null), "EMOJI_IN_HEADING"));
        assertFalse(has(linter.lint("Plain subject", "<h2>Plain</h2>", null, null, EmailType.GENERIC, null), "EMOJI_IN_SUBJECT"));
    }

    @Test
    @DisplayName("shouting and exclamation marks are informational")
    void tone() {
        List<EmailTemplateLinter.Finding> f = linter.lint("Great work!", "<span>&#128640; YOUR NEXT STEP</span><p>Go! Now!</p>", null, null, EmailType.GENERIC, null);
        assertTrue(has(f, "ALL_CAPS_WORDS"));
        assertTrue(message(f, "ALL_CAPS_WORDS").contains("NEXT"));
        assertTrue(has(f, "EXCLAMATION_IN_SUBJECT"));
        assertTrue(has(f, "EXCLAMATION_HEAVY"));
        assertFalse(has(linter.lint("s", "<p>Pay INR 499 by OTP</p>", null, null, EmailType.GENERIC, null), "ALL_CAPS_WORDS"));
    }

    @Test
    @DisplayName("subscribed mail without an unsubscribe line is a warning; internal mail skips the chrome checks")
    void classes() {
        assertTrue(has(linter.lint("s", "<p>Reminder</p>", null, MailClass.SUBSCRIBED, EmailType.REMINDER, null), "SUBSCRIBED_NO_UNSUBSCRIBE"));
        assertFalse(has(linter.lint("s", "<p>Reminder <a href=\"{{unsubscribe_link}}\">Unsubscribe</a></p>", null, MailClass.SUBSCRIBED, EmailType.REMINDER, null), "SUBSCRIBED_NO_UNSUBSCRIBE"));
        List<EmailTemplateLinter.Finding> internal = linter.lint("s", "<p>ops</p>", null, MailClass.INTERNAL, EmailType.LEAD_NOTIFICATION, null);
        assertFalse(has(internal, "NO_SHARED_FOOTER"));
        assertFalse(has(internal, "NO_SHARED_HEADER"));
        List<EmailTemplateLinter.Finding> student = linter.lint("s", "<p>hi</p>", null, MailClass.TRANSACTIONAL, EmailType.GENERIC, null);
        assertTrue(has(student, "NO_SHARED_FOOTER"));
        assertFalse(has(linter.lint("s", "{{email_header}}<p>hi</p>{{email_footer}}", "hi", MailClass.TRANSACTIONAL, EmailType.GENERIC, null), "NO_SHARED_FOOTER"));
    }

    @Test
    @DisplayName("links: placeholder links pass, own-domain literals are info, other domains warn")
    void links() {
        assertFalse(has(linter.lint("s", "<a href=\"{{dashboard_link}}\">go</a>", null, null, EmailType.GENERIC, null), "HARDCODED_LINK"));
        List<EmailTemplateLinter.Finding> own = linter.lint("s", "<a href=\"https://dashboard.career-9.com/student/login\">go</a>", null, null, EmailType.GENERIC, null);
        assertTrue(has(own, "HARDCODED_LINK"));
        assertFalse(has(own, "OFF_DOMAIN_LINK"));
        List<EmailTemplateLinter.Finding> off = linter.lint("s", "<a href=\"https://calendar.google.com/x\">cal</a>", null, null, EmailType.GENERIC, null);
        assertTrue(has(off, "OFF_DOMAIN_LINK"));
        assertTrue(message(off, "OFF_DOMAIN_LINK").contains("calendar.google.com"));
        assertFalse(has(linter.lint("s", "<a href=\"mailto:{{lead_email}}\">reply</a>", null, null, EmailType.GENERIC, null), "OFF_DOMAIN_LINK"));
        assertEquals("dashboard.career-9.com", EmailTemplateLinter.host("https://dashboard.career-9.com/a?b=c"));
    }

    @Test
    @DisplayName("placeholders outside the type's palette warn; declared section flags do not")
    void placeholders() {
        List<EmailTemplateLinter.Finding> f = linter.lint("Hi {{first_name}}", "<p>{{reset_link}} {{made_up}}</p>", null, null, EmailType.PASSWORD_RESET, null);
        assertTrue(has(f, "UNKNOWN_PLACEHOLDER"));
        assertTrue(message(f, "UNKNOWN_PLACEHOLDER").contains("made_up"));
        assertFalse(message(f, "UNKNOWN_PLACEHOLDER").contains("first_name"));
        List<EmailTemplateLinter.Finding> flagged = linter.lint("s", "{{#has_name}}Hi {{first_name}}{{/has_name}}", null, null, EmailType.PASSWORD_RESET, Arrays.asList("has_name"));
        assertFalse(has(flagged, "UNKNOWN_PLACEHOLDER"));
        assertFalse(has(flagged, "UNDECLARED_SECTION_FLAG"));
        assertTrue(has(linter.lint("s", "{{#has_name}}x{{/has_name}}", null, null, EmailType.PASSWORD_RESET, Collections.emptyList()), "UNDECLARED_SECTION_FLAG"));
    }

    @Test
    @DisplayName("warnings come before infos")
    void ordering() {
        List<EmailTemplateLinter.Finding> f = linter.lint("", "<p>Do not reply. {{password}}</p>", null, MailClass.TRANSACTIONAL, EmailType.GENERIC, null);
        assertEquals(EmailTemplateLinter.WARN, f.get(0).severity);
        assertTrue(has(f, "DO_NOT_REPLY_TEXT"));
        assertTrue(has(f, "NO_TEXT_VERSION"));
    }
}
