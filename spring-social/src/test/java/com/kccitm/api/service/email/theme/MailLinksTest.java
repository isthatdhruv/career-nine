package com.kccitm.api.service.email.theme;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.kccitm.api.service.link.ShortLinkService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MailLinksTest {
    private ShortLinkService shortLinks;
    private MailLinks links;
    private static final String TOKENISED = "https://assessment.career-9.com/assessment/start?t=Ew-aWvPgNTh-0ZyMkdeKiBR6XH3WMdcL1RyRpWMP&e=79";

    @BeforeEach
    void setUp() {
        shortLinks = mock(ShortLinkService.class);
        links = new MailLinks();
        ReflectionTestUtils.setField(links, "shortLinkService", shortLinks);
        ReflectionTestUtils.setField(links, "apiBaseUrl", "https://api.career-9.com");
    }

    @Test
    void shortPageAddressIsLeftAlone() {
        MailLink l = links.of("https://dashboard.career-9.com/auth");
        assertEquals("https://dashboard.career-9.com/auth", l.getHref());
        assertEquals("dashboard.career-9.com/auth", l.getDisplay());
        verify(shortLinks, never()).codeFor(anyString(), anyString());
    }

    @Test
    void tokenisedLinkIsShortened() {
        when(shortLinks.codeFor(eq(TOKENISED), anyString())).thenReturn("Kx7Pq2M");
        MailLink l = links.of(TOKENISED, "assessment_start");
        assertEquals("https://api.career-9.com/s/Kx7Pq2M", l.getHref());
        assertEquals("api.career-9.com/s/Kx7Pq2M", l.getDisplay());
    }

    @Test
    void longLinkWithoutTokenIsShortenedToo() {
        String url = "https://storage-c9.sgp1.cdn.digitaloceanspaces.com/reports/2026/09/some-very-long-file-name-here.pdf";
        assertTrue(MailLinks.isLong(url));
        when(shortLinks.codeFor(eq(url), anyString())).thenReturn("Ab3Cd4E");
        assertEquals("api.career-9.com/s/Ab3Cd4E", links.of(url).getDisplay());
    }

    @Test
    void whenShorteningFailsTheDisplayHidesTheToken() {
        when(shortLinks.codeFor(anyString(), anyString())).thenReturn(null);
        MailLink l = links.of(TOKENISED);
        assertEquals(TOKENISED, l.getHref(), "the mail still works");
        assertEquals("assessment.career-9.com/assessment/start", l.getDisplay());
    }

    @Test
    void rewriteReplacesLongHrefsAndVisibleUrls() {
        when(shortLinks.codeFor(eq(TOKENISED), anyString())).thenReturn("Kx7Pq2M");
        String html = "<p><a href=\"" + TOKENISED + "\">Start</a> or copy " + TOKENISED + "</p><a href='https://career-9.com'>site</a>";
        String out = links.rewrite(html);
        assertFalse(out.contains("t=Ew-"));
        assertTrue(out.contains("href=\"https://api.career-9.com/s/Kx7Pq2M\""));
        assertTrue(out.contains("copy https://api.career-9.com/s/Kx7Pq2M"));
        assertTrue(out.contains("href='https://career-9.com'"));
    }
}
