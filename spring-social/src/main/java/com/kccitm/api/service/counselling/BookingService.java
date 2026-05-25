package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.counselling.CounsellorInstituteMappingService;

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

    @Autowired
    private CounsellorInstituteMappingService counsellorInstituteMappingService;

    @Autowired
    private CounsellingActivityLogService activityLogService;

    /**
     * Returns all available slots for the week starting at weekStart (inclusive)
     * through weekStart + 6 days (inclusive). Past dates are excluded.
     */
    public List<CounsellingSlot> getAvailableSlots(LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = LocalDate.now();
        LocalDate effectiveStart = weekStart.isBefore(today) ? today : weekStart;
        logger.info("Fetching available slots from {} to {}", effectiveStart, weekEnd);
        if (effectiveStart.isAfter(weekEnd)) return List.of();
        return filterOutPastSlots(slotRepository.findAvailableSlots(effectiveStart, weekEnd));
    }

    /**
     * Returns available slots filtered to only counsellors allocated to the given institute.
     * Students see only slots from counsellors assigned to their school. Past dates are excluded.
     */
    public List<CounsellingSlot> getAvailableSlotsForInstitute(LocalDate weekStart, Integer instituteCode) {
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = LocalDate.now();
        LocalDate effectiveStart = weekStart.isBefore(today) ? today : weekStart;

        if (effectiveStart.isAfter(weekEnd)) return List.of();

        List<Long> counsellorIds = counsellorInstituteMappingService.getActiveCounsellorIdsForInstitute(instituteCode);

        if (counsellorIds.isEmpty()) {
            logger.info("No counsellors allocated to institute {} — returning empty slots", instituteCode);
            return List.of();
        }

        logger.info("Fetching available slots from {} to {} for institute {} ({} counsellors)",
                effectiveStart, weekEnd, instituteCode, counsellorIds.size());
        return filterOutPastSlots(
                slotRepository.findAvailableSlotsForCounsellors(counsellorIds, effectiveStart, weekEnd));
    }

    private List<CounsellingSlot> filterOutPastSlots(List<CounsellingSlot> slots) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        return slots.stream()
                .filter(s -> !s.getDate().equals(today) || s.getStartTime().isAfter(now))
                .collect(Collectors.toList());
    }

    /**
     * Books a slot for the given student.
     * Verifies the slot is AVAILABLE, transitions it to REQUESTED,
     * creates an appointment with the counsellor auto-assigned from the slot,
     * and fires notifications.
     */
    @Transactional
    public CounsellingAppointment bookSlot(Long slotId, UserStudent student, String reason) {
        logger.info("Student {} attempting to book slot {}", student.getUserStudentId(), slotId);

        CounsellingSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", "id", slotId));

        if (!"AVAILABLE".equals(slot.getStatus())) {
            throw new BadRequestException(
                    "Slot " + slotId + " is not available for booking. Current status: " + slot.getStatus());
        }

        LocalDate today = LocalDate.now();
        if (slot.getDate().isBefore(today)
                || (slot.getDate().equals(today) && !slot.getStartTime().isAfter(LocalTime.now()))) {
            throw new BadRequestException("Slot " + slotId + " is in the past and cannot be booked.");
        }

        // Transition slot to REQUESTED
        slot.setStatus("REQUESTED");
        slotRepository.save(slot);

        // Create appointment — auto-assign counsellor from the slot
        CounsellingAppointment appointment = new CounsellingAppointment();
        appointment.setSlot(slot);
        appointment.setStudent(student);
        appointment.setCounsellor(slot.getCounsellor());
        appointment.setStudentReason(reason);
        appointment.setStatus("CONFIRMED");
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

        activityLogService.log("SLOT_BOOKED", "Session Booked",
                "Student " + student.getUserStudentId() + " booked a session with " + slot.getCounsellor().getName()
                + " on " + slot.getDate() + " at " + slot.getStartTime(),
                slot.getCounsellor(), "Student");

        return appointment;
    }
}
