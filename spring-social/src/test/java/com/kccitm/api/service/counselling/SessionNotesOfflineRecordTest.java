package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.SessionNotes;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.SessionNotesRepository;
import com.kccitm.api.security.UserPrincipal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link SessionNotesService#create} on a session recorded from the offline page: the check-in
 * and slot-end gates cannot apply to it, so the caller is checked instead (the record's own
 * counsellor by principal, or an admin), a reverted record is refused, and the student is not
 * mailed a second time. Online sessions keep both gates.
 */
class SessionNotesOfflineRecordTest {

    private static final Long APPT = 77L;
    private static final Long OWNER_USER = 500L;
    private static final Long OTHER_USER = 501L;

    private SessionNotesRepository notesRepository;
    private CounsellingAppointmentRepository appointmentRepository;
    private CounsellingNotificationService notificationService;
    private AuditLogService auditLogService;
    private SessionNotesService service;

    @BeforeEach
    void setUp() {
        notesRepository = mock(SessionNotesRepository.class);
        appointmentRepository = mock(CounsellingAppointmentRepository.class);
        notificationService = mock(CounsellingNotificationService.class);
        auditLogService = mock(AuditLogService.class);
        service = new SessionNotesService();
        ReflectionTestUtils.setField(service, "clock", new CounsellingClock("Asia/Kolkata"));
        ReflectionTestUtils.setField(service, "sessionNotesRepository", notesRepository);
        ReflectionTestUtils.setField(service, "counsellingAppointmentRepository", appointmentRepository);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "auditLogService", auditLogService);
        when(notesRepository.save(any(SessionNotes.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        return u;
    }

    private static UserPrincipal principal(Long userId, String... permissions) {
        UserPrincipal p = new UserPrincipal(userId, "u" + userId + "@x.test", null, null, Collections.emptyList());
        p.setPermissions(new HashSet<>(Arrays.asList(permissions)));
        return p;
    }

    /** Never checked in and no slot at all: both online gates would refuse it. */
    private CounsellingAppointment offlineRecord(String status) {
        Counsellor c = new Counsellor();
        c.setId(10L);
        c.setUser(user(OWNER_USER));
        UserStudent s = new UserStudent();
        s.setUserStudentId(1L);
        s.setUserId(900L);
        CounsellingAppointment a = new CounsellingAppointment();
        a.setId(APPT);
        a.setCounsellor(c);
        a.setStudent(s);
        a.setStatus(status);
        a.setOrigin(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        when(appointmentRepository.findById(APPT)).thenReturn(Optional.of(a));
        return a;
    }

    private void verifyNotSaved() {
        verify(notesRepository, never()).save(any());
        verify(notificationService, never()).sendSessionCompleteEmail(any());
    }

    @Test
    void ownCounsellorWritesNotesWithoutGatesAndWithoutMailingAgain() {
        offlineRecord("COMPLETED");
        User owner = user(OWNER_USER);

        SessionNotes saved = service.create(APPT, new SessionNotes(), owner, principal(OWNER_USER));

        assertEquals(APPT, saved.getAppointment().getId());
        verify(notificationService, never()).sendSessionCompleteEmail(any());
        verify(notificationService, never()).createInAppNotification(any(), anyString(), anyString(), anyString(),
                anyLong(), anyString());
        verify(auditLogService).log(any(), eq("SESSION_NOTES_CREATED"), eq(owner), anyString(), any(), any());
    }

    @Test
    void anotherCounsellorIsRefused() {
        offlineRecord("COMPLETED");
        assertThrows(AccessDeniedException.class,
                () -> service.create(APPT, new SessionNotes(), user(OTHER_USER), principal(OTHER_USER)));
        verifyNotSaved();
    }

    @Test
    void userIdParameterNamingTheOwnerDoesNotStandInForThePrincipal() {
        offlineRecord("COMPLETED");
        // ?userId= says "the owner", but the signed-in principal is someone else.
        assertThrows(AccessDeniedException.class,
                () -> service.create(APPT, new SessionNotes(), user(OWNER_USER), principal(OTHER_USER)));
        verifyNotSaved();
    }

    @Test
    void missingPrincipalIsRefused() {
        offlineRecord("COMPLETED");
        assertThrows(AccessDeniedException.class,
                () -> service.create(APPT, new SessionNotes(), user(OWNER_USER), null));
        verifyNotSaved();
    }

    @Test
    void adminMayWriteAndIsAuditedAsThemselvesNotTheClaimedUser() {
        offlineRecord("COMPLETED");
        UserPrincipal admin = principal(700L, SessionNotesService.PERM_OFFLINE_RECORD_ADMIN);

        service.create(APPT, new SessionNotes(), user(OWNER_USER), admin);

        ArgumentCaptor<User> author = ArgumentCaptor.forClass(User.class);
        verify(auditLogService).log(any(), eq("SESSION_NOTES_CREATED"), author.capture(), anyString(), any(), any());
        assertEquals(700L, author.getValue().getId());
        verify(notificationService, never()).sendSessionCompleteEmail(any());
    }

    @Test
    void counsellorHeldPermissionsAreNotAdminEnough() {
        offlineRecord("COMPLETED");
        UserPrincipal counsellor = principal(OTHER_USER, "counselling.session_notes.create",
                "counselling.appointment.update", "counsellor.update");
        assertThrows(AccessDeniedException.class,
                () -> service.create(APPT, new SessionNotes(), user(OTHER_USER), counsellor));
        verifyNotSaved();
    }

    @Test
    void revertedRecordTakesNoNotes() {
        offlineRecord("CANCELLED");
        assertThrows(BadRequestException.class,
                () -> service.create(APPT, new SessionNotes(), user(OWNER_USER), principal(OWNER_USER)));
        verifyNotSaved();
    }

    @Test
    void onlineSessionStillNeedsCheckIn() {
        CounsellingAppointment a = offlineRecord("COMPLETED");
        a.setOrigin(null);
        // The owner asking makes no difference: the gates, not the caller, decide online sessions.
        assertThrows(BadRequestException.class,
                () -> service.create(APPT, new SessionNotes(), user(OWNER_USER), principal(OWNER_USER)));
        verifyNotSaved();
    }

    @Test
    void onlineSessionPastBothGatesStillMailsTheStudent() {
        CounsellingAppointment a = offlineRecord("COMPLETED");
        a.setOrigin(null);
        a.setCheckinVerifiedAt(LocalDateTime.now().minusDays(1));
        CounsellingSlot slot = new CounsellingSlot();
        slot.setDate(java.time.LocalDate.now().minusDays(1));
        slot.setStartTime(java.time.LocalTime.of(10, 0));
        slot.setEndTime(java.time.LocalTime.of(11, 0));
        a.setSlot(slot);
        User claimed = user(OWNER_USER);

        service.create(APPT, new SessionNotes(), claimed, null);

        verify(notificationService).sendSessionCompleteEmail(a);
        ArgumentCaptor<User> author = ArgumentCaptor.forClass(User.class);
        verify(auditLogService).log(any(), eq("SESSION_NOTES_CREATED"), author.capture(), anyString(), any(), any());
        assertSame(claimed, author.getValue());
    }
}
