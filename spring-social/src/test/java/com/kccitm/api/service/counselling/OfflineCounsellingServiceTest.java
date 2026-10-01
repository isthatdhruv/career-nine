package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.StudentCounsellorMappingRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.AuthAuditService;
import com.kccitm.api.service.b2c.EntitlementService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Covers {@link OfflineCounsellingService}: who may use the offline page, "Map to me", "Mark
 * done" and the admin revert/flag — plus the pieces of {@link AppointmentService} and the entity
 * JSON the offline flow leans on.
 *
 * <p>Every gate here is enforced in code because {@code @PreAuthorize} is log-only, so each one
 * gets a test. The native reads live in {@link OfflineCounsellingQueries}, mocked.
 */
class OfflineCounsellingServiceTest {

    private static final Long ME_USER = 500L;
    private static final Long ME = 10L;
    private static final Long OTHER = 11L;
    private static final Integer MY_SCHOOL = 101;
    private static final Integer OTHER_SCHOOL = 202;
    private static final Long STUDENT = 1L;
    private static final Long ASSESSMENT = 9L;

    private CounsellorRepository counsellorRepository;
    private OfflineCounsellingQueries queries;
    private StudentCounsellorMappingRepository mappingRepository;
    private StudentCounsellorMappingService mappingService;
    private CounsellingAppointmentRepository appointmentRepository;
    private CounsellingSlotRepository slotRepository;
    private AppointmentService appointmentService;
    private StudentEntitlementRepository entitlementRepository;
    private UserStudentRepository userStudentRepository;
    private UserRepository userRepository;
    private AuditLogService auditLogService;
    private CounsellingActivityLogService activityLogService;
    private CounsellingNotificationService notificationService;
    private AuthAuditService authAuditService;
    private CounsellingClock clock;
    private OfflineCounsellingService service;

    private Counsellor me;
    private Counsellor other;
    private final Map<Long, Integer> instituteOf = new HashMap<>();
    private LocalDate today;

    @BeforeEach
    void setUp() {
        counsellorRepository = mock(CounsellorRepository.class);
        queries = mock(OfflineCounsellingQueries.class);
        mappingRepository = mock(StudentCounsellorMappingRepository.class);
        mappingService = mock(StudentCounsellorMappingService.class);
        appointmentRepository = mock(CounsellingAppointmentRepository.class);
        slotRepository = mock(CounsellingSlotRepository.class);
        appointmentService = mock(AppointmentService.class);
        entitlementRepository = mock(StudentEntitlementRepository.class);
        userStudentRepository = mock(UserStudentRepository.class);
        userRepository = mock(UserRepository.class);
        auditLogService = mock(AuditLogService.class);
        activityLogService = mock(CounsellingActivityLogService.class);
        notificationService = mock(CounsellingNotificationService.class);
        authAuditService = mock(AuthAuditService.class);
        clock = new CounsellingClock("Asia/Kolkata");
        today = clock.today();

        service = new OfflineCounsellingService();
        ReflectionTestUtils.setField(service, "counsellorRepository", counsellorRepository);
        ReflectionTestUtils.setField(service, "queries", queries);
        ReflectionTestUtils.setField(service, "mappingRepository", mappingRepository);
        ReflectionTestUtils.setField(service, "mappingService", mappingService);
        ReflectionTestUtils.setField(service, "appointmentRepository", appointmentRepository);
        ReflectionTestUtils.setField(service, "slotRepository", slotRepository);
        ReflectionTestUtils.setField(service, "appointmentService", appointmentService);
        ReflectionTestUtils.setField(service, "entitlementRepository", entitlementRepository);
        ReflectionTestUtils.setField(service, "userStudentRepository", userStudentRepository);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(service, "activityLogService", activityLogService);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "authAuditService", authAuditService);
        ReflectionTestUtils.setField(service, "clock", clock);

        me = counsellor(ME, "Asha", true, true);
        other = counsellor(OTHER, "Ravi", true, false);
        when(counsellorRepository.findByUserId(ME_USER)).thenReturn(Optional.of(me));
        when(counsellorRepository.findById(OTHER)).thenReturn(Optional.of(other));
        when(queries.activeInstitutes(ME)).thenReturn(Collections.singletonList(school(MY_SCHOOL, "Greenwood")));

        instituteOf.put(STUDENT, MY_SCHOOL);
        instituteOf.put(2L, OTHER_SCHOOL);
        instituteOf.put(3L, null); // B2C: no institute
        instituteOf.put(4L, MY_SCHOOL);
        instituteOf.put(5L, MY_SCHOOL);
        when(queries.institutesOfStudents(any())).thenAnswer(inv -> {
            Map<Long, Integer> out = new HashMap<>();
            for (Object id : (Collection<?>) inv.getArgument(0)) {
                if (instituteOf.containsKey(id)) out.put((Long) id, instituteOf.get(id));
            }
            return out;
        });
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ─── Fixtures ────────────────────────────────────────────────────────────────

    private static Counsellor counsellor(Long id, String name, boolean active, boolean offline) {
        Counsellor c = new Counsellor();
        c.setId(id);
        c.setName(name);
        c.setIsActive(active);
        c.setIsOffline(offline);
        return c;
    }

    private static OfflineCounsellingService.InstituteOption school(Integer code, String name) {
        OfflineCounsellingService.InstituteOption o = new OfflineCounsellingService.InstituteOption();
        o.instituteCode = code;
        o.instituteName = name;
        o.isSchool = true;
        return o;
    }

    private static UserPrincipal principal(Long userId, String... permissions) {
        UserPrincipal p = new UserPrincipal(userId, "u" + userId + "@x.test", null, null, Collections.emptyList());
        p.setPermissions(new HashSet<>(Arrays.asList(permissions)));
        return p;
    }

    private static OfflineCounsellingQueries.MappingState state(Long counsellorId, String name, boolean active) {
        OfflineCounsellingQueries.MappingState s = new OfflineCounsellingQueries.MappingState();
        s.counsellorId = counsellorId;
        s.counsellorName = name;
        s.active = active;
        return s;
    }

    private StudentCounsellorMapping lockedMapping(Counsellor c, boolean active) {
        UserStudent us = student();
        StudentCounsellorMapping m = new StudentCounsellorMapping();
        m.setId(77L);
        m.setStudent(us);
        m.setCounsellor(c);
        m.setIsActive(active);
        return m;
    }

    private UserStudent student() {
        StudentInfo info = new StudentInfo();
        info.setName("Riya Sharma");
        info.setEmail("riya@student.test");
        info.setPhoneNumber("9999999999");
        UserStudent us = new UserStudent();
        us.setUserStudentId(STUDENT);
        us.setUserId(900L);
        us.setStudentInfo(info);
        return us;
    }

    private static OfflineCounsellingQueries.LiveBookingRow live(long id, String status, Long entitlementId) {
        OfflineCounsellingQueries.LiveBookingRow b = new OfflineCounsellingQueries.LiveBookingRow();
        b.studentId = STUDENT;
        b.appointmentId = id;
        b.status = status;
        b.entitlementId = entitlementId;
        b.counsellorId = OTHER;
        b.counsellorName = "Ravi";
        return b;
    }

    /** Everything a successful mark-done needs; individual tests then break one piece. */
    private void givenMarkable() {
        when(mappingRepository.lockByStudent(STUDENT)).thenReturn(Optional.of(lockedMapping(me, true)));
        when(queries.mappingsOf(any())).thenReturn(Collections.singletonMap(STUDENT, state(ME, "Asha", true)));
        when(queries.isAllotted(STUDENT, ASSESSMENT)).thenReturn(true);
        when(appointmentRepository.findLatestCompletedForAssessment(any(), eq(ASSESSMENT)))
                .thenReturn(Collections.<Object[]>emptyList());
        when(queries.liveBookingsForStudent(STUDENT, ASSESSMENT))
                .thenReturn(Collections.<OfflineCounsellingQueries.LiveBookingRow>emptyList());
        when(userStudentRepository.findById(STUDENT)).thenReturn(Optional.of(student()));
        User u = new User();
        u.setId(ME_USER);
        u.setName("Asha");
        when(userRepository.findById(ME_USER)).thenReturn(Optional.of(u));
        when(slotRepository.save(any(CounsellingSlot.class))).thenAnswer(inv -> {
            CounsellingSlot s = inv.getArgument(0);
            s.setId(900L);
            return s;
        });
        when(appointmentRepository.save(any(CounsellingAppointment.class))).thenAnswer(inv -> {
            CounsellingAppointment a = inv.getArgument(0);
            a.setId(700L);
            return a;
        });
        when(appointmentRepository.findByStudentIdOrdered(STUDENT))
                .thenReturn(Collections.<CounsellingAppointment>emptyList());
        StudentEntitlement ent = new StudentEntitlement();
        ent.setEntitlementId(55L);
        ent.setStatus("active");
        when(entitlementRepository.findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(STUDENT, ASSESSMENT))
                .thenReturn(Collections.singletonList(ent));
    }

    private OfflineCounsellingException expectError(HttpStatus status, String code, Runnable call) {
        OfflineCounsellingException e = assertThrows(OfflineCounsellingException.class, call::run);
        assertEquals(status, e.getStatus());
        assertEquals(code, e.getCode());
        return e;
    }

    // ─── Guard ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("A counsellor not flagged offline gets offline:false and every endpoint refuses")
    void nonOfflineCounsellorDenied() {
        when(counsellorRepository.findByUserId(ME_USER)).thenReturn(Optional.of(counsellor(ME, "Asha", true, false)));

        OfflineCounsellingService.OfflineContext ctx = service.context(principal(ME_USER));
        assertFalse(ctx.offline);
        assertTrue(ctx.institutes.isEmpty());

        expectError(HttpStatus.FORBIDDEN, "NOT_OFFLINE_COUNSELLOR",
                () -> service.assessments(principal(ME_USER), MY_SCHOOL));
        expectError(HttpStatus.FORBIDDEN, "NOT_OFFLINE_COUNSELLOR",
                () -> service.mapToMe(principal(ME_USER), Collections.singletonList(STUDENT)));
        verifyNoInteractions(mappingService);
    }

    @Test
    @DisplayName("A user with no counsellor profile (e.g. an admin) gets offline:false, never an error")
    void noProfileDenied() {
        when(counsellorRepository.findByUserId(ME_USER)).thenReturn(Optional.empty());

        assertFalse(service.context(principal(ME_USER)).offline);
        expectError(HttpStatus.FORBIDDEN, "NOT_OFFLINE_COUNSELLOR",
                () -> service.students(principal(ME_USER), MY_SCHOOL, ASSESSMENT));
    }

    @Test
    @DisplayName("A suspended offline counsellor is refused too")
    void inactiveCounsellorDenied() {
        when(counsellorRepository.findByUserId(ME_USER)).thenReturn(Optional.of(counsellor(ME, "Asha", false, true)));

        assertFalse(service.context(principal(ME_USER)).offline);
        expectError(HttpStatus.FORBIDDEN, "NOT_OFFLINE_COUNSELLOR",
                () -> service.preflight(principal(ME_USER), STUDENT, ASSESSMENT, today));
    }

    @Test
    @DisplayName("An active offline counsellor gets their schools")
    void contextForOfflineCounsellor() {
        OfflineCounsellingService.OfflineContext ctx = service.context(principal(ME_USER));

        assertTrue(ctx.offline);
        assertEquals(ME, ctx.counsellorId);
        assertEquals(1, ctx.institutes.size());
        assertEquals(MY_SCHOOL, ctx.institutes.get(0).instituteCode);
    }

    @Test
    @DisplayName("A school that is not mine is refused for the lists")
    void otherSchoolListRefused() {
        expectError(HttpStatus.FORBIDDEN, "FORBIDDEN",
                () -> service.students(principal(ME_USER), OTHER_SCHOOL, ASSESSMENT));
        verify(queries, never()).studentRows(any(), any());
    }

    @Test
    @DisplayName("A student of another school is out of scope, whatever the request says")
    void studentInAnotherSchoolDenied() {
        givenMarkable();
        expectError(HttpStatus.NOT_FOUND, "STUDENT_NOT_IN_SCOPE",
                () -> service.preflight(principal(ME_USER), 2L, ASSESSMENT, today));
        expectError(HttpStatus.NOT_FOUND, "STUDENT_NOT_IN_SCOPE",
                () -> service.markDone(principal(ME_USER), 2L, ASSESSMENT, today, false));

        OfflineCounsellingService.MapToMeResponse res =
                service.mapToMe(principal(ME_USER), Collections.singletonList(2L));
        assertEquals("SKIPPED", res.results.get(0).status);
        assertEquals("NOT_IN_SCOPE", res.results.get(0).reason);
        verifyNoInteractions(mappingService);
    }

    @Test
    @DisplayName("A student with no institute (B2C) is never in scope")
    void nullInstituteStudentDenied() {
        expectError(HttpStatus.NOT_FOUND, "STUDENT_NOT_IN_SCOPE",
                () -> service.preflight(principal(ME_USER), 3L, ASSESSMENT, today));
        OfflineCounsellingService.MapToMeResponse res =
                service.mapToMe(principal(ME_USER), Collections.singletonList(3L));
        assertEquals("SKIPPED", res.results.get(0).status);
        verifyNoInteractions(mappingService);
    }

    // ─── Lists ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Student rows are merged with mapping, done state and live bookings")
    void studentRowsMerged() {
        OfflineCounsellingService.StudentRow mine = new OfflineCounsellingService.StudentRow();
        mine.userStudentId = STUDENT;
        mine.mappedCounsellorId = ME;
        OfflineCounsellingService.StudentRow theirs = new OfflineCounsellingService.StudentRow();
        theirs.userStudentId = 4L;
        theirs.mappedCounsellorId = OTHER;
        when(queries.studentRows(MY_SCHOOL, ASSESSMENT)).thenReturn(Arrays.asList(mine, theirs));
        OfflineCounsellingQueries.DoneInfo d = new OfflineCounsellingQueries.DoneInfo();
        d.studentId = STUDENT;
        d.appointmentId = 700L;
        d.counsellorId = ME;
        d.counsellorName = "Asha";
        d.date = LocalDate.of(2026, 9, 20);
        d.origin = CounsellingAppointment.ORIGIN_OFFLINE_RECORD;
        d.photoCount = 2;
        when(queries.doneForInstitute(MY_SCHOOL, ASSESSMENT)).thenReturn(Collections.singletonMap(STUDENT, d));
        OfflineCounsellingQueries.LiveBookingRow b = live(300L, "CONFIRMED", null);
        b.studentId = 4L;
        b.date = LocalDate.of(2026, 10, 2);
        when(queries.liveBookingsForInstitute(MY_SCHOOL, ASSESSMENT))
                .thenReturn(Collections.singletonMap(4L, Collections.singletonList(b)));

        List<OfflineCounsellingService.StudentRow> rows = service.students(principal(ME_USER), MY_SCHOOL, ASSESSMENT);

        assertTrue(rows.get(0).mappedToMe);
        assertTrue(rows.get(0).done);
        assertTrue(rows.get(0).doneByMe);
        assertTrue(rows.get(0).doneOffline);
        assertEquals("2026-09-20", rows.get(0).doneDate);
        assertEquals(2, rows.get(0).photoCount);
        assertFalse(rows.get(1).mappedToMe);
        assertFalse(rows.get(1).done);
        assertEquals(1, rows.get(1).liveBookings.size());
        assertEquals("2026-10-02", rows.get(1).liveBookings.get(0).date);
    }

    // ─── Map to me ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Takes students over, naming whom each was taken from; mine and unmapped are told apart")
    void takeoverReportsPreviousCounsellor() {
        Map<Long, OfflineCounsellingQueries.MappingState> before = new HashMap<>();
        before.put(STUDENT, state(OTHER, "Ravi", true));
        before.put(4L, state(ME, "Asha", true));
        before.put(5L, state(OTHER, "Ravi", false)); // inactive counts as unmapped
        when(queries.mappingsOf(any())).thenReturn(before);

        OfflineCounsellingService.MapToMeResponse res =
                service.mapToMe(principal(ME_USER), Arrays.asList(STUDENT, 4L, 5L, STUDENT));

        assertEquals(3, res.results.size()); // duplicate id collapsed
        assertEquals("TAKEN_OVER", res.results.get(0).status);
        assertEquals("Ravi", res.results.get(0).previousCounsellorName);
        assertEquals("ALREADY_MINE", res.results.get(1).status);
        assertEquals("MAPPED", res.results.get(2).status);
        assertEquals(1, res.takenOverCount);
        assertEquals(1, res.alreadyMineCount);
        assertEquals(1, res.mappedCount);
        verify(mappingService).upsertActiveMapping(STUDENT, ME, ME_USER);
        verify(mappingService).upsertActiveMapping(5L, ME, ME_USER);
        verify(mappingService, never()).upsertActiveMapping(eq(4L), anyLong(), anyLong());
        // The audit line and the losing counsellor's feed both name what happened.
        ArgumentCaptor<String> reason = ArgumentCaptor.forClass(String.class);
        verify(authAuditService).recordSensitiveOp(eq(ME_USER), eq("counselling.appointment.update"),
                eq("ALLOW"), reason.capture(), any());
        assertTrue(reason.getValue().contains("Ravi"));
        verify(activityLogService).log(eq("STUDENTS_TAKEN_OVER"), anyString(), anyString(), eq(other), eq("Asha"));
    }

    @Test
    @DisplayName("More than 500 students in one request is refused before anything is written")
    void batchCap() {
        List<Long> ids = new ArrayList<>();
        for (long i = 1; i <= OfflineCounsellingService.MAX_MAP_BATCH + 1; i++) ids.add(i);

        expectError(HttpStatus.BAD_REQUEST, "TOO_MANY", () -> service.mapToMe(principal(ME_USER), ids));
        verifyNoInteractions(mappingService);
    }

    @Test
    @DisplayName("One student failing to map does not stop the others")
    void oneFailureDoesNotSinkTheBatch() {
        when(queries.mappingsOf(any())).thenReturn(Collections.<Long, OfflineCounsellingQueries.MappingState>emptyMap());
        org.mockito.Mockito.doThrow(new RuntimeException("boom"))
                .when(mappingService).upsertActiveMapping(eq(4L), anyLong(), anyLong());

        OfflineCounsellingService.MapToMeResponse res =
                service.mapToMe(principal(ME_USER), Arrays.asList(STUDENT, 4L, 5L));

        assertEquals("MAPPED", res.results.get(0).status);
        assertEquals("SKIPPED", res.results.get(1).status);
        assertEquals("MAPPED", res.results.get(2).status);
        assertEquals(2, res.mappedCount);
        assertEquals(1, res.skippedCount);
    }

    // ─── Mark done ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Not mapped to me (someone else's student) -> 409 NOT_MAPPED, nothing written")
    void notMapped() {
        givenMarkable();
        when(mappingRepository.lockByStudent(STUDENT)).thenReturn(Optional.of(lockedMapping(other, true)));
        when(queries.mappingsOf(any())).thenReturn(Collections.singletonMap(STUDENT, state(OTHER, "Ravi", true)));

        expectError(HttpStatus.CONFLICT, "NOT_MAPPED",
                () -> service.preflight(principal(ME_USER), STUDENT, ASSESSMENT, today));
        expectError(HttpStatus.CONFLICT, "NOT_MAPPED",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false));
        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("An inactive mapping row counts as unmapped")
    void inactiveMappingIsNotMine() {
        givenMarkable();
        when(mappingRepository.lockByStudent(STUDENT)).thenReturn(Optional.of(lockedMapping(me, false)));

        expectError(HttpStatus.CONFLICT, "NOT_MAPPED",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false));
    }

    @Test
    @DisplayName("Not allotted the assessment -> 400 NOT_ALLOTTED")
    void notAllotted() {
        givenMarkable();
        when(queries.isAllotted(STUDENT, ASSESSMENT)).thenReturn(false);

        expectError(HttpStatus.BAD_REQUEST, "NOT_ALLOTTED",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false));
        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("Already done by me -> 409 carrying the record, so a retried request lands as success")
    void alreadyDoneByMe() {
        givenMarkable();
        when(appointmentRepository.findLatestCompletedForAssessment(any(), eq(ASSESSMENT)))
                .thenReturn(Collections.singletonList(new Object[] {STUDENT, java.math.BigInteger.valueOf(700L)}));
        OfflineCounsellingQueries.DoneInfo d = new OfflineCounsellingQueries.DoneInfo();
        d.appointmentId = 700L;
        d.counsellorId = ME;
        d.otpVerified = true;
        when(queries.doneInfo(700L)).thenReturn(d);

        OfflineCounsellingException e = expectError(HttpStatus.CONFLICT, "ALREADY_DONE_BY_ME",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false));
        assertEquals(700L, e.getExtras().get("appointmentId"));
        assertEquals(true, e.getExtras().get("otpVerified"));
        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("Already done by someone else -> 409 with their name and date")
    void alreadyDoneBySomeoneElse() {
        givenMarkable();
        when(appointmentRepository.findLatestCompletedForAssessment(any(), eq(ASSESSMENT)))
                .thenReturn(Collections.singletonList(new Object[] {STUDENT, 701L}));
        OfflineCounsellingQueries.DoneInfo d = new OfflineCounsellingQueries.DoneInfo();
        d.appointmentId = 701L;
        d.counsellorId = OTHER;
        d.counsellorName = "Ravi";
        d.date = LocalDate.of(2026, 9, 1);
        when(queries.doneInfo(701L)).thenReturn(d);

        OfflineCounsellingException e = expectError(HttpStatus.CONFLICT, "ALREADY_DONE",
                () -> service.preflight(principal(ME_USER), STUDENT, ASSESSMENT, today));
        assertEquals("Ravi", e.getExtras().get("doneByCounsellorName"));
        assertEquals("2026-09-01", e.getExtras().get("doneDate"));
    }

    @Test
    @DisplayName("Session date: today back to 30 days only, never the future")
    void dateBounds() {
        givenMarkable();
        expectError(HttpStatus.BAD_REQUEST, "BAD_DATE",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today.plusDays(1), false));
        expectError(HttpStatus.BAD_REQUEST, "BAD_DATE",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today.minusDays(31), false));
        expectError(HttpStatus.BAD_REQUEST, "BAD_DATE",
                () -> service.preflight(principal(ME_USER), STUDENT, ASSESSMENT, null));
        verify(slotRepository, never()).save(any());

        OfflineCounsellingService.MarkDoneResult r =
                service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today.minusDays(30), false);
        assertEquals(Long.valueOf(700L), r.appointmentId);
    }

    @Test
    @DisplayName("Saves the synthetic slot first, then a COMPLETED offline record on it")
    void slotSavedBeforeAppointment() {
        givenMarkable();
        LocalDate sessionDate = today.minusDays(2);

        OfflineCounsellingService.MarkDoneResult r =
                service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, sessionDate, false);

        InOrder order = inOrder(slotRepository, appointmentRepository);
        ArgumentCaptor<CounsellingSlot> slot = ArgumentCaptor.forClass(CounsellingSlot.class);
        ArgumentCaptor<CounsellingAppointment> appt = ArgumentCaptor.forClass(CounsellingAppointment.class);
        order.verify(slotRepository).save(slot.capture());
        order.verify(appointmentRepository).save(appt.capture());

        CounsellingSlot s = slot.getValue();
        assertSame(me, s.getCounsellor());
        assertEquals(sessionDate, s.getDate());
        assertEquals(java.time.LocalTime.MIDNIGHT, s.getStartTime());
        assertEquals(java.time.LocalTime.MIDNIGHT, s.getEndTime());
        assertEquals(Integer.valueOf(0), s.getDurationMinutes());
        assertEquals("OFFLINE", s.getMode());
        assertEquals("COMPLETED", s.getStatus());
        assertTrue(s.getIsBlocked());
        assertTrue(s.getIsManuallyCreated());
        assertEquals("OFFLINE_RECORD", s.getBlockReason());

        CounsellingAppointment a = appt.getValue();
        assertSame(s, a.getSlot());
        assertSame(me, a.getCounsellor());
        assertEquals("COMPLETED", a.getStatus());
        assertEquals("OFFLINE", a.getMode());
        assertEquals(CounsellingAppointment.ORIGIN_OFFLINE_RECORD, a.getOrigin());
        assertTrue(a.isOfflineRecord());
        assertEquals(ASSESSMENT, a.getAssessmentId());
        assertTrue(a.getAttended());
        assertNotNull(a.getSessionStartedAt());
        assertEquals(Long.valueOf(ME_USER), a.getAssignedBy().getId());
        assertEquals("Greenwood", a.getLocation());
        // Contact snapshot filled at creation, so the async mail never needs the LAZY profile.
        assertEquals("Riya Sharma", a.getStudentContactName());
        assertEquals("riya@student.test", a.getStudentContactEmail());

        assertEquals(Long.valueOf(700L), r.appointmentId);
        assertEquals("NOT_PROVIDED", r.otpResult);
        verify(auditLogService).log(eq(a), eq("OFFLINE_SESSION_RECORDED"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("checkinVerifiedAt is set only when the OTP guard verified the code")
    void checkinOnlyWhenVerified() {
        givenMarkable();
        ArgumentCaptor<CounsellingAppointment> appt = ArgumentCaptor.forClass(CounsellingAppointment.class);

        OfflineCounsellingService.MarkDoneResult unverified =
                service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false);
        OfflineCounsellingService.MarkDoneResult verified =
                service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, true);

        verify(appointmentRepository, org.mockito.Mockito.times(2)).save(appt.capture());
        assertNull(appt.getAllValues().get(0).getCheckinVerifiedAt());
        assertNotNull(appt.getAllValues().get(1).getCheckinVerifiedAt());
        assertFalse(unverified.otpVerified);
        assertEquals("VERIFIED", verified.otpResult);
        assertTrue(verified.otpVerified);
    }

    @Test
    @DisplayName("A live booking for the assessment is cancelled silently and its entitlement preferred")
    void liveBookingCancelledSilently() {
        givenMarkable();
        when(queries.liveBookingsForStudent(STUDENT, ASSESSMENT))
                .thenReturn(Collections.singletonList(live(300L, "CONFIRMED", 66L)));
        CounsellingAppointment cancelled = new CounsellingAppointment();
        cancelled.setId(300L);
        cancelled.setCounsellor(other);
        when(appointmentService.cancelSilently(eq(300L), any(), anyString(), anyString(), anyString()))
                .thenReturn(cancelled);
        ArgumentCaptor<CounsellingAppointment> appt = ArgumentCaptor.forClass(CounsellingAppointment.class);

        OfflineCounsellingService.MarkDoneResult r =
                service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false);

        verify(appointmentService).cancelSilently(eq(300L), any(), eq("SYSTEM"), eq("COUNSELLED_OFFLINE"), anyString());
        verify(appointmentService, never()).cancel(anyLong(), any(), anyString());
        verify(appointmentService, never()).cancel(anyLong(), any(), anyString(), anyString(), anyString());
        assertEquals(Collections.singletonList(300L), r.cancelledBookingIds);
        verify(appointmentRepository).save(appt.capture());
        assertEquals(Long.valueOf(66L), appt.getValue().getEntitlementId());
        // The only mail is the thank-you for the offline session itself.
        verify(notificationService).sendOfflineSessionCompleteEmail(any());
        org.mockito.Mockito.verifyNoMoreInteractions(notificationService);
        verify(activityLogService).log(eq("SESSION_CANCELLED_COUNSELLED_OFFLINE"), anyString(), anyString(),
                eq(other), eq("Asha"));
    }

    @Test
    @DisplayName("A session in progress or under review -> 409, nothing cancelled or written")
    void inProgressRefused() {
        givenMarkable();
        when(queries.liveBookingsForStudent(STUDENT, ASSESSMENT))
                .thenReturn(Arrays.asList(live(300L, "CONFIRMED", null), live(301L, "IN_PROGRESS", null)));

        expectError(HttpStatus.CONFLICT, "SESSION_IN_PROGRESS",
                () -> service.preflight(principal(ME_USER), STUDENT, ASSESSMENT, today));
        expectError(HttpStatus.CONFLICT, "SESSION_IN_PROGRESS",
                () -> service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false));
        verifyNoInteractions(appointmentService);
        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("The entitlement is linked, never consumed")
    void entitlementLinkedNotConsumed() {
        givenMarkable();
        ArgumentCaptor<CounsellingAppointment> appt = ArgumentCaptor.forClass(CounsellingAppointment.class);

        service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, true);

        verify(appointmentRepository).save(appt.capture());
        assertEquals(Long.valueOf(55L), appt.getValue().getEntitlementId());
        verify(entitlementRepository, never()).save(any());
        // By construction: the service holds no EntitlementService, so it has no way to
        // consume (or credit back) a session.
        for (java.lang.reflect.Field f : OfflineCounsellingService.class.getDeclaredFields()) {
            assertFalse(EntitlementService.class.isAssignableFrom(f.getType()), f.getName());
        }
    }

    @Test
    @DisplayName("The thank-you mail is sent only after the record commits")
    void emailAfterCommit() {
        givenMarkable();
        TransactionSynchronizationManager.initSynchronization();

        service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false);

        verify(notificationService, never()).sendOfflineSessionCompleteEmail(any());
        List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
        assertEquals(1, syncs.size());
        syncs.get(0).afterCommit();
        ArgumentCaptor<CounsellingAppointment> mailed = ArgumentCaptor.forClass(CounsellingAppointment.class);
        verify(notificationService).sendOfflineSessionCompleteEmail(mailed.capture());
        assertEquals(Long.valueOf(700L), mailed.getValue().getId());
    }

    @Test
    @DisplayName("The mapping row is locked before anything else is read")
    void lockComesFirst() {
        givenMarkable();

        service.markDone(principal(ME_USER), STUDENT, ASSESSMENT, today, false);

        InOrder order = inOrder(mappingRepository, counsellorRepository, appointmentRepository, queries);
        order.verify(mappingRepository).lockByStudent(STUDENT);
        order.verify(counsellorRepository).findByUserId(ME_USER);
        order.verify(appointmentRepository).findLatestCompletedForAssessment(any(), eq(ASSESSMENT));
    }

    // ─── OTP verdict → response ──────────────────────────────────────────────────

    @Test
    @DisplayName("OTP verdicts map to the page's codes: WRONG 400, LOCKED 423, NO_DOB 400")
    void otpVerdicts() {
        assertTrue(OfflineCounsellingService.otpVerifiedOrThrow(OtpGuardService.Result.verified()));

        OfflineCounsellingException wrong = assertThrows(OfflineCounsellingException.class,
                () -> OfflineCounsellingService.otpVerifiedOrThrow(OtpGuardService.Result.wrong(2)));
        assertEquals(HttpStatus.BAD_REQUEST, wrong.getStatus());
        assertEquals("OTP_WRONG", wrong.getCode());
        assertEquals(2, wrong.getExtras().get("attemptsLeft"));

        OfflineCounsellingException locked = assertThrows(OfflineCounsellingException.class,
                () -> OfflineCounsellingService.otpVerifiedOrThrow(
                        OtpGuardService.Result.locked(java.time.LocalDateTime.of(2026, 9, 28, 11, 15))));
        assertEquals(HttpStatus.LOCKED, locked.getStatus());
        assertEquals("OTP_LOCKED", locked.getCode());
        assertEquals("2026-09-28T11:15", locked.getExtras().get("lockedUntil"));
        assertEquals(false, locked.getExtras().get("permanent"));

        OfflineCounsellingException forGood = assertThrows(OfflineCounsellingException.class,
                () -> OfflineCounsellingService.otpVerifiedOrThrow(OtpGuardService.Result.lockedForGood()));
        assertEquals(true, forGood.getExtras().get("permanent"));
        assertNull(forGood.getExtras().get("lockedUntil"));

        OfflineCounsellingException noDob = assertThrows(OfflineCounsellingException.class,
                () -> OfflineCounsellingService.otpVerifiedOrThrow(OtpGuardService.Result.noDob()));
        assertEquals("OTP_NO_DOB", noDob.getCode());
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    private CounsellingAppointment givenRecord(String origin, String status) {
        CounsellingSlot slot = new CounsellingSlot();
        slot.setStatus("COMPLETED");
        CounsellingAppointment a = new CounsellingAppointment();
        a.setId(700L);
        a.setOrigin(origin);
        a.setStatus(status);
        a.setSlot(slot);
        a.setCounsellor(me);
        when(appointmentRepository.findById(700L)).thenReturn(Optional.of(a));
        when(appointmentRepository.save(any(CounsellingAppointment.class))).thenAnswer(inv -> inv.getArgument(0));
        return a;
    }

    @Test
    @DisplayName("A counsellor cannot revert, whatever @PreAuthorize says in log-only mode")
    void onlyAdmins() {
        CounsellingAppointment a = givenRecord(CounsellingAppointment.ORIGIN_OFFLINE_RECORD, "COMPLETED");

        expectError(HttpStatus.FORBIDDEN, "FORBIDDEN",
                () -> service.revert(principal(ME_USER, "counselling.appointment.update"), 700L, null));
        assertEquals("COMPLETED", a.getStatus());
        verify(appointmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("An admin reverts a completed offline record: CANCELLED, attributed, slot cancelled")
    void adminRevertsOfflineRecord() {
        CounsellingAppointment a = givenRecord(CounsellingAppointment.ORIGIN_OFFLINE_RECORD, "COMPLETED");

        OfflineCounsellingService.RevertResult r =
                service.revert(principal(1L, "counselling.appointment.delete"), 700L, "wrong student");

        assertEquals("CANCELLED", r.status);
        assertEquals("CANCELLED", a.getStatus());
        assertEquals("ADMIN", a.getCancelledByRole());
        assertEquals("OFFLINE_RECORD_REVERTED", a.getCancellationReason());
        assertEquals("wrong student", a.getCancellationNote());
        assertEquals(Long.valueOf(1L), a.getCancelledByUserId());
        assertNotNull(a.getCancelledAt());
        assertEquals("CANCELLED", a.getSlot().getStatus());
        verify(slotRepository).save(a.getSlot());
    }

    @Test
    @DisplayName("A super-admin needs no explicit permission")
    void superAdminAllowed() {
        givenRecord(CounsellingAppointment.ORIGIN_OFFLINE_RECORD, "COMPLETED");
        UserPrincipal sa = principal(1L);
        sa.setSuperAdmin(true);

        assertEquals("CANCELLED", service.revert(sa, 700L, null).status);
    }

    @Test
    @DisplayName("Only a COMPLETED OFFLINE_RECORD can be reverted")
    void onlyCompletedOfflineRecords() {
        givenRecord(null, "COMPLETED");
        expectError(HttpStatus.CONFLICT, "NOT_REVERTIBLE",
                () -> service.revert(principal(1L, "counselling.appointment.delete"), 700L, null));

        givenRecord(CounsellingAppointment.ORIGIN_OFFLINE_RECORD, "CANCELLED");
        expectError(HttpStatus.CONFLICT, "NOT_REVERTIBLE",
                () -> service.revert(principal(1L, "counselling.appointment.delete"), 700L, null));
        verify(appointmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("counsellor.update (which counsellors hold) is not enough to flag anyone offline")
    void counsellorCannotFlag() {
        expectError(HttpStatus.FORBIDDEN, "FORBIDDEN",
                () -> service.setOffline(principal(ME_USER, "counsellor.update"), OTHER, true));
        assertFalse(other.getIsOffline());
        verify(counsellorRepository, never()).save(any());
    }

    @Test
    @DisplayName("An admin with counsellor.create flags a counsellor offline, with an audit row")
    void adminFlags() {
        OfflineCounsellingService.OfflineFlagResult r =
                service.setOffline(principal(1L, "counsellor.create"), OTHER, true);

        assertTrue(r.isOffline);
        assertTrue(other.getIsOffline());
        verify(counsellorRepository).save(other);
        verify(authAuditService).recordSensitiveOp(eq(1L), eq("counsellor.create"), eq("ALLOW"), anyString(), any());
    }

    // ─── What the offline flow leans on elsewhere ───────────────────────────────

    private CounsellingAppointmentRepository repo;
    private CounsellingSlotRepository slots;
    private CounsellingNotificationService notifications;
    private EntitlementService entitlements;
    private AppointmentService appointments;

    /** A real AppointmentService over mocks, for the pieces of it the offline flow relies on. */
    private void initAppointments() {
        repo = mock(CounsellingAppointmentRepository.class);
        slots = mock(CounsellingSlotRepository.class);
        notifications = mock(CounsellingNotificationService.class);
        entitlements = mock(EntitlementService.class);
        appointments = new AppointmentService();
        ReflectionTestUtils.setField(appointments, "appointmentRepository", repo);
        ReflectionTestUtils.setField(appointments, "slotRepository", slots);
        ReflectionTestUtils.setField(appointments, "notificationService", notifications);
        ReflectionTestUtils.setField(appointments, "entitlementService", entitlements);
        ReflectionTestUtils.setField(appointments, "auditLogService", mock(AuditLogService.class));
        ReflectionTestUtils.setField(appointments, "clock", new CounsellingClock("Asia/Kolkata"));
        when(repo.save(any(CounsellingAppointment.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private CounsellingAppointment booking(String status, String origin) {
        CounsellingSlot slot = new CounsellingSlot();
        slot.setId(40L);
        slot.setStatus("CONFIRMED");
        slot.setDate(LocalDate.now().plusDays(3));
        slot.setStartTime(java.time.LocalTime.of(10, 0));
        CounsellingAppointment a = new CounsellingAppointment();
        a.setId(300L);
        a.setStatus(status);
        a.setOrigin(origin);
        a.setSlot(slot);
        a.setEntitlementId(66L);
        when(repo.findById(300L)).thenReturn(Optional.of(a));
        return a;
    }

    @Test
    @DisplayName("cancelSilently: cancelled and attributed, slot released, no mail, no credit-back")
    void cancelSilently() {
        initAppointments();
        CounsellingAppointment a = booking("CONFIRMED", null);

        appointments.cancelSilently(300L, null, "SYSTEM", "COUNSELLED_OFFLINE", "counselled at school");

        assertEquals("CANCELLED", a.getStatus());
        assertEquals("SYSTEM", a.getCancelledByRole());
        assertEquals("COUNSELLED_OFFLINE", a.getCancellationReason());
        assertNotNull(a.getCancelledAt());
        assertEquals("AVAILABLE", a.getSlot().getStatus());
        assertFalse(a.getSlot().getIsBlocked());
        verify(slots).save(a.getSlot());
        verifyNoInteractions(notifications);
        verifyNoInteractions(entitlements);
    }

    @Test
    @DisplayName("cancelSilently leaves a parked booking's slot alone: it holds no hour any more")
    void cancelSilentlyParkedKeepsSlot() {
        initAppointments();
        CounsellingAppointment a = booking("AWAITING_RESCHEDULE", null);
        a.getSlot().setStatus("CANCELLED");
        a.getSlot().setIsBlocked(true);

        appointments.cancelSilently(300L, null, "SYSTEM", "COUNSELLED_OFFLINE", "counselled at school");

        assertEquals("CANCELLED", a.getStatus());
        assertEquals("CANCELLED", a.getSlot().getStatus());
        assertTrue(a.getSlot().getIsBlocked());
        verify(slots, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    @DisplayName("reschedule refuses a completed session and any offline record")
    void rescheduleRefusesCompletedAndOffline() {
        initAppointments();
        CounsellingAppointment completed = booking("COMPLETED", null);
        assertThrows(BadRequestException.class, () -> appointments.reschedule(300L, 41L, null, true, true));
        assertEquals("COMPLETED", completed.getStatus());

        booking("CANCELLED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        assertThrows(BadRequestException.class, () -> appointments.reschedule(300L, 41L, null, true, true));
        verify(slots, never()).save(any());
    }

    @Test
    @DisplayName("Student history hides reverted offline records, keeps everything else")
    void historyHidesRevertedOfflineRecords() {
        initAppointments();
        CounsellingAppointment reverted = new CounsellingAppointment();
        reverted.setOrigin(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        reverted.setStatus("CANCELLED");
        CounsellingAppointment offlineDone = new CounsellingAppointment();
        offlineDone.setOrigin(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        offlineDone.setStatus("COMPLETED");
        CounsellingAppointment cancelledOnline = new CounsellingAppointment();
        cancelledOnline.setStatus("CANCELLED");
        when(repo.findByStudentIdOrdered(STUDENT))
                .thenReturn(Arrays.asList(reverted, offlineDone, cancelledOnline));

        List<CounsellingAppointment> history = appointments.getByStudent(STUDENT);

        assertEquals(Arrays.asList(offlineDone, cancelledOnline), history);
    }

    @Test
    @DisplayName("The counsellor feed leaves offline records out unless asked")
    void counsellorFeedExcludesOfflineByDefault() {
        initAppointments();
        ReflectionTestUtils.setField(appointments, "studentEntitlementRepository", mock(StudentEntitlementRepository.class));
        when(repo.findByCounsellorIdExcludingOfflineRecords(ME)).thenReturn(new ArrayList<>());
        when(repo.findByCounsellorId(ME)).thenReturn(new ArrayList<>());

        appointments.getByCounsellor(ME);
        verify(repo).findByCounsellorIdExcludingOfflineRecords(ME);
        verify(repo, never()).findByCounsellorId(ME);

        appointments.getByCounsellor(ME, true);
        verify(repo).findByCounsellorId(ME);
    }

    @Test
    @DisplayName("isOffline is serialised but no request body can set it")
    void isOfflineIsReadOnly() throws Exception {
        ObjectMapper om = new ObjectMapper();
        Counsellor c = new Counsellor();
        c.setName("Asha");
        c.setIsOffline(true);
        assertTrue(om.writeValueAsString(c).contains("\"isOffline\":true"));

        Counsellor bound = om.readValue("{\"name\":\"Asha\",\"isOffline\":true}", Counsellor.class);
        assertNull(bound.getIsOffline());
        assertEquals("Asha", bound.getName());
    }

    @Test
    @DisplayName("Appointment JSON carries origin/assessmentId but not the counsellor's bank or account details")
    void appointmentJsonIsNarrowed() throws Exception {
        Counsellor c = new Counsellor();
        c.setId(ME);
        c.setName("Asha");
        c.setEmail("asha@c9.test");
        c.setBankAccount("000111222333");
        c.setBankIfsc("HDFC0000001");
        c.setGovtIdHash("hash");
        User cu = new User();
        cu.setId(3L);
        c.setUser(cu);
        User assignedBy = new User();
        assignedBy.setId(4L);
        assignedBy.setName("Asha");
        assignedBy.setEmail("asha-login@c9.test");
        CounsellingAppointment a = new CounsellingAppointment();
        a.setId(700L);
        a.setCounsellor(c);
        a.setAssignedBy(assignedBy);
        a.setOrigin(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        a.setAssessmentId(ASSESSMENT);

        String json = new ObjectMapper().writeValueAsString(a);

        assertTrue(json.contains("\"origin\":\"OFFLINE_RECORD\""));
        assertTrue(json.contains("\"assessmentId\":9"));
        assertTrue(json.contains("\"name\":\"Asha\""));
        assertTrue(json.contains("asha@c9.test"));
        assertFalse(json.contains("000111222333"));
        assertFalse(json.contains("HDFC0000001"));
        assertFalse(json.contains("govtIdHash"));
        assertFalse(json.contains("asha-login@c9.test"));
        assertFalse(json.contains("offlineRecord"));
    }
}
