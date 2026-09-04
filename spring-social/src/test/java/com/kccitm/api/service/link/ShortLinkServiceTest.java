package com.kccitm.api.service.link;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.ShortLink;
import com.kccitm.api.repository.Career9.ShortLinkRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The property that matters most here is the one that is easiest to lose in a later edit: a fault
 * in shortening must never propagate to the caller. {@code LinkBuilder} reads a null as "send the
 * full URL", so every failure path below is the difference between a student getting an ugly link
 * and a student getting no email at all.
 */
class ShortLinkServiceTest {

    private static final String TARGET =
            "https://assessment.career-9.com/counselling-booking/eyJhbGciOiJIUzI1NiJ9.payload.sig";

    private ShortLinkRepository repository;
    private ShortLinkService service;

    @BeforeEach
    void setUp() {
        repository = mock(ShortLinkRepository.class);
        service = new ShortLinkService();
        ReflectionTestUtils.setField(service, "repository", repository);
        ReflectionTestUtils.setField(service, "enabled", true);
    }

    @Test
    @DisplayName("mints a code and stores the full URL against it")
    void mintsACode() {
        when(repository.findByTargetHashOrderByIdDesc(anyString()))
                .thenReturn(Collections.emptyList());
        when(repository.existsByCode(anyString())).thenReturn(false);

        String code = service.codeFor(TARGET, "counselling_booking");

        assertEquals(7, code.length(), "codes are 7 characters");
        assertTrue(code.matches("[2-9A-HJ-NP-Za-km-z]+"), "no 0/O/1/l/I, which get misread aloud");

        ArgumentCaptor<ShortLink> saved = ArgumentCaptor.forClass(ShortLink.class);
        verify(repository).saveAndFlush(saved.capture());
        assertEquals(TARGET, saved.getValue().getTargetUrl());
        assertEquals("counselling_booking", saved.getValue().getPurpose());
        assertEquals(code, saved.getValue().getCode());
        assertNull(saved.getValue().getExpiresAt(), "the target's own token governs validity");
    }

    @Test
    @DisplayName("reuses the code of an identical, unexpired target instead of adding a row")
    void reusesAnExistingCode() {
        ShortLink existing = new ShortLink();
        existing.setCode("Kd8x2Qa");
        existing.setTargetUrl(TARGET);
        when(repository.findByTargetHashOrderByIdDesc(anyString()))
                .thenReturn(Collections.singletonList(existing));

        assertEquals("Kd8x2Qa", service.codeFor(TARGET, "counselling_booking"));
        verify(repository, never()).saveAndFlush(any(ShortLink.class));
    }

    @Test
    @DisplayName("does not reuse a row whose URL merely hashes alike, nor an expired one")
    void skipsUnusableRows() {
        ShortLink expired = new ShortLink();
        expired.setCode("Expired");
        expired.setTargetUrl(TARGET);
        expired.setExpiresAt(LocalDateTime.now().minusDays(1));
        ShortLink different = new ShortLink();
        different.setCode("Differnt");
        different.setTargetUrl("https://assessment.career-9.com/somewhere-else");

        when(repository.findByTargetHashOrderByIdDesc(anyString()))
                .thenReturn(Arrays.asList(expired, different));
        when(repository.existsByCode(anyString())).thenReturn(false);

        String code = service.codeFor(TARGET, "counselling_booking");

        assertFalse("Expired".equals(code) || "Differnt".equals(code));
        verify(repository).saveAndFlush(any(ShortLink.class));
    }

    @Test
    @DisplayName("returns null rather than throwing when the database is unavailable")
    void survivesADatabaseFault() {
        when(repository.findByTargetHashOrderByIdDesc(anyString()))
                .thenThrow(new RuntimeException("connection reset"));

        assertNull(service.codeFor(TARGET, "counselling_booking"),
                "the caller falls back to the full URL; the mail still goes out");
    }

    @Test
    @DisplayName("returns null when the feature is switched off, touching nothing")
    void respectsTheKillSwitch() {
        ReflectionTestUtils.setField(service, "enabled", false);

        assertNull(service.codeFor(TARGET, "counselling_booking"));
        verify(repository, never()).findByTargetHashOrderByIdDesc(anyString());
    }

    @Test
    @DisplayName("returns null for a blank target instead of storing an empty row")
    void ignoresBlankTargets() {
        assertNull(service.codeFor(null, "x"));
        assertNull(service.codeFor("   ", "x"));
        verify(repository, never()).saveAndFlush(any(ShortLink.class));
    }

    @Test
    @DisplayName("does not resolve a code whose row has expired")
    void doesNotResolveExpired() {
        ShortLink expired = new ShortLink();
        expired.setCode("Kd8x2Qa");
        expired.setTargetUrl(TARGET);
        expired.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(repository.findByCode("Kd8x2Qa")).thenReturn(Optional.of(expired));

        assertFalse(service.resolve("Kd8x2Qa").isPresent());
    }

    @Test
    @DisplayName("a failed hit count does not surface to the redirect")
    void hitCountFailureIsSwallowed() {
        doThrow(new RuntimeException("deadlock")).when(repository).recordHit(1L);
        service.recordHit(1L); // must not throw
    }

}
