package com.kccitm.api.service.counselling;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingOtpGuard;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingOtpGuardRepository;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers {@link OtpGuardService}: the offline "Mark done" OTP check whose wrong-guess counter
 * has to survive the request failing (the bug that made the online check-in cap a no-op).
 *
 * <p>The repository is mocked around one in-memory guard row, so "the counter persists" is
 * asserted as: the row was changed and saved, and the call returned instead of throwing.
 */
class OtpGuardServiceTest {

    private static final Long STUDENT = 42L;
    private static final Long COUNSELLOR = 7L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 28, 11, 0);

    private CounsellingOtpGuardRepository guardRepository;
    private UserStudentRepository userStudentRepository;
    private CounsellingClock clock;
    private OtpGuardService service;
    private CounsellingOtpGuard guard;
    private Date dob;
    private String rightCode;

    @BeforeEach
    void setUp() {
        guardRepository = mock(CounsellingOtpGuardRepository.class);
        userStudentRepository = mock(UserStudentRepository.class);
        clock = mock(CounsellingClock.class);
        when(clock.now()).thenReturn(NOW);

        service = new OtpGuardService();
        ReflectionTestUtils.setField(service, "guardRepository", guardRepository);
        ReflectionTestUtils.setField(service, "userStudentRepository", userStudentRepository);
        ReflectionTestUtils.setField(service, "clock", clock);
        ReflectionTestUtils.setField(service, "maxAttempts", 3);

        dob = new GregorianCalendar(2010, 4, 17).getTime();
        rightCode = CounsellingOtpService.counsellingOtpFor(dob);
        studentWithDob(dob);

        guard = new CounsellingOtpGuard(STUDENT);
        when(guardRepository.lockByStudentId(STUDENT)).thenAnswer(inv -> Optional.of(guard));
        when(guardRepository.save(any(CounsellingOtpGuard.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private void studentWithDob(Date d) {
        StudentInfo info = new StudentInfo();
        info.setStudentDob(d);
        UserStudent us = new UserStudent();
        us.setUserStudentId(STUDENT);
        us.setStudentInfo(info);
        when(userStudentRepository.findById(STUDENT)).thenReturn(Optional.of(us));
    }

    private String wrongCode() {
        return "0000".equals(rightCode) ? "1234" : "0000";
    }

    @Test
    @DisplayName("Right code: VERIFIED, and the row was locked before comparing")
    void verified() {
        OtpGuardService.Result r = service.check(STUDENT, rightCode, COUNSELLOR);

        assertEquals(OtpGuardService.Status.VERIFIED, r.getStatus());
        assertEquals(0, guard.getTotalFailures());
        verify(guardRepository).ensureRow(STUDENT, NOW);
        verify(guardRepository).lockByStudentId(STUDENT);
    }

    @Test
    @DisplayName("Wrong code: WRONG with attempts left, the counter is saved, nothing is thrown")
    void wrongIsCountedNotThrown() {
        OtpGuardService.Result r = assertDoesNotThrow(() -> service.check(STUDENT, wrongCode(), COUNSELLOR));

        assertEquals(OtpGuardService.Status.WRONG, r.getStatus());
        assertEquals(Integer.valueOf(2), r.getAttemptsLeft());
        assertEquals(1, guard.getFailedAttempts());
        assertEquals(1, guard.getTotalFailures());
        assertEquals(NOW, guard.getWindowStartedAt());
        assertEquals(COUNSELLOR, guard.getLastFailedByCounsellorId());
        verify(guardRepository).save(guard);
    }

    @Test
    @DisplayName("Third wrong code in the window locks for 15 minutes; even the right code is then refused")
    void lockedAfterThree() {
        service.check(STUDENT, wrongCode(), COUNSELLOR);
        service.check(STUDENT, wrongCode(), COUNSELLOR);
        OtpGuardService.Result third = service.check(STUDENT, wrongCode(), COUNSELLOR);

        assertEquals(OtpGuardService.Status.LOCKED, third.getStatus());
        assertEquals(NOW.plusMinutes(OtpGuardService.LOCK_MINUTES), third.getLockedUntil());
        assertTrue(!third.isPermanent());

        OtpGuardService.Result during = service.check(STUDENT, rightCode, COUNSELLOR);
        assertEquals(OtpGuardService.Status.LOCKED, during.getStatus());
        assertEquals(3, guard.getTotalFailures());
    }

    @Test
    @DisplayName("Once the lock has lifted the code can be checked again")
    void lockLifts() {
        guard.setLockedUntil(NOW.minusMinutes(1));
        guard.setTotalFailures(3);

        assertEquals(OtpGuardService.Status.VERIFIED, service.check(STUDENT, rightCode, COUNSELLOR).getStatus());
    }

    @Test
    @DisplayName("The tenth wrong code in total locks the code for good")
    void permanentLockAfterTen() {
        guard.setTotalFailures(OtpGuardService.PERMANENT_LOCK_AFTER - 1);

        OtpGuardService.Result tenth = service.check(STUDENT, wrongCode(), COUNSELLOR);
        assertEquals(OtpGuardService.Status.LOCKED, tenth.getStatus());
        assertTrue(tenth.isPermanent());
        assertNull(tenth.getLockedUntil());

        // Hours later, with the right code: still locked.
        when(clock.now()).thenReturn(NOW.plusDays(2));
        OtpGuardService.Result later = service.check(STUDENT, rightCode, COUNSELLOR);
        assertEquals(OtpGuardService.Status.LOCKED, later.getStatus());
        assertTrue(later.isPermanent());
    }

    @Test
    @DisplayName("No DOB: NO_DOB, never VERIFIED — the 1111 fallback proves nothing — and no counting")
    void noDobNeverVerifies() {
        studentWithDob(null);

        OtpGuardService.Result r = service.check(STUDENT, CounsellingOtpService.DEFAULT_OTP, COUNSELLOR);

        assertEquals(OtpGuardService.Status.NO_DOB, r.getStatus());
        verify(guardRepository, never()).ensureRow(anyLong(), any());
        verify(guardRepository, never()).save(any());
    }

    @Test
    @DisplayName("A wrong code after the 15-minute window lapsed starts a new window")
    void windowResets() {
        guard.setFailedAttempts(2);
        guard.setTotalFailures(2);
        guard.setWindowStartedAt(NOW.minusMinutes(OtpGuardService.WINDOW_MINUTES + 1));

        OtpGuardService.Result r = service.check(STUDENT, wrongCode(), COUNSELLOR);

        assertEquals(OtpGuardService.Status.WRONG, r.getStatus());
        assertEquals(1, guard.getFailedAttempts());
        assertEquals(3, guard.getTotalFailures());
        assertEquals(NOW, guard.getWindowStartedAt());
        assertNull(guard.getLockedUntil());
    }

    @Test
    @DisplayName("Attempts left never exceed what is left before the permanent lock")
    void attemptsLeftCappedByTotal() {
        guard.setTotalFailures(OtpGuardService.PERMANENT_LOCK_AFTER - 2);

        OtpGuardService.Result r = service.check(STUDENT, wrongCode(), COUNSELLOR);

        assertEquals(OtpGuardService.Status.WRONG, r.getStatus());
        assertEquals(Integer.valueOf(1), r.getAttemptsLeft());
    }

    @Test
    @DisplayName("check() runs in its own transaction, so the counter commits whatever the caller does")
    void requiresNewTransaction() throws Exception {
        Method m = OtpGuardService.class.getMethod("check", Long.class, String.class, Long.class);
        Transactional tx = m.getAnnotation(Transactional.class);
        assertNotNull(tx);
        assertEquals(Propagation.REQUIRES_NEW, tx.propagation());
    }
}
