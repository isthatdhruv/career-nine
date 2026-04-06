package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;

@Service
public class AppointmentService {

    private static final Logger logger = LoggerFactory.getLogger(AppointmentService.class);

    private static final int CANCELLATION_WINDOW_HOURS = 4;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    // ─── Queries ─────────────────────────────────────────────────────────────────

    public List<CounsellingAppointment> getPendingQueue() {
        return appointmentRepository.findByStatus("PENDING");
    }

    public List<CounsellingAppointment> getByStudent(Long studentId) {
        return appointmentRepository.findByStudentIdOrdered(studentId);
    }

    public List<CounsellingAppointment> getByCounsellor(Long counsellorId) {
        return appointmentRepository.findByCounsellorId(counsellorId);
    }

    public List<CounsellingAppointment> getByCounsellorAndDate(Long counsellorId, LocalDate date) {
        return appointmentRepository.findByCounsellorIdAndDate(counsellorId, date);
    }

    public Map<String, Long> getStats() {
        LocalDate weekStart = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        Long pending = appointmentRepository.countByStatus("PENDING");
        Long assigned = appointmentRepository.countByStatus("ASSIGNED");
        Long confirmed = appointmentRepository.countByStatus("CONFIRMED");
        Long thisWeek = appointmentRepository.countActiveInWeek(weekStart, weekEnd);

        Map<String, Long> stats = new HashMap<>();
        stats.put("pending", pending != null ? pending : 0L);
        stats.put("assigned", assigned != null ? assigned : 0L);
        stats.put("confirmed", confirmed != null ? confirmed : 0L);
        stats.put("thisWeek", thisWeek != null ? thisWeek : 0L);
        return stats;
    }

    // ─── State Transitions ────────────────────────────────────────────────────────

    /**
     * Assigns a counsellor to a PENDING appointment.
     * Transitions appointment → ASSIGNED, slot → ASSIGNED.
     */
    @Transactional
    public CounsellingAppointment assign(Long appointmentId, Long counsellorId, User admin) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));

        appointment.setCounsellor(counsellor);
        appointment.setAssignedBy(admin);
        appointment.setStatus("ASSIGNED");

        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("ASSIGNED");
        slotRepository.save(slot);

        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} assigned to counsellor {} by admin {}",
                appointmentId, counsellorId, admin != null ? admin.getId() : "unknown");

        // Notify counsellor by email
        notificationService.sendAssignedToCounsellorEmail(appointment);

        // In-app notification to counsellor (if linked to a User account)
        if (counsellor.getUser() != null) {
            notificationService.createInAppNotification(
                    counsellor.getUser(),
                    "APPOINTMENT_ASSIGNED",
                    "New Counselling Session Assigned",
                    "A new counselling session has been assigned to you. Please review and confirm.",
                    appointment.getId(),
                    "APPOINTMENT");
        }

        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "ASSIGNED");
        newValues.put("counsellorId", counsellorId);
        auditLogService.log(appointment, "ASSIGNED", admin, null, null, newValues);

        return appointment;
    }

    /**
     * Counsellor confirms an ASSIGNED appointment.
     * Generates a meeting link and transitions both appointment and slot to CONFIRMED.
     */
    @Transactional
    public CounsellingAppointment confirm(Long appointmentId, User counsellorUser) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        appointment.setStatus("CONFIRMED");

        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("CONFIRMED");
        slotRepository.save(slot);

        // Generate meeting link
        try {
            String meetLink = meetingLinkService.generateMeetLink(appointment);
            appointment.setMeetingLink(meetLink);
        } catch (Exception e) {
            logger.warn("Failed to generate meeting link for appointment {}: {}", appointmentId, e.getMessage());
        }

        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} confirmed by counsellor user {}", appointmentId,
                counsellorUser != null ? counsellorUser.getId() : "unknown");

        // Notify student
        notificationService.sendConfirmedToStudentEmail(appointment);

        // In-app notification to student
        try {
            User studentUser = new User();
            studentUser.setId(appointment.getStudent().getUserId());
            notificationService.createInAppNotification(
                    studentUser,
                    "APPOINTMENT_CONFIRMED",
                    "Counselling Session Confirmed",
                    "Your counselling session has been confirmed. Check your email for details.",
                    appointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app notification for student on confirm: {}", e.getMessage());
        }

        auditLogService.logSimple(appointment, "CONFIRMED", counsellorUser, null);

        return appointment;
    }

    /**
     * Counsellor declines an ASSIGNED appointment, sending it back to PENDING.
     * Clears counsellor and assignedBy fields; slot reverts to REQUESTED.
     */
    @Transactional
    public CounsellingAppointment decline(Long appointmentId, User counsellorUser, String reason) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        appointment.setStatus("PENDING");
        appointment.setCounsellor(null);
        appointment.setAssignedBy(null);

        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("REQUESTED");
        slotRepository.save(slot);

        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} declined by counsellor user {}, reason: {}",
                appointmentId, counsellorUser != null ? counsellorUser.getId() : "unknown", reason);

        auditLogService.logSimple(appointment, "DECLINED", counsellorUser, reason);

        return appointment;
    }

    /**
     * Cancels an appointment.
     * Enforces the {@value #CANCELLATION_WINDOW_HOURS}-hour cancellation window:
     * cancellation is not permitted if fewer than CANCELLATION_WINDOW_HOURS hours
     * remain before the session start.
     */
    @Transactional
    public CounsellingAppointment cancel(Long appointmentId, User cancelledBy, String reason) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        CounsellingSlot slot = appointment.getSlot();

        // Enforce 4-hour cancellation window
        LocalDateTime sessionTime = LocalDateTime.of(slot.getDate(), slot.getStartTime());
        if (LocalDateTime.now().plusHours(CANCELLATION_WINDOW_HOURS).isAfter(sessionTime)) {
            throw new BadRequestException(
                    "Cannot cancel: session starts within " + CANCELLATION_WINDOW_HOURS
                            + " hours. Please contact support directly.");
        }

        String oldStatus = appointment.getStatus();
        Counsellor assignedCounsellor = appointment.getCounsellor();

        appointment.setStatus("CANCELLED");
        slot.setStatus("CANCELLED");
        slotRepository.save(slot);
        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} cancelled by user {}, reason: {}",
                appointmentId, cancelledBy != null ? cancelledBy.getId() : "unknown", reason);

        // Determine canceller identity to decide who to notify
        Long cancellerUserId = cancelledBy != null ? cancelledBy.getId() : null;

        // Notify student if the canceller is not the student
        Long studentUserId = appointment.getStudent().getUserId();
        if (!studentUserId.equals(cancellerUserId)) {
            String cancellerName = cancelledBy != null
                    ? (cancelledBy.getName() != null ? cancelledBy.getName() : "Admin")
                    : "Admin";
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            notificationService.sendCancellationEmail(appointment, cancellerName, studentEmail, studentName);

            try {
                User studentUser = new User();
                studentUser.setId(studentUserId);
                notificationService.createInAppNotification(
                        studentUser,
                        "APPOINTMENT_CANCELLED",
                        "Counselling Session Cancelled",
                        "Your counselling session has been cancelled. Reason: " + (reason != null ? reason : "N/A"),
                        appointment.getId(),
                        "APPOINTMENT");
            } catch (Exception e) {
                logger.warn("Failed to create in-app cancellation notification for student: {}", e.getMessage());
            }
        }

        // Notify counsellor if assigned and the canceller is not the counsellor
        if (assignedCounsellor != null) {
            Long counsellorUserId = assignedCounsellor.getUser() != null
                    ? assignedCounsellor.getUser().getId()
                    : null;
            if (counsellorUserId == null || !counsellorUserId.equals(cancellerUserId)) {
                String cancellerName = cancelledBy != null
                        ? (cancelledBy.getName() != null ? cancelledBy.getName() : "Admin")
                        : "Admin";
                notificationService.sendCancellationEmail(
                        appointment, cancellerName,
                        assignedCounsellor.getEmail(), assignedCounsellor.getName());

                if (assignedCounsellor.getUser() != null) {
                    notificationService.createInAppNotification(
                            assignedCounsellor.getUser(),
                            "APPOINTMENT_CANCELLED",
                            "Counselling Session Cancelled",
                            "A session assigned to you has been cancelled. Reason: "
                                    + (reason != null ? reason : "N/A"),
                            appointment.getId(),
                            "APPOINTMENT");
                }
            }
        }

        // Audit log with old/new values
        Map<String, Object> oldValues = new HashMap<>();
        oldValues.put("status", oldStatus);

        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "CANCELLED");

        auditLogService.log(appointment, "CANCELLED", cancelledBy, reason, oldValues, newValues);

        return appointment;
    }

    /**
     * Reschedules an appointment to a new slot.
     * Enforces the {@value #CANCELLATION_WINDOW_HOURS}-hour window on the old slot,
     * verifies the new slot is AVAILABLE, marks the old appointment RESCHEDULED,
     * and creates a new CONFIRMED appointment on the new slot.
     */
    @Transactional
    public CounsellingAppointment reschedule(Long appointmentId, Long newSlotId, User counsellorUser) {
        CounsellingAppointment oldAppointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        CounsellingSlot oldSlot = oldAppointment.getSlot();

        // Enforce 4-hour window on old slot
        LocalDateTime oldSessionTime = LocalDateTime.of(oldSlot.getDate(), oldSlot.getStartTime());
        if (LocalDateTime.now().plusHours(CANCELLATION_WINDOW_HOURS).isAfter(oldSessionTime)) {
            throw new BadRequestException(
                    "Cannot reschedule: session starts within " + CANCELLATION_WINDOW_HOURS
                            + " hours. Please contact support directly.");
        }

        CounsellingSlot newSlot = slotRepository.findById(newSlotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", "id", newSlotId));

        if (!"AVAILABLE".equals(newSlot.getStatus())) {
            throw new BadRequestException(
                    "New slot " + newSlotId + " is not available. Current status: " + newSlot.getStatus());
        }

        // Mark old appointment and slot
        oldAppointment.setStatus("RESCHEDULED");
        oldSlot.setStatus("CANCELLED");
        slotRepository.save(oldSlot);
        appointmentRepository.save(oldAppointment);

        // Create new appointment copying relevant fields from old
        CounsellingAppointment newAppointment = new CounsellingAppointment();
        newAppointment.setSlot(newSlot);
        newAppointment.setStudent(oldAppointment.getStudent());
        newAppointment.setCounsellor(oldAppointment.getCounsellor());
        newAppointment.setAssignedBy(oldAppointment.getAssignedBy());
        newAppointment.setStudentReason(oldAppointment.getStudentReason());
        newAppointment.setStatus("CONFIRMED");

        // Transition new slot to CONFIRMED
        newSlot.setStatus("CONFIRMED");
        slotRepository.save(newSlot);

        // Generate meet link for the new appointment
        try {
            String meetLink = meetingLinkService.generateMeetLink(newAppointment);
            newAppointment.setMeetingLink(meetLink);
        } catch (Exception e) {
            logger.warn("Failed to generate meeting link during reschedule for new slot {}: {}",
                    newSlotId, e.getMessage());
        }

        newAppointment = appointmentRepository.save(newAppointment);

        logger.info("Appointment {} rescheduled to new appointment {} on slot {} by counsellor user {}",
                appointmentId, newAppointment.getId(), newSlotId,
                counsellorUser != null ? counsellorUser.getId() : "unknown");

        // Notify student of reschedule
        notificationService.sendRescheduleEmail(oldAppointment, newAppointment);

        // Audit log for old appointment
        Map<String, Object> oldAuditValues = new HashMap<>();
        oldAuditValues.put("status", "RESCHEDULED");
        oldAuditValues.put("originalSlotId", oldSlot.getId());
        auditLogService.log(oldAppointment, "RESCHEDULED", counsellorUser,
                "Rescheduled to appointment " + newAppointment.getId(), null, oldAuditValues);

        // Audit log for new appointment
        Map<String, Object> newAuditValues = new HashMap<>();
        newAuditValues.put("status", "CONFIRMED");
        newAuditValues.put("newSlotId", newSlotId);
        newAuditValues.put("rescheduledFromAppointmentId", appointmentId);
        auditLogService.log(newAppointment, "CREATED_VIA_RESCHEDULE", counsellorUser,
                "Rescheduled from appointment " + appointmentId, null, newAuditValues);

        return newAppointment;
    }
}
