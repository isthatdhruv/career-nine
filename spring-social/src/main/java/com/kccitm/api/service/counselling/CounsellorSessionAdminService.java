package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;

/**
 * Backs the admin's <em>Manage Sessions</em> dialog on the Manage Counsellors page.
 *
 * <p>An admin fielding "I never got the details" or "the counsellor has not seen my report"
 * previously had nowhere to go: the appointment existed, the emails had been sent at booking
 * time, and there was no way to send them again. This lists one counsellor's sessions and
 * re-sends either side's copy on demand.
 *
 * <p>The list is a projection, not the appointment entity. The two things the admin actually
 * decides on — which assessment this session is about, and whether a report exists to send —
 * live at the far end of an entitlement lookup and a report lookup respectively, so serialising
 * the entity would show neither. Resolution is delegated to {@link CounsellingNotificationService}
 * so a row's "Report ready" badge and the link inside the email are the same answer.
 */
@Service
public class CounsellorSessionAdminService {

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    /** One row of the Manage Sessions table. */
    public static class SessionSummary {
        private Long appointmentId;
        private String studentName;
        private String studentEmail;
        private String parentEmail;
        private String instituteName;
        private String assessmentName;
        private LocalDate date;
        private LocalTime startTime;
        private LocalTime endTime;
        private String status;
        private String mode;
        private String counsellorName;
        private String counsellorEmail;
        private String reportLink;

        public Long getAppointmentId() { return appointmentId; }
        public void setAppointmentId(Long appointmentId) { this.appointmentId = appointmentId; }

        public String getStudentName() { return studentName; }
        public void setStudentName(String studentName) { this.studentName = studentName; }

        public String getStudentEmail() { return studentEmail; }
        public void setStudentEmail(String studentEmail) { this.studentEmail = studentEmail; }

        public String getParentEmail() { return parentEmail; }
        public void setParentEmail(String parentEmail) { this.parentEmail = parentEmail; }

        public String getInstituteName() { return instituteName; }
        public void setInstituteName(String instituteName) { this.instituteName = instituteName; }

        public String getAssessmentName() { return assessmentName; }
        public void setAssessmentName(String assessmentName) { this.assessmentName = assessmentName; }

        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }

        public LocalTime getStartTime() { return startTime; }
        public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

        public LocalTime getEndTime() { return endTime; }
        public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getMode() { return mode; }
        public void setMode(String mode) { this.mode = mode; }

        public String getCounsellorName() { return counsellorName; }
        public void setCounsellorName(String counsellorName) { this.counsellorName = counsellorName; }

        public String getCounsellorEmail() { return counsellorEmail; }
        public void setCounsellorEmail(String counsellorEmail) { this.counsellorEmail = counsellorEmail; }

        public String getReportLink() { return reportLink; }
        public void setReportLink(String reportLink) { this.reportLink = reportLink; }
    }

    /**
     * Every session belonging to one counsellor, most recent first — an admin fielding a
     * question about a session is nearly always asked about the latest one.
     *
     * <p>Cancelled sessions are kept. An admin sending a report link after a cancellation is a
     * real case — the student sat the assessment either way — and a list that quietly dropped
     * rows would read as data loss.
     */
    @Transactional(readOnly = true)
    public List<SessionSummary> sessionsFor(Long counsellorId) {
        List<CounsellingAppointment> appointments = appointmentRepository.findByCounsellorId(counsellorId);
        List<SessionSummary> out = new ArrayList<>(appointments.size());
        for (CounsellingAppointment a : appointments) {
            out.add(toSummary(a));
        }
        // Nulls last on both keys: a slot-less appointment is a data fault, not a session to
        // schedule the admin's attention around.
        out.sort(Comparator
                .comparing(SessionSummary::getDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(SessionSummary::getStartTime, Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    private SessionSummary toSummary(CounsellingAppointment a) {
        SessionSummary s = new SessionSummary();
        s.setAppointmentId(a.getId());
        s.setStudentName(notificationService.studentName(a));
        s.setStudentEmail(notificationService.studentEmail(a));
        s.setParentEmail(a.getParentEmail());
        s.setInstituteName(notificationService.instituteNameFor(a));
        s.setAssessmentName(notificationService.assessmentNameFor(a));
        s.setStatus(a.getStatus());
        s.setMode(a.getMode());
        if (a.getCounsellor() != null) {
            s.setCounsellorName(a.getCounsellor().getName());
            s.setCounsellorEmail(a.getCounsellor().getEmail());
        }
        CounsellingSlot slot = a.getSlot();
        if (slot != null) {
            s.setDate(slot.getDate());
            s.setStartTime(slot.getStartTime());
            s.setEndTime(slot.getEndTime());
        }
        s.setReportLink(notificationService.bookingReportLink(a));
        return s;
    }

    /**
     * The report link for one session, for screens that show a single session rather than a
     * list — the counsellor's session-notes page, which is precisely where the results are
     * being read. Null when nothing has generated yet.
     */
    @Transactional(readOnly = true)
    public String reportLinkFor(Long appointmentId) {
        CounsellingAppointment a = appointmentRepository.findById(appointmentId).orElse(null);
        return a == null ? null : notificationService.bookingReportLink(a);
    }

    /** What the admin is told after pressing one of the two send buttons. */
    public static class MailOutcome {
        private final List<String> recipients;
        private final boolean reportIncluded;

        public MailOutcome(List<String> recipients, boolean reportIncluded) {
            this.recipients = recipients;
            this.reportIncluded = reportIncluded;
        }

        public List<String> getRecipients() { return recipients; }
        public boolean isReportIncluded() { return reportIncluded; }
    }

    @Transactional(readOnly = true)
    public MailOutcome mailStudent(Long appointmentId) {
        CounsellingAppointment a = require(appointmentId);
        List<String> to = notificationService.sendSessionSummaryToStudent(a);
        return new MailOutcome(to, notificationService.bookingReportLink(a) != null);
    }

    @Transactional(readOnly = true)
    public MailOutcome mailCounsellor(Long appointmentId) {
        CounsellingAppointment a = require(appointmentId);
        String to = notificationService.sendSessionSummaryToCounsellor(a);
        return new MailOutcome(List.of(to), notificationService.bookingReportLink(a) != null);
    }

    private CounsellingAppointment require(Long appointmentId) {
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new IllegalStateException("This session no longer exists."));
    }
}
