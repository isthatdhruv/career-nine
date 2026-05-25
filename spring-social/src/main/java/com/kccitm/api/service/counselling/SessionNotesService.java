package com.kccitm.api.service.counselling;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.SessionNotes;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.SessionNotesRepository;

@Service
public class SessionNotesService {

    private static final Logger logger = LoggerFactory.getLogger(SessionNotesService.class);

    @Autowired
    private SessionNotesRepository sessionNotesRepository;

    @Autowired
    private CounsellingAppointmentRepository counsellingAppointmentRepository;

    @Autowired
    private CounsellingSlotRepository counsellingSlotRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    /**
     * Creates session notes for a completed appointment.
     * Marks both the appointment and its slot as COMPLETED,
     * sends a session-complete email, an in-app notification to the student,
     * and records an audit log entry.
     */
    @Transactional
    public SessionNotes create(SessionNotes notes, User counsellorUser) {
        CounsellingAppointment appointment = notes.getAppointment();

        // Mark slot as COMPLETED
        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("COMPLETED");
        counsellingSlotRepository.save(slot);

        // Mark appointment as COMPLETED
        appointment.setStatus("COMPLETED");
        counsellingAppointmentRepository.save(appointment);

        // Persist the session notes
        SessionNotes savedNotes = sessionNotesRepository.save(notes);

        logger.info("Session notes created for appointment ID {} by counsellor user ID {}",
                appointment.getId(), counsellorUser != null ? counsellorUser.getId() : "unknown");

        // Send session complete email to student (async)
        notificationService.sendSessionCompleteEmail(appointment);

        // Send in-app notification to student
        try {
            Long studentUserId = appointment.getStudent().getUserId();
            User studentUser = new User();
            studentUser.setId(studentUserId);
            notificationService.createInAppNotification(
                    studentUser,
                    "SESSION_COMPLETED",
                    "Session Complete - View Counsellor Remarks",
                    "Your counselling session has been completed. Log in to view your session notes.",
                    appointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app notification for student after session completion: {}",
                    e.getMessage());
        }

        // Audit log
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "COMPLETED");
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
}
