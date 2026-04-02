package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

@Service
public class BookingService {

    private static final Logger logger = LoggerFactory.getLogger(BookingService.class);

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    /**
     * Returns all available slots for the week starting at weekStart (inclusive)
     * through weekStart + 6 days (inclusive).
     */
    public List<CounsellingSlot> getAvailableSlots(LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        logger.info("Fetching available slots from {} to {}", weekStart, weekEnd);
        return slotRepository.findAvailableSlots(weekStart, weekEnd);
    }

    /**
     * Books a slot for the given student.
     * Verifies the slot is AVAILABLE, transitions it to REQUESTED,
     * creates a PENDING appointment, and fires notifications.
     */
    @Transactional
    public CounsellingAppointment bookSlot(Long slotId, UserStudent student, String reason) {
        logger.info("Student {} attempting to book slot {}", student.getUserStudentId(), slotId);

        CounsellingSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new RuntimeException("Slot not found with id: " + slotId));

        if (!"AVAILABLE".equals(slot.getStatus())) {
            throw new RuntimeException(
                    "Slot " + slotId + " is not available for booking. Current status: " + slot.getStatus());
        }

        // Transition slot to REQUESTED
        slot.setStatus("REQUESTED");
        slotRepository.save(slot);

        // Create appointment
        CounsellingAppointment appointment = new CounsellingAppointment();
        appointment.setSlot(slot);
        appointment.setStudent(student);
        appointment.setStudentReason(reason);
        appointment.setStatus("PENDING");
        appointment = appointmentRepository.save(appointment);

        logger.info("Created appointment {} for student {} on slot {}",
                appointment.getId(), student.getUserStudentId(), slotId);

        // Send booking received email
        notificationService.sendBookingReceivedEmail(appointment);

        // Send in-app notification to student — UserStudent stores userId (Long),
        // not a User entity. We build a lightweight User reference using the stored userId.
        try {
            com.kccitm.api.model.User studentUser = new com.kccitm.api.model.User();
            studentUser.setId(student.getUserId());
            notificationService.createInAppNotification(
                    studentUser,
                    "BOOKING_RECEIVED",
                    "Counselling Request Received",
                    "Your counselling request has been received and is under review.",
                    appointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app notification for student {}: {}",
                    student.getUserStudentId(), e.getMessage());
        }

        // Audit log — no actor User is available at booking time; pass null
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "PENDING");
        newValues.put("slotId", slotId);
        newValues.put("studentId", student.getUserStudentId());
        auditLogService.log(appointment, "BOOKING_CREATED", null, reason, null, newValues);

        return appointment;
    }
}
