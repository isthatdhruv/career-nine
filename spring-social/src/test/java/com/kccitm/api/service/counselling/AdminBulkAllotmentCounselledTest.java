package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link AdminCounsellingBookingService} around students already counselled for the assessment:
 * the preview's read-only bucket, confirm dropping them server-side and stamping the assessment
 * on what it books, rebook refusing held sessions, and the contact snapshot.
 */
class AdminBulkAllotmentCounselledTest {

    private static final Long ASSESSMENT = 9L;

    private StudentAssessmentMappingRepository mappingRepository;
    private CounsellingAppointmentRepository appointmentRepository;
    private CounsellingSlotRepository slotRepository;
    private UserStudentRepository userStudentRepository;
    private BookingService bookingService;
    private AppointmentService appointmentService;
    private AdminCounsellingBookingService service;

    @BeforeEach
    void setUp() {
        mappingRepository = mock(StudentAssessmentMappingRepository.class);
        appointmentRepository = mock(CounsellingAppointmentRepository.class);
        slotRepository = mock(CounsellingSlotRepository.class);
        userStudentRepository = mock(UserStudentRepository.class);
        bookingService = mock(BookingService.class);
        appointmentService = mock(AppointmentService.class);
        service = new AdminCounsellingBookingService();
        ReflectionTestUtils.setField(service, "mappingRepository", mappingRepository);
        ReflectionTestUtils.setField(service, "appointmentRepository", appointmentRepository);
        ReflectionTestUtils.setField(service, "clock", new CounsellingClock("Asia/Kolkata"));
        ReflectionTestUtils.setField(service, "slotRepository", slotRepository);
        ReflectionTestUtils.setField(service, "userStudentRepository", userStudentRepository);
        ReflectionTestUtils.setField(service, "bookingService", bookingService);
        ReflectionTestUtils.setField(service, "appointmentService", appointmentService);

        when(slotRepository.findAvailableSlots(any(), any())).thenReturn(Collections.emptyList());
        when(appointmentRepository.findUpcomingAppointmentsForStudents(any(), any())).thenReturn(Collections.emptyList());
        when(appointmentRepository.findLatestCompletedForAssessment(any(), any())).thenReturn(Collections.emptyList());
        when(appointmentRepository.findByStudentIdOrdered(anyLong())).thenReturn(Collections.emptyList());
        when(appointmentRepository.save(any(CounsellingAppointment.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    /** [userStudentId, name, email, status, username] — the findLiteByAssessmentId row shape. */
    private void cohort(Object[]... rows) {
        when(mappingRepository.findLiteByAssessmentId(ASSESSMENT)).thenReturn(Arrays.asList(rows));
    }

    private static Object[] row(long id, String status) {
        return new Object[] { id, "Student " + id, "s" + id + "@x.test", status, "u" + id };
    }

    private void counselled(long... ids) {
        List<Object[]> rows = new ArrayList<>();
        for (long id : ids) rows.add(new Object[] { java.math.BigInteger.valueOf(id), java.math.BigInteger.valueOf(1000 + id) });
        when(appointmentRepository.findLatestCompletedForAssessment(any(), eq(ASSESSMENT))).thenReturn(rows);
    }

    private static CounsellingAppointment upcoming(long studentId) {
        UserStudent s = new UserStudent();
        s.setUserStudentId(studentId);
        CounsellingSlot slot = new CounsellingSlot();
        slot.setId(300 + studentId);
        slot.setDate(LocalDate.now().plusDays(3));
        slot.setStartTime(LocalTime.of(10, 0));
        slot.setEndTime(LocalTime.of(11, 0));
        CounsellingAppointment a = new CounsellingAppointment();
        a.setId(200 + studentId);
        a.setStudent(s);
        a.setSlot(slot);
        a.setStatus("CONFIRMED");
        return a;
    }

    @SuppressWarnings("unchecked")
    private static List<Long> ids(Map<String, Object> out, String key) {
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> m : (List<Map<String, Object>>) out.get(key)) ids.add((Long) m.get("studentId"));
        return ids;
    }

    @Test
    void previewPutsCounselledStudentsInTheirOwnBucketAheadOfAlreadyBooked() {
        cohort(row(1, "completed"), row(2, "completed"), row(3, "completed"), row(4, "completed"),
                row(5, "ongoing"));
        counselled(1, 2);
        // Student 2 is both counselled and booked: counselled wins, the booking is not offered.
        when(appointmentRepository.findUpcomingAppointmentsForStudents(any(), any()))
                .thenReturn(Arrays.asList(upcoming(2), upcoming(3)));

        Map<String, Object> out = service.previewBulk(ASSESSMENT);

        assertEquals(Arrays.asList(1L, 2L), ids(out, "alreadyCounselled"));
        assertEquals(2, out.get("alreadyCounselledCount"));
        assertEquals(Collections.singletonList(3L), ids(out, "alreadyBooked"));
        assertEquals(Collections.singletonList(4L), ids(out, "toBook"));
        assertEquals(4, out.get("totalCompleted"));
        assertEquals((int) out.get("totalCompleted"),
                (int) out.get("alreadyCounselledCount") + (int) out.get("alreadyBookedCount") + (int) out.get("toBookCount"));
    }

    @Test
    void previewWithNobodyCounselledHasAnEmptyBucket() {
        cohort(row(1, "completed"));
        Map<String, Object> out = service.previewBulk(ASSESSMENT);
        assertEquals(0, out.get("alreadyCounselledCount"));
        assertEquals(Collections.singletonList(1L), ids(out, "toBook"));
    }

    @Test
    void confirmDropsCounselledStudentsAndStampsTheAssessmentOnWhatItBooks() {
        cohort(row(1, "completed"), row(2, "completed"));
        counselled(1);
        CounsellingSlot slot = new CounsellingSlot();
        slot.setId(55L);
        slot.setDate(LocalDate.now().plusDays(2));
        slot.setStartTime(LocalTime.of(9, 0));
        slot.setEndTime(LocalTime.of(10, 0));
        when(slotRepository.findAvailableSlots(any(), any())).thenReturn(Collections.singletonList(slot));
        UserStudent two = new UserStudent();
        two.setUserStudentId(2L);
        when(userStudentRepository.findByIdWithStudentInfo(2L)).thenReturn(Optional.of(two));
        CounsellingAppointment booked = new CounsellingAppointment();
        booked.setId(900L);
        booked.setSlot(slot);
        when(bookingService.bookSlot(eq(55L), eq(two), anyString(), any(), isNull())).thenReturn(booked);

        Map<String, Object> out = service.confirmBulk(ASSESSMENT, Arrays.asList(1L, 2L));

        assertEquals(2, out.get("requestedCount"));
        assertEquals(1, out.get("bookedCount"));
        assertEquals(1, out.get("unbookedCount"));
        @SuppressWarnings("unchecked")
        Map<String, Object> dropped = ((List<Map<String, Object>>) out.get("unbooked")).get(0);
        assertEquals(1L, dropped.get("studentId"));
        assertEquals("Already counselled for this assessment", dropped.get("reason"));
        verify(userStudentRepository, never()).findByIdWithStudentInfo(1L);
        assertEquals(ASSESSMENT, booked.getAssessmentId());
        verify(appointmentRepository).save(booked);
    }

    @Test
    void confirmKeepsAnAssessmentTheBookingAlreadyCarries() {
        cohort(row(2, "completed"));
        CounsellingSlot slot = new CounsellingSlot();
        slot.setId(55L);
        slot.setDate(LocalDate.now().plusDays(2));
        slot.setStartTime(LocalTime.of(9, 0));
        when(slotRepository.findAvailableSlots(any(), any())).thenReturn(Collections.singletonList(slot));
        UserStudent two = new UserStudent();
        two.setUserStudentId(2L);
        when(userStudentRepository.findByIdWithStudentInfo(2L)).thenReturn(Optional.of(two));
        CounsellingAppointment booked = new CounsellingAppointment();
        booked.setAssessmentId(4L);
        when(bookingService.bookSlot(anyLong(), any(), anyString(), any(), isNull())).thenReturn(booked);

        service.confirmBulk(ASSESSMENT, Collections.singletonList(2L));

        assertEquals(4L, booked.getAssessmentId());
        verify(appointmentRepository, never()).save(booked);
    }

    @Test
    void contactSnapshotTakesTheProfileAndAPriorParentContact() {
        UserStudent s = new UserStudent();
        s.setUserStudentId(2L);
        StudentInfo info = new StudentInfo();
        info.setName("Asha");
        info.setEmail("asha@x.test");
        info.setPhoneNumber("98");
        s.setStudentInfo(info);
        when(userStudentRepository.findByIdWithStudentInfo(2L)).thenReturn(Optional.of(s));
        CounsellingAppointment newestNoParent = new CounsellingAppointment();
        CounsellingAppointment olderWithParent = new CounsellingAppointment();
        olderWithParent.setParentEmail("parent@x.test");
        when(appointmentRepository.findByStudentIdOrdered(2L)).thenReturn(Arrays.asList(newestNoParent, olderWithParent));

        service.bookForStudent(2L, 55L, null);

        ArgumentCaptor<BookingService.BookingContact> contact = ArgumentCaptor.forClass(BookingService.BookingContact.class);
        verify(bookingService).bookSlot(eq(55L), eq(s), anyString(), contact.capture(), isNull());
        assertEquals("Asha", contact.getValue().name);
        assertEquals("asha@x.test", contact.getValue().email);
        assertEquals("parent@x.test", contact.getValue().parentEmail);
        assertEquals("EMAIL", contact.getValue().preferredContactMethod);
    }

    @Test
    void contactSnapshotWithNoHistoryHasNoParent() {
        UserStudent s = new UserStudent();
        s.setUserStudentId(3L);
        when(userStudentRepository.findByIdWithStudentInfo(3L)).thenReturn(Optional.of(s));

        service.bookForStudent(3L, 55L, "why");

        ArgumentCaptor<BookingService.BookingContact> contact = ArgumentCaptor.forClass(BookingService.BookingContact.class);
        verify(bookingService).bookSlot(eq(55L), eq(s), eq("why"), contact.capture(), isNull());
        assertNull(contact.getValue().parentEmail);
    }

    @Test
    void rebookRefusesACompletedSession() {
        CounsellingAppointment done = upcoming(2);
        done.setStatus("COMPLETED");
        done.getSlot().setDate(LocalDate.now().minusDays(1));
        when(appointmentRepository.findById(done.getId())).thenReturn(Optional.of(done));

        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> service.rebookWithCounsellor(done.getId(), 10L, null));
        assertTrue(e.getMessage().contains("already taken place"));
        verify(appointmentService, never()).reschedule(anyLong(), anyLong(), any(), anyBoolean(), anyBoolean());
    }

    @Test
    void rebookRefusesAnOfflineRecordInAnyState() {
        CounsellingAppointment reverted = upcoming(2);
        reverted.setStatus("CANCELLED");
        reverted.setOrigin(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        reverted.setCounsellor(new Counsellor());
        when(appointmentRepository.findById(reverted.getId())).thenReturn(Optional.of(reverted));

        assertThrows(IllegalStateException.class, () -> service.rebookWithCounsellor(reverted.getId(), 10L, null));
        verify(appointmentService, never()).reschedule(anyLong(), anyLong(), any(), anyBoolean(), anyBoolean());
    }
}
