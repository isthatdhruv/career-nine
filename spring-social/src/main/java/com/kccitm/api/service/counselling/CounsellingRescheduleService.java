package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.security.TokenProvider;

/**
 * Public, token-gated self-service rescheduling. When a counsellor is marked absent, each affected
 * appointment is set to {@code AWAITING_RESCHEDULE} and the student is emailed a tokenized link to a
 * no-login page. This service backs that page: it lists the currently-available slots (any active
 * counsellor) and books the student's chosen slot, reusing {@link BookingService} — so the meeting
 * link, contact snapshot, and confirmation email all come for free.
 */
@Service
public class CounsellingRescheduleService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingRescheduleService.class);

    /** Status an appointment carries while it waits for the student to pick a new slot. */
    public static final String AWAITING = "AWAITING_RESCHEDULE";

    /** How far ahead (days) we offer slots — matches the student picker's horizon. */
    private static final int SLOT_HORIZON_DAYS = 84; // 12 weeks

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private BookingService bookingService;

    /** Context for the public reschedule page: the old session details + currently-available slots. */
    @Transactional
    public Map<String, Object> getContext(String token) {
        CounsellingAppointment appt = resolve(token);
        boolean actionable = AWAITING.equals(appt.getStatus());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("actionable", actionable);
        out.put("status", appt.getStatus());
        out.put("studentName", studentName(appt));
        if (appt.getCounsellor() != null) out.put("counsellorName", appt.getCounsellor().getName());
        if (appt.getSlot() != null) {
            out.put("previousDate", String.valueOf(appt.getSlot().getDate()));
            out.put("previousTime", String.valueOf(appt.getSlot().getStartTime()));
        }
        // Only surface slots when the student can still act — once rescheduled the link is inert.
        out.put("slots", actionable ? mapSlots(availableSlots()) : List.of());
        return out;
    }

    /**
     * Books the student's chosen slot and closes the old (awaiting) appointment. Reuses
     * {@link BookingService#bookSlot} so the new session gets a meeting link + confirmation email,
     * and draws from the same entitlement (the original session was never used).
     */
    @Transactional
    public CounsellingAppointment confirmReschedule(String token, Long slotId) {
        CounsellingAppointment old = resolve(token);
        if (!AWAITING.equals(old.getStatus())) {
            throw new BadRequestException("This reschedule link has already been used or is no longer valid.");
        }

        // Reload the student with studentInfo eager so the confirmation email has a recipient.
        UserStudent student = userStudentRepository
                .findByIdWithStudentInfo(old.getStudent().getUserStudentId())
                .orElse(old.getStudent());

        CounsellingAppointment neu = bookingService.bookSlot(
                slotId, student, "Rescheduled — counsellor was unavailable",
                contactFor(student, old), old.getEntitlementId());

        neu.setRescheduledFromAppointmentId(old.getId());
        appointmentRepository.save(neu);

        old.setStatus("RESCHEDULED");
        appointmentRepository.save(old);

        logger.info("Self-reschedule: appointment {} -> new appointment {} on slot {}",
                old.getId(), neu.getId(), slotId);
        return neu;
    }

    // ---- helpers ------------------------------------------------------------

    private CounsellingAppointment resolve(String token) {
        Long appointmentId = tokenProvider.getCounsellingRescheduleAppointmentId(token);
        if (appointmentId == null) {
            throw new BadRequestException("This reschedule link is invalid or has expired.");
        }
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));
    }

    /** Contact for the confirmation email — prefer the original booking snapshot, else the profile. */
    private BookingService.BookingContact contactFor(UserStudent student, CounsellingAppointment old) {
        BookingService.BookingContact c = new BookingService.BookingContact();
        c.name = firstNonBlank(old.getStudentContactName(), infoName(student));
        c.email = firstNonBlank(old.getStudentContactEmail(), infoEmail(student));
        c.phone = firstNonBlank(old.getStudentContactPhone(), infoPhone(student));
        c.parentEmail = old.getParentEmail();
        c.parentPhone = old.getParentPhone();
        c.preferredContactMethod = old.getPreferredContactMethod() != null
                ? old.getPreferredContactMethod() : "EMAIL";
        return c;
    }

    /** AVAILABLE, non-blocked, future slots across all counsellors, earliest first. */
    private List<CounsellingSlot> availableSlots() {
        LocalDate today = LocalDate.now();
        List<CounsellingSlot> slots = slotRepository.findAvailableSlots(today, today.plusDays(SLOT_HORIZON_DAYS));
        LocalTime now = LocalTime.now();
        List<CounsellingSlot> out = new ArrayList<>(slots.size());
        for (CounsellingSlot s : slots) {
            if (s.getDate().equals(today) && !s.getStartTime().isAfter(now)) continue;
            out.add(s);
        }
        return out;
    }

    private List<Map<String, Object>> mapSlots(List<CounsellingSlot> slots) {
        List<Map<String, Object>> out = new ArrayList<>(slots.size());
        for (CounsellingSlot s : slots) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("slotId", s.getId());
            m.put("date", String.valueOf(s.getDate()));
            m.put("startTime", String.valueOf(s.getStartTime()));
            m.put("endTime", String.valueOf(s.getEndTime()));
            m.put("mode", s.getMode());
            out.add(m);
        }
        return out;
    }

    private String studentName(CounsellingAppointment appt) {
        String n = firstNonBlank(appt.getStudentContactName(), infoName(appt.getStudent()));
        return n != null ? n : "there";
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }

    private static String infoName(UserStudent s) {
        StudentInfo i = s != null ? s.getStudentInfo() : null;
        return i != null ? i.getName() : null;
    }

    private static String infoEmail(UserStudent s) {
        StudentInfo i = s != null ? s.getStudentInfo() : null;
        return i != null ? i.getEmail() : null;
    }

    private static String infoPhone(UserStudent s) {
        StudentInfo i = s != null ? s.getStudentInfo() : null;
        return i != null ? i.getPhoneNumber() : null;
    }
}
