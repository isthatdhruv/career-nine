package com.kccitm.api.service.email.theme;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailRulesTest {
    private static final MailLink OK = MailLink.plain("https://dashboard.career-9.com/auth");

    @Test
    void cleanMailHasNoViolations() {
        Mail m = Mail.builder().subject("Your login details").preheader("Sign in to begin.")
                .title("Your login details").p("Hi Aarav,").action(OK, "Sign in").signature().build();
        assertEquals(List.of(), MailRules.violations(m));
    }

    @Test
    void flagsEachRule() {
        Mail m = Mail.builder()
                .subject("Congratulations! You have completed the Career Discovery Assessment today")
                .preheader("")
                .p("Copy https://assessment.career-9.com/start?t=abc into your browser, or reply to this email.")
                .action(OK, "One").action(OK, "Two")
                .outline(OK, "A").outline(OK, "B")
                .action(MailLink.of("https://x/?t=abc", "x/?t=abc"), "Bad display")
                .build();
        List<String> v = MailRules.violations(m);
        assertTrue(v.stream().anyMatch(s -> s.contains("subject over 60")));
        assertTrue(v.stream().anyMatch(s -> s.contains("exclamation")));
        assertTrue(v.stream().anyMatch(s -> s.contains("no preheader")));
        assertTrue(v.stream().anyMatch(s -> s.contains("raw URL")));
        assertTrue(v.stream().anyMatch(s -> s.contains("replying")));
        assertTrue(v.stream().anyMatch(s -> s.contains("3 primary buttons")));
        assertTrue(v.stream().anyMatch(s -> s.contains("2 secondary buttons")));
        assertTrue(v.stream().anyMatch(s -> s.contains("link display carries a token")));
    }
}
