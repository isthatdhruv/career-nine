package com.kccitm.api.controller.career9.counselling;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.counselling.AdminCounsellingBookingService;

/**
 * Admin-driven counselling booking endpoints — the admin books on students' behalf, in bulk
 * for an assessment's cohort or for a single chosen student. The available-slot list is served
 * by the existing {@code GET /api/counselling-slot/available} endpoint, so it isn't repeated here.
 */
@RestController
@RequestMapping("/api/counselling/admin")
public class AdminCounsellingBookingController {

    private static final Logger logger = LoggerFactory.getLogger(AdminCounsellingBookingController.class);

    @Autowired
    private AdminCounsellingBookingService adminBookingService;

    @Autowired
    private UserRepository userRepository;

    /** Students who completed an assessment, each flagged with whether they already have an
     *  upcoming counselling appointment. Drives the single-student picker and the bulk preview. */
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/assessment/{assessmentId}/students")
    public ResponseEntity<List<Map<String, Object>>> studentsForAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(adminBookingService.getCompletedStudents(assessmentId));
    }

    /** Bulk allotment dry-run: counts, already-booked list, slot capacity, overflow. */
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/bulk-allot/preview/{assessmentId}")
    public ResponseEntity<Map<String, Object>> bulkPreview(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(adminBookingService.previewBulk(assessmentId));
    }

    /** Bulk allotment confirm: books the selected students (what fits), returns booked / unbooked. */
    @PreAuthorize("@auth.allows('counselling.appointment.create')")
    @PostMapping("/bulk-allot/confirm")
    public ResponseEntity<?> bulkConfirm(@RequestBody Map<String, Object> request) {
        if (request.get("assessmentId") == null) {
            return ResponseEntity.badRequest().body("assessmentId is required");
        }
        Long assessmentId = Long.valueOf(request.get("assessmentId").toString());
        List<Long> studentIds = toLongList(request.get("studentIds"));
        try {
            return ResponseEntity.ok(adminBookingService.confirmBulk(assessmentId, studentIds));
        } catch (RuntimeException e) {
            logger.warn("Bulk allotment failed for assessment {}: {}", assessmentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /** Change counsellor & rebook: moves a student's upcoming appointment onto the earliest
     *  available slot of the chosen counsellor. Body: { appointmentId, counsellorId, userId? }. */
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/rebook-with-counsellor")
    public ResponseEntity<?> rebookWithCounsellor(@RequestBody Map<String, Object> request) {
        if (request.get("appointmentId") == null || request.get("counsellorId") == null) {
            return ResponseEntity.badRequest().body("appointmentId and counsellorId are required");
        }
        Long appointmentId = Long.valueOf(request.get("appointmentId").toString());
        Long counsellorId = Long.valueOf(request.get("counsellorId").toString());
        // Optional acting admin — used only for the reschedule audit/log; null is tolerated.
        User actor = null;
        if (request.get("userId") != null) {
            actor = userRepository.findById(Long.valueOf(request.get("userId").toString())).orElse(null);
        }
        try {
            return ResponseEntity.ok(adminBookingService.rebookWithCounsellor(appointmentId, counsellorId, actor));
        } catch (RuntimeException e) {
            logger.warn("Rebook with counsellor failed for appointment {} -> counsellor {}: {}",
                    appointmentId, counsellorId, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /** Single-student booking: admin picks one AVAILABLE slot for one student. */
    @PreAuthorize("@auth.allows('counselling.appointment.create')")
    @PostMapping("/book-for-student")
    public ResponseEntity<?> bookForStudent(@RequestBody Map<String, Object> request) {
        if (request.get("studentId") == null || request.get("slotId") == null) {
            return ResponseEntity.badRequest().body("studentId and slotId are required");
        }
        Long studentId = Long.valueOf(request.get("studentId").toString());
        Long slotId = Long.valueOf(request.get("slotId").toString());
        String reason = request.get("reason") != null ? request.get("reason").toString() : null;
        try {
            CounsellingAppointment appt = adminBookingService.bookForStudent(studentId, slotId, reason);
            return ResponseEntity.ok(appt);
        } catch (RuntimeException e) {
            logger.warn("Admin booking failed for student {} slot {}: {}", studentId, slotId, e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    /** Coerce a JSON array of numbers/strings into List<Long>; tolerant of nulls and non-arrays. */
    @SuppressWarnings("unchecked")
    private static List<Long> toLongList(Object raw) {
        List<Long> out = new ArrayList<>();
        if (raw instanceof List) {
            for (Object o : (List<Object>) raw) {
                if (o != null) out.add(Long.valueOf(o.toString()));
            }
        }
        return out;
    }
}
