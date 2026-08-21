package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.AvailabilityTemplateRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers {@link AvailabilityTemplateService}.
 *
 * <p>The appointment case is the one that used to 500 the whole request: a reschedule leaves
 * an appointment row pointing at a slot that has gone back to AVAILABLE, and the FK makes that
 * slot undeletable — so removing the weekly schedule it came from failed outright, and the
 * counsellor could not clear a schedule that no longer produced anything.
 */
class AvailabilityTemplateServiceTest {

    private AvailabilityTemplateRepository templateRepository;
    private CounsellingSlotRepository slotRepository;
    private CounsellingAppointmentRepository appointmentRepository;
    private AvailabilityTemplateService service;

    @BeforeEach
    void setUp() {
        templateRepository = mock(AvailabilityTemplateRepository.class);
        slotRepository = mock(CounsellingSlotRepository.class);
        appointmentRepository = mock(CounsellingAppointmentRepository.class);
        service = new AvailabilityTemplateService();
        ReflectionTestUtils.setField(service, "templateRepository", templateRepository);
        ReflectionTestUtils.setField(service, "slotRepository", slotRepository);
        ReflectionTestUtils.setField(service, "appointmentRepository", appointmentRepository);
    }

    private CounsellingSlot slot(long id, String status, boolean blocked) {
        CounsellingSlot s = new CounsellingSlot();
        s.setId(id);
        s.setStatus(status);
        s.setIsBlocked(blocked);
        s.setTemplate(new AvailabilityTemplate());
        return s;
    }

    @Test
    @DisplayName("Free slots go, claimed ones are detached and kept")
    void deleteTemplateDeletesOnlyFreeSlots() {
        CounsellingSlot free = slot(1L, "AVAILABLE", false);
        CounsellingSlot booked = slot(2L, "BOOKED", false);
        CounsellingSlot blocked = slot(3L, "CANCELLED", true);
        when(slotRepository.findByTemplateId(7L)).thenReturn(new ArrayList<>(Arrays.asList(free, booked, blocked)));
        when(appointmentRepository.existsBySlot_Id(anyLong())).thenReturn(false);

        AvailabilityTemplateService.DeletionResult result = service.deleteTemplate(7L);

        assertEquals(1, result.slotsDeleted);
        assertEquals(2, result.slotsKept);
        verify(slotRepository).delete(free);
        verify(slotRepository, never()).delete(booked);
        // Kept slots must lose the template ref, or the template row cannot be deleted.
        assertNull(booked.getTemplate());
        assertNull(blocked.getTemplate());
        verify(templateRepository).deleteById(7L);
    }

    @Test
    @DisplayName("An AVAILABLE slot an appointment still points at is kept, not deleted")
    void deleteTemplateSparesSlotsWithAppointments() {
        CounsellingSlot free = slot(1L, "AVAILABLE", false);
        CounsellingSlot rescheduled = slot(2L, "AVAILABLE", false);
        when(slotRepository.findByTemplateId(7L)).thenReturn(new ArrayList<>(Arrays.asList(free, rescheduled)));
        when(appointmentRepository.existsBySlot_Id(1L)).thenReturn(false);
        when(appointmentRepository.existsBySlot_Id(2L)).thenReturn(true);

        AvailabilityTemplateService.DeletionResult result = service.deleteTemplate(7L);

        assertEquals(1, result.slotsDeleted);
        assertEquals(1, result.slotsKept);
        verify(slotRepository).delete(free);
        verify(slotRepository, never()).delete(rescheduled);
        assertNull(rescheduled.getTemplate());
        verify(templateRepository).deleteById(7L);
    }

    @Test
    @DisplayName("Removing the last live slot removes the schedule with it")
    void exhaustedTemplateIsRemoved() {
        when(slotRepository.countActiveFutureByTemplate(eq(7L), any(LocalDate.class))).thenReturn(0L);
        when(templateRepository.existsById(7L)).thenReturn(true);
        when(slotRepository.findByTemplateId(7L)).thenReturn(new ArrayList<>());

        assertTrue(service.deleteTemplateIfExhausted(7L));
        verify(templateRepository).deleteById(7L);
    }

    @Test
    @DisplayName("A schedule with slots still ahead of it is left alone")
    void templateWithRemainingSlotsSurvives() {
        when(slotRepository.countActiveFutureByTemplate(eq(7L), any(LocalDate.class))).thenReturn(4L);

        assertFalse(service.deleteTemplateIfExhausted(7L));
        verify(templateRepository, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("A manually added slot has no schedule to clean up")
    void nullTemplateIdIsANoOp() {
        assertFalse(service.deleteTemplateIfExhausted(null));
        verify(slotRepository, never()).countActiveFutureByTemplate(anyLong(), any(LocalDate.class));
        verify(templateRepository, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("Nothing is done twice when the schedule has already gone")
    void alreadyDeletedTemplateIsANoOp() {
        when(slotRepository.countActiveFutureByTemplate(eq(7L), any(LocalDate.class))).thenReturn(0L);
        when(templateRepository.existsById(7L)).thenReturn(false);

        assertFalse(service.deleteTemplateIfExhausted(7L));
        verify(templateRepository, never()).deleteById(anyLong());
        verify(slotRepository, times(0)).findByTemplateId(anyLong());
    }

}
