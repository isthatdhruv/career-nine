package com.kccitm.api.service.email.theme;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MailRendererTest {
    private static final Brand STD = Brand.standard("https://cdn.example/logo.png", "support@career-9.net", "https://career-9.com", 2026);
    private static final Brand WL = Brand.whitelabel("Delhi Public School, Noida", "https://cdn.example/dps.png", "https://cdn.example/logo.png", "support@career-9.net", "https://career-9.com", 2026);
    private static final Mail MAIL = Mail.builder().subject("Your login details").preheader("Username and password inside.")
            .title("Your login details").p("Hi " + Mail.v("Aarav") + ",").action(MailLink.plain("https://dashboard.career-9.com/auth"), "Sign in").signature().build();

    @Test
    void standardShellHasStripLogoHelpAndFooter() {
        String html = MailShell.render(MAIL, STD);
        assertTrue(html.contains(MailTheme.SHELL_MARKER));
        assertTrue(html.contains("background:#1B5E20;height:8px"));
        assertTrue(html.contains("src=\"https://cdn.example/logo.png\" width=\"127\" height=\"48\" alt=\"Career-9\""));
        assertTrue(html.contains("Help: <a href=\"mailto:support@career-9.net\""));
        assertTrue(html.contains("Career-9 &middot; Ensuring Career Success"));
        assertTrue(html.contains("&copy; 2026 Career-9. All rights reserved."));
        assertTrue(html.contains("display:none;max-height:0;overflow:hidden;opacity:0;\">Username and password inside."));
        assertFalse(html.contains("linear-gradient"));
    }

    @Test
    void whitelabelShellUsesSchoolMarkAndOnBehalfLine() {
        String html = MailShell.render(MAIL, WL);
        assertTrue(html.contains("src=\"https://cdn.example/dps.png\" width=\"36\" height=\"36\""));
        assertTrue(html.contains("Delhi Public School, Noida"));
        assertTrue(html.contains("Powered by Career-9"));
        assertTrue(html.contains("Sent by Career-9 on behalf of Delhi Public School, Noida."));
        assertFalse(html.contains("Ensuring Career Success"));
    }

    @Test
    void textPartCarriesBlocksAndFooter() {
        String text = MailShell.text(MAIL, STD);
        assertTrue(text.startsWith("YOUR LOGIN DETAILS\n\nHi Aarav,\n\nSign in: dashboard.career-9.com/auth\n\nRegards,\nCareer-9 Team"));
        assertTrue(text.endsWith("Questions? Write to support@career-9.net\n© 2026 Career-9. All rights reserved. · career-9.com"));
    }

    @Test
    void wrapForeignAddsShellOnceAndDerivesPreheader() {
        String foreign = "<div><p>Dear Mr Menon, please find the reports attached.</p></div>";
        String once = MailShell.wrapForeign(foreign, STD);
        assertTrue(once.contains(MailTheme.SHELL_MARKER));
        assertTrue(once.contains("Dear Mr Menon, please find the reports attached."));
        assertSame(once, MailShell.wrapForeign(once, STD), "already shelled html is returned untouched");
        assertEquals("Dear Mr Menon, please find the reports attached.", MailShell.preheaderFrom(foreign));
        assertEquals(90, MailShell.preheaderFrom("<p>" + "x".repeat(200) + "</p>").length());
    }

    @Test
    void wrapForeignStripsADocumentWrapper() {
        String doc = "<!DOCTYPE html><html><head><style>p{color:red}</style></head><body style=\"margin:0\"><p>Hello</p></body></html>";
        String out = MailShell.wrapForeign(doc, STD);
        assertFalse(out.contains("<html"));
        assertFalse(out.contains("<style>"));
        assertTrue(out.contains("<p>Hello</p>"));
    }
}
