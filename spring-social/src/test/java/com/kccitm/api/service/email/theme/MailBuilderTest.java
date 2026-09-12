package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailBuilderTest {

    @Test
    void escapesValuesButKeepsAuthoredMarkup() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .p("Your payment for " + Mail.b("A & B <x>") + " is in.")
                .build();
        String html = m.getBlocks().get(0).html();
        assertTrue(html.contains("<b>A &amp; B &lt;x&gt;</b>"));
        assertEquals("Your payment for A & B <x> is in.", m.getBlocks().get(0).text());
    }

    @Test
    void countsActions() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .action(MailLink.plain("https://dashboard.career-9.com/auth"), "Sign in")
                .outline(MailLink.plain("https://career-9.com"), "Site")
                .build();
        assertEquals(1, m.primaryActions());
        assertEquals(1, m.secondaryActions());
    }

    @Test
    void actionShowsDisplayNotHref() {
        MailLink l = MailLink.of("https://api.career-9.com/s/Kx7Pq2M", "api.career-9.com/s/Kx7Pq2M");
        Mail m = Mail.builder().subject("s").preheader("p").action(l, "Open").build();
        String html = m.getBlocks().get(0).html();
        assertTrue(html.contains("href=\"https://api.career-9.com/s/Kx7Pq2M\""));
        assertTrue(html.contains("Or open: <a"));
        assertTrue(html.contains(">api.career-9.com/s/Kx7Pq2M</a>"));
        assertEquals("Open: api.career-9.com/s/Kx7Pq2M", m.getBlocks().get(0).text());
    }

    @Test
    void detailsSkipEmptyRowsAndTextIsLabelled() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .details(new Mail.Row("Date", "Thu"), new Mail.Row("Venue", null), new Mail.Row("Mode", "Online"))
                .build();
        String html = m.getBlocks().get(0).html();
        assertFalse(html.contains("Venue"));
        assertEquals("  Date: Thu\n  Mode: Online", m.getBlocks().get(0).text());
    }

    @Test
    void plainLinkDisplayDropsScheme() {
        assertEquals("dashboard.career-9.com/auth", MailLink.plain("https://dashboard.career-9.com/auth").getDisplay());
    }

    @Test
    void tableRendersHeaderAndRows() {
        List<String[]> rows = new ArrayList<>();
        rows.add(new String[]{"10:00", "Aarav"});
        Mail m = Mail.builder().subject("s").preheader("p")
                .table(new String[]{"Time", "Student"}, rows)
                .build();
        assertTrue(m.getBlocks().get(0).html().contains("<th"));
        assertEquals("  Time | Student\n  10:00 | Aarav", m.getBlocks().get(0).text());
    }

    @Test
    void decodesCommonHtmlEntitiesIncludingCurlyQuotes() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .p("It&rsquo;s &lsquo;on&rsquo;")
                .build();
        assertEquals("It’s ‘on’", m.getBlocks().get(0).text());
    }

    @Test
    void decodesNumericCharacterReferences() {
        Mail m = Mail.builder().subject("s").preheader("p")
                .p("Done &#10003; and &#127881; &#x2019;")
                .build();
        assertEquals("Done ✓ and 🎉 ’", m.getBlocks().get(0).text());
    }
}
