package com.kccitm.api.service.counselling;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * assign / confirm / decline on a session that has already been held. Each would un-complete
 * it (decline even clears the counsellor), dropping the student out of every "counselled" count
 * — so a COMPLETED session is refused, and an offline record is refused in any state (only an
 * admin revert may undo one). A booking still being arranged moves as before.
 */
class AppointmentServiceHeldSessionTest {

    private static final Long APPT = 42L;

    private CounsellingAppointmentRepository appointmentRepository;
    private CounsellingSlotRepository slotRepository;
    private CounsellorRepository counsellorRepository;
    private AuditLogService auditLogService;
    private AppointmentService service;

    @BeforeEach
    void setUp() {
        appointmentRepository = mock(CounsellingAppointmentRepository.class);
        slotRepository = mock(CounsellingSlotRepository.class);
        counsellorRepository = mock(CounsellorRepository.class);
        auditLogService = mock(AuditLogService.class);
        service = new AppointmentService();
        ReflectionTestUtils.setField(service, "appointmentRepository", appointmentRepository);
        ReflectionTestUtils.setField(service, "slotRepository", slotRepository);
        ReflectionTestUtils.setField(service, "counsellorRepository", counsellorRepository);
        ReflectionTestUtils.setField(service, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(service, "notificationService", mock(CounsellingNotificationService.class));
        ReflectionTestUtils.setField(service, "meetingLinkService", mock(MeetingLinkService.class));
        when(appointmentRepository.save(any(CounsellingAppointment.class))).thenAnswer(i -> i.getArgument(0));
    }

    private CounsellingAppointment appointment(String status, String origin) {
        CounsellingSlot slot = new CounsellingSlot();
        slot.setStatus(status);
        CounsellingAppointment a = new CounsellingAppointment();
        a.setStatus(status);
        a.setOrigin(origin);
        a.setSlot(slot);
        a.setCounsellor(new Counsellor());
        when(appointmentRepository.findById(APPT)).thenReturn(Optional.of(a));
        return a;
    }

    private void assertNothingWritten(CounsellingAppointment a, String status) {
        assertEquals(status, a.getStatus());
        assertEquals(status, a.getSlot().getStatus());
        verify(appointmentRepository, never()).save(any(CounsellingAppointment.class));
        verify(slotRepository, never()).save(any(CounsellingSlot.class));
    }

    @Test
    void offlineRecord_cannotBeDeclinedConfirmedOrReassigned() {
        CounsellingAppointment a = appointment("COMPLETED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD);

        assertThrows(BadRequestException.class, () -> service.decline(APPT, new User(), "x"));
        assertThrows(BadRequestException.class, () -> service.confirm(APPT, new User()));
        assertThrows(BadRequestException.class, () -> service.assign(APPT, 9L, new User()));

        assertNothingWritten(a, "COMPLETED");
    }

    @Test
    void revertedOfflineRecord_isStillRefused() {
        CounsellingAppointment a = appointment("CANCELLED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD);

        assertThrows(BadRequestException.class, () -> service.decline(APPT, new User(), null));
        assertThrows(BadRequestException.class, () -> service.confirm(APPT, new User()));

        assertNothingWritten(a, "CANCELLED");
    }

    @Test
    void completedOnlineSession_cannotBeDeclined() {
        CounsellingAppointment a = appointment("COMPLETED", null);

        assertThrows(BadRequestException.class, () -> service.decline(APPT, new User(), null));

        assertNothingWritten(a, "COMPLETED");
    }

    @Test
    void assignedBooking_declinesAsBefore() {
        CounsellingAppointment a = appointment("ASSIGNED", null);

        service.decline(APPT, new User(), "busy");

        assertEquals("PENDING", a.getStatus());
        assertNull(a.getCounsellor());
        assertEquals("REQUESTED", a.getSlot().getStatus());
    }
}
