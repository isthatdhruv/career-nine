package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.counselling.AppointmentService;
import com.kccitm.api.service.counselling.BookingService;
import com.kccitm.api.service.counselling.CheckinReviewService;
import com.kccitm.api.service.counselling.CounsellorCancellationService;
import com.kccitm.api.service.counselling.MeetingLinkService;

@RestController
@RequestMapping("/api/counselling-appointment")
public class CounsellingAppointmentController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingAppointmentController.class);

    @Autowired
    private BookingService bookingService;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    @Autowired
    private com.kccitm.api.service.counselling.CheckinOtpService checkinOtpService;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CheckinReviewService checkinReviewService;

    @Autowired
    private CounsellorCancellationService counsellorCancellationService;

    // no scope arg: body is raw Map; student books appointment slot
    @PreAuthorize("@auth.allows('counselling.appointment.create')")
    @PostMapping("/book")
    public ResponseEntity<?> book(@RequestBody Map<String, Object> request) {
        Long slotId = Long.valueOf(request.get("slotId").toString());
        Long studentId = Long.valueOf(request.get("studentId").toString());
        String reason = request.containsKey("reason") ? request.get("reason").toString() : null;

        UserStudent student = userStudentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", studentId));

        try {
            CounsellingAppointment appointment = bookingService.bookSlot(slotId, student, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Booking conflict for slot {} student {}: {}", slotId, studentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    // no scope arg: admin queue view
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/queue")
    public ResponseEntity<List<CounsellingAppointment>> getQueue() {
        return ResponseEntity.ok(appointmentService.getPendingQueue());
    }

    // no scope arg: admin assigns counsellor to appointment
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PutMapping("/assign/{id}")
    public ResponseEntity<?> assign(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long counsellorId = Long.valueOf(request.get("counsellorId").toString());
        Long adminUserId = Long.valueOf(request.get("adminUserId").toString());

        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", adminUserId));

        try {
            CounsellingAppointment appointment = appointmentService.assign(id, counsellorId, admin);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Assign failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // no scope arg: counsellor confirms appointment
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PutMapping("/confirm/{id}")
    public ResponseEntity<?> confirm(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long userId = Long.valueOf(request.get("userId").toString());

        Optional<User> userOpt = userRepository.findById(userId);
        User user = userOpt.orElse(null);

        try {
            CounsellingAppointment appointment = appointmentService.confirm(id, user);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Confirm failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // no scope arg: counsellor declines appointment
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PutMapping("/decline/{id}")
    public ResponseEntity<?> decline(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long userId = Long.valueOf(request.get("userId").toString());
        String reason = request.containsKey("reason") ? request.get("reason").toString() : null;

        Optional<User> userOpt = userRepository.findById(userId);
        User user = userOpt.orElse(null);

        try {
            CounsellingAppointment appointment = appointmentService.decline(id, user, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Decline failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // no scope arg: cancel appointment by id
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PutMapping("/cancel/{id}")
    public ResponseEntity<?> cancel(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long userId = Long.valueOf(request.get("userId").toString());
        String reason = request.containsKey("reason") ? request.get("reason").toString() : null;

        Optional<User> userOpt = userRepository.findById(userId);
        User user = userOpt.orElse(null);

        try {
            CounsellingAppointment appointment = appointmentService.cancel(id, user, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Cancel failed for appointment {} (4hr rule or other): {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // no scope arg: reschedule appointment by id
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PutMapping("/reschedule/{id}")
    public ResponseEntity<?> reschedule(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long newSlotId = Long.valueOf(request.get("newSlotId").toString());
        Long userId = Long.valueOf(request.get("userId").toString());
        // Frontend passes isAdmin=true from admin reschedule UI to bypass the
        // single-reschedule cap on students. Defaults to false for student calls.
        boolean isAdmin = Boolean.TRUE.equals(request.get("isAdmin"));

        Optional<User> userOpt = userRepository.findById(userId);
        User user = userOpt.orElse(null);

        try {
            CounsellingAppointment appointment = appointmentService.reschedule(id, newSlotId, user, isAdmin);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Reschedule failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // no scope arg: counsellor sets manual meeting link
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PutMapping("/set-meeting-link/{id}")
    public ResponseEntity<?> setMeetingLink(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String link = request.get("link").toString();

        CounsellingAppointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", id));

        meetingLinkService.setManualLink(appointment, link);
        CounsellingAppointment saved = appointmentRepository.save(appointment);
        logger.info("Set manual meeting link for appointment {}", id);
        return ResponseEntity.ok(saved);
    }

    // no scope arg: counsellor triggers check-in — generates + sends OTP to student
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/start/{id}")
    public ResponseEntity<?> startSession(@PathVariable Long id) {
        try {
            CounsellingAppointment appointment = checkinOtpService.beginCheckin(id);
            Map<String, Object> out = new java.util.HashMap<>();
            out.put("appointmentId", appointment.getId());
            out.put("status", appointment.getStatus());
            out.put("message", "Ask the student for the 4-digit code on their report to start the session.");
            return ResponseEntity.ok(out);
        } catch (RuntimeException e) {
            logger.warn("Start session failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // no scope arg: counsellor enters the student's OTP to verify check-in
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/verify-checkin/{id}")
    public ResponseEntity<?> verifyCheckin(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String code = request.get("code") != null ? request.get("code").toString() : null;
        try {
            CounsellingAppointment appointment = checkinOtpService.verify(id, code);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Check-in verification failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // ═══ Cancellation and no-show (docs/COUNSELLING_CANCELLATION.md) ═════════════

    /**
     * The student cancels her own session.
     *
     * <p>A separate route from {@code PUT /cancel/{id}} on purpose. That one is annotated for
     * {@code counselling.appointment.update} — a counsellor/admin permission — and takes
     * {@code userId} from the request body without ever checking whose appointment it is.
     *
     * <p><b>Ownership is verified in code here, not by an annotation.</b>
     * {@code auth.enforce-mode} is {@code log-only} on every profile including production, so
     * {@code @PreAuthorize("@auth.allows(...)")} records the decision and then returns true
     * regardless. An annotation would look correct in review and enforce nothing at runtime;
     * without the explicit check below, any signed-in student could cancel any appointment by
     * incrementing the id.
     */
    @PostMapping("/student/cancel/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> studentCancel(@PathVariable Long id,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @RequestBody(required = false) Map<String, Object> request) {
        if (principal == null || principal.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No authenticated user."));
        }
        UserStudent self = userStudentRepository.getByUserId(principal.getId()).orElse(null);
        if (self == null || self.getUserStudentId() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "This account is not a student."));
        }

        CounsellingAppointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", id));

        // The check that actually protects this endpoint.
        Long ownerId = appointment.getStudent() != null ? appointment.getStudent().getUserStudentId() : null;
        if (ownerId == null || !ownerId.equals(self.getUserStudentId())) {
            logger.warn("Student {} attempted to cancel appointment {} belonging to student {}",
                    self.getUserStudentId(), id, ownerId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "This session does not belong to you."));
        }

        Map<String, Object> body = request == null ? Map.of() : request;
        String reasonCode = body.get("reason") != null ? body.get("reason").toString() : null;
        String note = body.get("note") != null ? body.get("note").toString() : null;
        if ("OTHER".equalsIgnoreCase(reasonCode) && (note == null || note.trim().isEmpty())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Please tell us briefly why you are cancelling."));
        }

        User user = userRepository.findById(principal.getId()).orElse(null);
        try {
            CounsellingAppointment cancelled = appointmentService.cancel(
                    id, user, AppointmentService.ROLE_STUDENT, reasonCode, note);
            Map<String, Object> out = new java.util.HashMap<>();
            out.put("appointmentId", cancelled.getId());
            out.put("status", cancelled.getStatus());
            out.put("missesRemaining", appointmentService.remainingMisses(cancelled.getEntitlementId()));
            return ResponseEntity.ok(out);
        } catch (RuntimeException e) {
            // Includes the window rejection the UI must surface rather than swallow: she can
            // open the page at 2h05m and confirm at 1h58m, and the server is right to refuse.
            logger.warn("Student cancel failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /** What the student's card needs to render: her deadline, and how many misses are left. */
    @GetMapping("/student/cancellation-info/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> studentCancellationInfo(@PathVariable Long id,
                                                     @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null || principal.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No authenticated user."));
        }
        UserStudent self = userStudentRepository.getByUserId(principal.getId()).orElse(null);
        CounsellingAppointment appointment = appointmentRepository.findById(id).orElse(null);
        if (self == null || appointment == null || appointment.getStudent() == null
                || !self.getUserStudentId().equals(appointment.getStudent().getUserStudentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Not your session."));
        }
        Map<String, Object> out = new java.util.HashMap<>();
        out.put("missesRemaining", appointmentService.remainingMisses(appointment.getEntitlementId()));
        out.put("missAllowance", appointmentService.getMissAllowance());
        out.put("cutoffHours", appointmentService.getStudentWindowHours());
        out.put("forceShifted", appointment.getForceShifted());
        out.put("shiftedFromStart", appointment.getShiftedFromStart());
        return ResponseEntity.ok(out);
    }

    /** The student contests an absent mark. Raising it suspends the strike immediately. */
    @PostMapping("/student/dispute/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> studentDispute(@PathVariable Long id,
                                            @AuthenticationPrincipal UserPrincipal principal,
                                            @RequestBody(required = false) Map<String, Object> request) {
        if (principal == null || principal.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No authenticated user."));
        }
        UserStudent self = userStudentRepository.getByUserId(principal.getId()).orElse(null);
        CounsellingAppointment appointment = appointmentRepository.findById(id).orElse(null);
        if (self == null || appointment == null || appointment.getStudent() == null
                || !self.getUserStudentId().equals(appointment.getStudent().getUserStudentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Not your session."));
        }
        String note = request != null && request.get("note") != null ? request.get("note").toString() : null;
        User user = userRepository.findById(principal.getId()).orElse(null);
        try {
            return ResponseEntity.ok(checkinReviewService.raiseDispute(id, user, note));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * The counsellor drops one session; the system re-places the student.
     * Distinct from the block-date flow, which still covers a whole day and needs approval.
     */
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/counsellor/cancel/{id}")
    public ResponseEntity<?> counsellorCancel(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long userId = request.get("userId") != null ? Long.valueOf(request.get("userId").toString()) : null;
        String reasonCode = request.get("reason") != null ? request.get("reason").toString() : null;
        String note = request.get("note") != null ? request.get("note").toString() : null;
        if ("OTHER".equalsIgnoreCase(reasonCode) && (note == null || note.trim().isEmpty())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Please give a brief reason."));
        }
        User actor = userId != null ? userRepository.findById(userId).orElse(null) : null;
        try {
            return ResponseEntity.ok(counsellorCancellationService.cancelAndReplace(id, actor, reasonCode, note));
        } catch (RuntimeException e) {
            logger.warn("Counsellor cancel failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /** The counsellor records that the student did not appear. Session window only. */
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/mark-student-absent/{id}")
    public ResponseEntity<?> markStudentAbsent(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> request) {
        Long userId = request != null && request.get("userId") != null
                ? Long.valueOf(request.get("userId").toString()) : null;
        User actor = userId != null ? userRepository.findById(userId).orElse(null) : null;
        try {
            return ResponseEntity.ok(checkinReviewService.markStudentAbsent(id, actor));
        } catch (RuntimeException e) {
            logger.warn("Mark-absent failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Admin cancels a session. Costs nobody anything: the slot reopens, the session is
     * credited back, and both the student and the counsellor are told the team will be in
     * touch. Neither of them chose this, so unlike counsellor self-cancellation the counsellor
     * is notified too.
     */
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/admin/cancel/{id}")
    public ResponseEntity<?> adminCancel(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long userId = request.get("userId") != null ? Long.valueOf(request.get("userId").toString()) : null;
        String note = request.get("note") != null ? request.get("note").toString() : null;
        User admin = userId != null ? userRepository.findById(userId).orElse(null) : null;
        try {
            CounsellingAppointment cancelled = appointmentService.cancel(
                    id, admin, AppointmentService.ROLE_ADMIN, "ADMIN_CANCELLED", note);
            return ResponseEntity.ok(cancelled);
        } catch (RuntimeException e) {
            logger.warn("Admin cancel failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /** Admin dispute queue — the only no-show cases needing a human decision. */
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/disputes")
    public ResponseEntity<List<CounsellingAppointment>> getDisputes() {
        return ResponseEntity.ok(checkinReviewService.getOpenDisputes());
    }

    /** Admin upholds or overturns a disputed absent mark. */
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/disputes/resolve/{id}")
    public ResponseEntity<?> resolveDispute(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long userId = request.get("userId") != null ? Long.valueOf(request.get("userId").toString()) : null;
        boolean upheld = Boolean.TRUE.equals(request.get("upheld"));
        String note = request.get("note") != null ? request.get("note").toString() : null;
        User admin = userId != null ? userRepository.findById(userId).orElse(null) : null;
        try {
            return ResponseEntity.ok(checkinReviewService.resolveDispute(id, admin, upheld, note));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    // no scope arg: identifies by studentId
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/by-student/{studentId}")
    public ResponseEntity<List<CounsellingAppointment>> getByStudent(@PathVariable Long studentId) {
        return ResponseEntity.ok(appointmentService.getByStudent(studentId));
    }

    // no scope arg: identifies by counsellorId
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellingAppointment>> getByCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(appointmentService.getByCounsellor(counsellorId));
    }

    // no scope arg: admin stats query
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(appointmentService.getStats());
    }

    // no scope arg: cross-counsellor admin list; scope-filter narrows result set
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/getAll")
    public ResponseEntity<List<CounsellingAppointment>> getAll() {
        return ResponseEntity.ok(appointmentRepository.findAll());
    }
}
