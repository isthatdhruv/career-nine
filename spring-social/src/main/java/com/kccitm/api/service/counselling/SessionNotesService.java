package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.SessionNotes;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailEventContext;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.SessionNotesRepository;
import com.kccitm.api.service.mail.MailEvents;

@Service
public class SessionNotesService {

    private static final Logger logger = LoggerFactory.getLogger(SessionNotesService.class);

    @Autowired
    private SessionNotesRepository sessionNotesRepository;

    @Autowired
    private CounsellingAppointmentRepository counsellingAppointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    /** Mail-automation hook. Absent until the engine is wired; every publish is best-effort. */
    @Autowired(required = false)
    private MailEvents mailEvents;

    /**
     * Creates session notes for a session that has genuinely taken place.
     *
     * <p>Saving notes does NOT complete the session — the lifecycle sweep owns the
     * COMPLETED transition (slot end time + attendance). Notes are therefore gated on
     * two conditions that together mean "the session actually happened":
     * <ol>
     *   <li>the student checked in via the OTP ({@code checkinVerifiedAt} is set), and</li>
     *   <li>the scheduled slot time has ended.</li>
     * </ol>
     * The appointment is resolved by id (the request body carries an {@code appointmentId},
     * not a nested appointment), then a session-notes-available notification is sent and an
     * audit entry recorded.
     */
    @Transactional
    public SessionNotes create(Long appointmentId, SessionNotes notes, User counsellorUser) {
        Long resolvedId = appointmentId;
        if (resolvedId == null && notes.getAppointment() != null) {
            resolvedId = notes.getAppointment().getId();
        }
        if (resolvedId == null) {
            throw new BadRequestException("appointmentId is required to save session notes.");
        }
        final Long apptId = resolvedId;

        CounsellingAppointment appointment = counsellingAppointmentRepository.findById(apptId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", apptId));

        // Gate 1 — the session must have actually started, i.e. the student checked in
        // with the OTP shared with the counsellor. No check-in => the session never began.
        if (appointment.getCheckinVerifiedAt() == null) {
            throw new BadRequestException(
                    "Notes can be added only after the session has started via the student's check-in code (OTP).");
        }

        // Gate 2 — the scheduled session time must be over.
        CounsellingSlot slot = appointment.getSlot();
        if (slot == null || slot.getDate() == null || slot.getEndTime() == null) {
            throw new BadRequestException("This appointment has no scheduled time, so notes cannot be added yet.");
        }
        LocalDateTime sessionEnd = LocalDateTime.of(slot.getDate(), slot.getEndTime());
        if (LocalDateTime.now().isBefore(sessionEnd)) {
            throw new BadRequestException("Notes can be added only after the session's scheduled time has ended.");
        }

        // Persist the session notes. We deliberately do NOT change appointment/slot status
        // here — completion is decided by CounsellingLifecycleService, not by note-saving.
        notes.setAppointment(appointment);
        SessionNotes savedNotes = sessionNotesRepository.save(notes);

        logger.info("Session notes created for appointment ID {} by counsellor user ID {}",
                appointment.getId(), counsellorUser != null ? counsellorUser.getId() : "unknown");

        // Tell the student their counsellor remarks are now available.
        notificationService.sendSessionCompleteEmail(appointment);
        try {
            Long studentUserId = appointment.getStudent().getUserId();
            User studentUser = new User();
            studentUser.setId(studentUserId);
            notificationService.createInAppNotification(
                    studentUser,
                    "SESSION_COMPLETED",
                    "Session Complete - View Counsellor Remarks",
                    "Your counselling session notes are now available. Log in to view them.",
                    appointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app notification for student after notes saved: {}",
                    e.getMessage());
        }
        if (mailEvents != null) {
            try {
                mailEvents.publish(completedEvent(appointment));
            } catch (Exception e) {
                logger.warn("Mail event publish failed for appointment {}: {}", appointment.getId(), e.getMessage());
            }
        }

        // Audit log
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("sessionNotesId", savedNotes.getId());
        auditLogService.log(appointment, "SESSION_NOTES_CREATED", counsellorUser,
                "Session notes saved", null, newValues);

        return savedNotes;
    }

    /**
     * Returns session notes for the given appointment ID (full data, including private notes).
     */
    public Optional<SessionNotes> getByAppointmentId(Long appointmentId) {
        return sessionNotesRepository.findByAppointmentId(appointmentId);
    }

    /**
     * Returns session notes for the given appointment ID with private notes redacted.
     * Intended for student-facing views.
     */
    public Optional<SessionNotes> getByAppointmentIdForStudent(Long appointmentId) {
        Optional<SessionNotes> result = sessionNotesRepository.findByAppointmentId(appointmentId);
        result.ifPresent(n -> n.setPrivateNotes(null));
        return result;
    }

    /**
     * Updates non-null fields on an existing SessionNotes record.
     */
    public SessionNotes update(Long id, SessionNotes updated) {
        SessionNotes existing = sessionNotesRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("SessionNotes not found with id: " + id));

        if (updated.getKeyDiscussionPoints() != null) {
            existing.setKeyDiscussionPoints(updated.getKeyDiscussionPoints());
        }
        if (updated.getActionItems() != null) {
            existing.setActionItems(updated.getActionItems());
        }
        if (updated.getRecommendedNextSession() != null) {
            existing.setRecommendedNextSession(updated.getRecommendedNextSession());
        }
        if (updated.getFollowupRequired() != null) {
            existing.setFollowupRequired(updated.getFollowupRequired());
        }
        if (updated.getPublicRemarks() != null) {
            existing.setPublicRemarks(updated.getPublicRemarks());
        }
        if (updated.getPrivateNotes() != null) {
            existing.setPrivateNotes(updated.getPrivateNotes());
        }

        SessionNotes saved = sessionNotesRepository.save(existing);
        logger.info("Updated session notes with ID {}", id);
        return saved;
    }

    // ─── Mail events ─────────────────────────────────────────────────────────────

    /**
     * The saved notes as a mail event. The thank-you mail above goes to the student alone, so
     * that is the only recipient offered; the notes themselves stay in the portal, so no notes
     * HTML is supplied. Nothing is sent from here — the engine decides after commit.
     */
    private MailEventContext completedEvent(CounsellingAppointment a) {
        CounsellingSlot slot = a.getSlot();
        Long userStudentId = a.getStudent() != null ? a.getStudent().getUserStudentId() : null;
        String studentName = notificationService.studentName(a);
        MailEventContext.Builder b = MailEventContext.of(MailEvent.SESSION_COMPLETED)
                .subject("appointment", a.getId())
                .subject("entitlement", a.getEntitlementId())
                .subject("student", userStudentId)
                .recipient(MailRecipientRole.STUDENT, notificationService.studentEmail(a), studentName)
                .field("student_name", studentName)
                .field("first_name", firstName(studentName))
                .field("counsellor_name", a.getCounsellor() != null ? a.getCounsellor().getName() : null)
                .field("booking_link", notificationService.portalCounsellingUrl())
                .ref("appointmentId", a.getId())
                .ref("entitlementId", a.getEntitlementId())
                .ref("userStudentId", userStudentId)
                .ref("counsellorId", a.getCounsellor() != null ? a.getCounsellor().getId() : null)
                .student(userStudentId);
        if (a.getStudent() != null && a.getStudent().getInstitute() != null) {
            b.institute(a.getStudent().getInstitute().getInstituteCode());
        }
        if (slot != null && slot.getDate() != null && slot.getStartTime() != null) {
            String date = slot.getDate().format(CounsellingNotificationService.DATE_FMT);
            String time = slot.getStartTime().format(CounsellingNotificationService.TIME_FMT);
            b.field("session_date", date)
             .field("session_time", time)
             .field("session_datetime", date + " at " + time);
        }
        return b.build();
    }

    private static String firstName(String name) {
        if (name == null) return null;
        String t = name.trim();
        int sp = t.indexOf(' ');
        return sp > 0 ? t.substring(0, sp) : t;
    }
}
