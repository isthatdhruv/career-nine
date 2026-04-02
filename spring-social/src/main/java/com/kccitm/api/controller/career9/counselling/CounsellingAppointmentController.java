package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.counselling.AppointmentService;
import com.kccitm.api.service.counselling.BookingService;
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
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/book")
    public ResponseEntity<?> book(@RequestBody Map<String, Object> request) {
        Long slotId = Long.valueOf(request.get("slotId").toString());
        Long studentId = Long.valueOf(request.get("studentId").toString());
        String reason = request.containsKey("reason") ? request.get("reason").toString() : null;

        Optional<UserStudent> studentOpt = userStudentRepository.findById(studentId);
        if (!studentOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Student not found with id: " + studentId);
        }

        try {
            CounsellingAppointment appointment = bookingService.bookSlot(slotId, studentOpt.get(), reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Booking conflict for slot {} student {}: {}", slotId, studentId, e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    @GetMapping("/queue")
    public ResponseEntity<List<CounsellingAppointment>> getQueue() {
        return ResponseEntity.ok(appointmentService.getPendingQueue());
    }

    @PutMapping("/assign/{id}")
    public ResponseEntity<?> assign(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long counsellorId = Long.valueOf(request.get("counsellorId").toString());
        Long adminUserId = Long.valueOf(request.get("adminUserId").toString());

        Optional<User> adminOpt = userRepository.findById(adminUserId);
        if (!adminOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Admin user not found with id: " + adminUserId);
        }

        try {
            CounsellingAppointment appointment = appointmentService.assign(id, counsellorId, adminOpt.get());
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Assign failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

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

    @PutMapping("/reschedule/{id}")
    public ResponseEntity<?> reschedule(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Long newSlotId = Long.valueOf(request.get("newSlotId").toString());
        Long userId = Long.valueOf(request.get("userId").toString());

        Optional<User> userOpt = userRepository.findById(userId);
        User user = userOpt.orElse(null);

        try {
            CounsellingAppointment appointment = appointmentService.reschedule(id, newSlotId, user);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            logger.warn("Reschedule failed for appointment {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @PutMapping("/set-meeting-link/{id}")
    public ResponseEntity<?> setMeetingLink(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String link = request.get("link").toString();

        CounsellingAppointment appointment = appointmentRepository.findById(id).orElse(null);
        if (appointment == null) {
            return ResponseEntity.notFound().build();
        }

        meetingLinkService.setManualLink(appointment, link);
        CounsellingAppointment saved = appointmentRepository.save(appointment);
        logger.info("Set manual meeting link for appointment {}", id);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/by-student/{studentId}")
    public ResponseEntity<List<CounsellingAppointment>> getByStudent(@PathVariable Long studentId) {
        return ResponseEntity.ok(appointmentService.getByStudent(studentId));
    }

    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellingAppointment>> getByCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(appointmentService.getByCounsellor(counsellorId));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(appointmentService.getStats());
    }
}
