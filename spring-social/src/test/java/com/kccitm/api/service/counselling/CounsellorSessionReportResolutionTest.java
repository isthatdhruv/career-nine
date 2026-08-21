package com.kccitm.api.service.counselling;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Covers {@link CounsellorSessionAdminService#resolveReportFor}, which backs the Report button on
 * the counsellor's appointments list and the report card on their session-notes page.
 *
 * <p>The link itself comes from {@link CounsellingNotificationService#bookingReportLink}, which the
 * counselling emails also use — that is the point of resolving it here rather than from the
 * student's report rows, and these cases pin that it is the only source consulted. What is left to
 * establish is the answer when there is no link: "not ready" covered both a student who has not sat
 * the assessment and a finished assessment whose report never came through, and a counsellor can
 * only act on the second.
 */
class CounsellorSessionReportResolutionTest {

    private static final long APPOINTMENT_ID = 7L;
    private static final long STUDENT_ID = 42L;
    private static final long ASSESSMENT_ID = 44L;

    private CounsellingAppointmentRepository appointmentRepository;
    private CounsellingNotificationService notificationService;
    private StudentAssessmentMappingRepository mappingRepository;
    private CounsellorSessionAdminService service;

    private CounsellingAppointment appointment;

    @BeforeEach
    void setUp() {
        appointmentRepository = mock(CounsellingAppointmentRepository.class);
        notificationService = mock(CounsellingNotificationService.class);
        mappingRepository = mock(StudentAssessmentMappingRepository.class);

        service = new CounsellorSessionAdminService();
        ReflectionTestUtils.setField(service, "appointmentRepository", appointmentRepository);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "mappingRepository", mappingRepository);

        UserStudent student = new UserStudent();
        student.setUserStudentId(STUDENT_ID);
        appointment = new CounsellingAppointment();
        appointment.setStudent(student);

        when(appointmentRepository.findById(APPOINTMENT_ID)).thenReturn(Optional.of(appointment));
        when(notificationService.assessmentIdFor(appointment)).thenReturn(ASSESSMENT_ID);
        stubMappingStatus("completed");
    }

    private void stubMappingStatus(String status) {
        StudentAssessmentMapping mapping = new StudentAssessmentMapping();
        mapping.setAssessmentId(ASSESSMENT_ID);
        mapping.setStatus(status);
        when(mappingRepository.findFirstByUserStudentUserStudentIdAndAssessmentId(STUDENT_ID, ASSESSMENT_ID))
                .thenReturn(Optional.of(mapping));
    }

    @Test
    @DisplayName("The report the emails carry is the one handed to the counsellor")
    void readyReportIsReturned() {
        when(notificationService.bookingReportLink(appointment)).thenReturn("https://cdn/report.pdf");

        CounsellorSessionAdminService.ReportLinkResult result = service.resolveReportFor(APPOINTMENT_ID);

        assertEquals("ready", result.getStatus());
        assertEquals("https://cdn/report.pdf", result.getReportLink());
    }

    @Test
    @DisplayName("A finished assessment with no report is named as a missing report, not a missing sitting")
    void missingReportForCompletedAssessment() {
        when(notificationService.bookingReportLink(appointment)).thenReturn(null);

        CounsellorSessionAdminService.ReportLinkResult result = service.resolveReportFor(APPOINTMENT_ID);

        assertEquals("notGenerated", result.getStatus());
        assertNull(result.getReportLink());
    }

    @Test
    @DisplayName("An unfinished assessment is named as such — there is nothing to have generated yet")
    void unfinishedAssessmentIsNamedSeparately() {
        when(notificationService.bookingReportLink(appointment)).thenReturn(null);
        stubMappingStatus("ongoing");

        CounsellorSessionAdminService.ReportLinkResult result = service.resolveReportFor(APPOINTMENT_ID);

        assertEquals("notCompleted", result.getStatus());
    }

    @Test
    @DisplayName("A session naming no assessment has no report to find")
    void sessionWithoutAssessmentIsUnavailable() {
        when(notificationService.bookingReportLink(appointment)).thenReturn(null);
        when(notificationService.assessmentIdFor(appointment)).thenReturn(null);

        CounsellorSessionAdminService.ReportLinkResult result = service.resolveReportFor(APPOINTMENT_ID);

        assertEquals("unavailable", result.getStatus());
    }
}
