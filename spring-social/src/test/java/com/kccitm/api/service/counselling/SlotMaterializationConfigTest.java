package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.SlotConfiguration;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Covers {@link SlotMaterializationService#materializeForConfiguration}, which took over slot
 * generation from {@code SlotConfigurationController.generateSlotsForDay} so the config path and
 * the availability-template path build slots through one implementation.
 *
 * <p>The window/break cases pin the behaviour that must not have changed in the move. The overlap
 * case pins the one thing that deliberately did: the old controller only skipped a slot whose
 * start AND end matched an existing row exactly, so applying a config over a differently-sized
 * existing schedule produced overlapping inventory a counsellor could be double-booked into.
 */
class SlotMaterializationConfigTest {

    private CounsellingSlotRepository slotRepository;
    private SlotMaterializationService service;
    private List<CounsellingSlot> existing;

    @BeforeEach
    void setUp() {
        slotRepository = mock(CounsellingSlotRepository.class);
        service = new SlotMaterializationService();
        ReflectionTestUtils.setField(service, "slotRepository", slotRepository);

        existing = new ArrayList<>();
        when(slotRepository.findByCounsellorIdAndDateBetween(anyLong(), any(), any()))
                .thenReturn(existing);
        when(slotRepository.save(any(CounsellingSlot.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private static Counsellor counsellor() {
        Counsellor c = new Counsellor();
        c.setId(7L);
        return c;
    }

    /** 09:00-12:00 on a single day, 60-minute slots, no break. */
    private static SlotConfiguration config(LocalDate from, LocalDate to) {
        SlotConfiguration c = new SlotConfiguration();
        c.setId(1L);
        c.setName("test");
        c.setStartDate(from);
        c.setEndDate(to);
        c.setStartTime(LocalTime.of(9, 0));
        c.setEndTime(LocalTime.of(12, 0));
        c.setSlotDuration(60);
        c.setHasBreak(false);
        return c;
    }

    /** The slots the service actually asked the repository to persist, in order. */
    private List<String> persisted() {
        org.mockito.ArgumentCaptor<CounsellingSlot> captor =
                org.mockito.ArgumentCaptor.forClass(CounsellingSlot.class);
        org.mockito.Mockito.verify(slotRepository, org.mockito.Mockito.atLeast(0)).save(captor.capture());
        return captor.getAllValues().stream()
                .map(s -> s.getDate() + " " + s.getStartTime() + "-" + s.getEndTime())
                .collect(Collectors.toList());
    }

    @Test
    @DisplayName("fills the config window with back-to-back slots")
    void fillsTheWindow() {
        LocalDate day = LocalDate.of(2026, 9, 1);

        SlotMaterializationService.MaterializationResult result =
                service.materializeForConfiguration(counsellor(), config(day, day));

        assertEquals(3, result.created);
        assertEquals(0, result.skipped);
        assertEquals(List.of(
                "2026-09-01 09:00-10:00",
                "2026-09-01 10:00-11:00",
                "2026-09-01 11:00-12:00"), persisted());
    }

    @Test
    @DisplayName("generates for every date in the range, not just the first")
    void coversTheWholeRange() {
        LocalDate from = LocalDate.of(2026, 9, 1);

        SlotMaterializationService.MaterializationResult result =
                service.materializeForConfiguration(counsellor(), config(from, from.plusDays(2)));

        assertEquals(9, result.created);
        assertEquals(3, persisted().stream().filter(s -> s.startsWith("2026-09-03")).count());
    }

    @Test
    @DisplayName("jumps the break instead of generating a slot inside or across it")
    void skipsTheBreak() {
        LocalDate day = LocalDate.of(2026, 9, 1);
        SlotConfiguration c = config(day, day);
        c.setHasBreak(true);
        c.setBreakStart(LocalTime.of(10, 0));
        c.setBreakEnd(LocalTime.of(11, 0));

        SlotMaterializationService.MaterializationResult result =
                service.materializeForConfiguration(counsellor(), c);

        assertEquals(2, result.created);
        assertEquals(List.of(
                "2026-09-01 09:00-10:00",
                "2026-09-01 11:00-12:00"), persisted());
    }

    @Test
    @DisplayName("skips a slot that would overlap one the counsellor already has")
    void skipsOverlappingSlots() {
        LocalDate day = LocalDate.of(2026, 9, 1);

        // A 09:30-10:30 booking straddles both the 09:00 and the 10:00 slot. Neither matches it
        // exactly, so the old exact-match check created both and double-booked the counsellor.
        CounsellingSlot booked = new CounsellingSlot();
        booked.setDate(day);
        booked.setStartTime(LocalTime.of(9, 30));
        booked.setEndTime(LocalTime.of(10, 30));
        booked.setStatus("BOOKED");
        booked.setIsBlocked(false);
        existing.add(booked);

        SlotMaterializationService.MaterializationResult result =
                service.materializeForConfiguration(counsellor(), config(day, day));

        assertEquals(1, result.created);
        assertEquals(2, result.skipped);
        assertEquals(List.of("2026-09-01 11:00-12:00"), persisted());
    }

    @Test
    @DisplayName("a cancelled slot does not reserve its time")
    void cancelledSlotsDoNotBlock() {
        LocalDate day = LocalDate.of(2026, 9, 1);

        CounsellingSlot cancelled = new CounsellingSlot();
        cancelled.setDate(day);
        cancelled.setStartTime(LocalTime.of(9, 0));
        cancelled.setEndTime(LocalTime.of(10, 0));
        cancelled.setStatus("CANCELLED");
        existing.add(cancelled);

        assertEquals(3, service.materializeForConfiguration(counsellor(), config(day, day)).created);
    }

    @Test
    @DisplayName("config slots stay untemplated and keep the entity's default mode, as before")
    void configSlotsAreUntemplated() {
        LocalDate day = LocalDate.of(2026, 9, 1);
        org.mockito.ArgumentCaptor<CounsellingSlot> captor =
                org.mockito.ArgumentCaptor.forClass(CounsellingSlot.class);

        service.materializeForConfiguration(counsellor(), config(day, day));

        org.mockito.Mockito.verify(slotRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        CounsellingSlot first = captor.getAllValues().get(0);
        assertNull(first.getTemplate());
        // A SlotConfiguration has no mode column, so neither the old controller loop nor this
        // service sets one — the slot keeps CounsellingSlot's own "ONLINE" field default.
        assertEquals("ONLINE", first.getMode());
        assertEquals("AVAILABLE", first.getStatus());
        assertEquals(Boolean.FALSE, first.getIsManuallyCreated());
        assertEquals(60, first.getDurationMinutes());
    }

    @Test
    @DisplayName("a break that ends before it starts terminates instead of spinning forever")
    void malformedBreakTerminates() {
        LocalDate day = LocalDate.of(2026, 9, 1);
        SlotConfiguration c = config(day, day);
        c.setHasBreak(true);
        c.setBreakStart(LocalTime.of(11, 0));
        c.setBreakEnd(LocalTime.of(10, 0)); // ends before it begins

        assertTimeoutPreemptively(java.time.Duration.ofSeconds(5),
                () -> service.materializeForConfiguration(counsellor(), c));
    }
}
