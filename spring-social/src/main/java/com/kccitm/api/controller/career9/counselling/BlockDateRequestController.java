package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

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

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.BlockDateRequest;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.BlockDateRequestRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.counselling.CounsellingNotificationService;
import com.kccitm.api.service.counselling.MeetingLinkService;
@RestController
@RequestMapping("/api/block-date-request")
public class BlockDateRequestController {

    private static final Logger logger = LoggerFactory.getLogger(BlockDateRequestController.class);

    @Autowired
    private BlockDateRequestRepository requestRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    @Autowired
    private com.kccitm.api.service.counselling.CounsellingActivityLogService activityLogService;

    /**
     * Counsellor submits a block date request.
     * Status = PENDING. Email sent to admin.
     */
    @PostMapping("/submit")
    public ResponseEntity<?> submit(@RequestBody Map<String, Object> body) {
        Long counsellorId = ((Number) body.get("counsellorId")).longValue();
        String dateStr = (String) body.get("date");
        String reason = (String) body.get("reason");

        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));

        BlockDateRequest request = new BlockDateRequest();
        request.setCounsellor(counsellor);
        request.setBlockDate(LocalDate.parse(dateStr));
        request.setReason(reason);
        request.setStatus("PENDING");

        BlockDateRequest saved = requestRepository.save(request);
        logger.info("Block date request submitted: counsellor={} date={}", counsellor.getName(), dateStr);

        activityLogService.log("BLOCK_DATE_REQUESTED", "Block Date Request",
                counsellor.getName() + " requested to block " + dateStr
                + (reason != null && !reason.isEmpty() ? " — Reason: " + reason : ""), counsellor);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /** Get all pending requests (for admin) */
    @GetMapping("/pending")
    public ResponseEntity<List<BlockDateRequest>> getPending() {
        return ResponseEntity.ok(requestRepository.findByStatus("PENDING"));
    }

    /** Get requests for a specific counsellor */
    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<BlockDateRequest>> getByCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(requestRepository.findByCounsellorId(counsellorId));
    }

    /** Admin approves a request — actually blocks the date */
    @PutMapping("/approve/{id}")
    public ResponseEntity<?> approve(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        BlockDateRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("BlockDateRequest", "id", id));

        if (!"PENDING".equals(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request is not pending"));
        }

        request.setStatus("APPROVED");
        if (body != null && body.get("adminResponse") != null) {
            request.setAdminResponse((String) body.get("adminResponse"));
        }
        requestRepository.save(request);

        Long blockedCounsellorId = request.getCounsellor().getId();
        LocalDate blockDate = request.getBlockDate();

        // All slots on the blocked date for this counsellor
        List<CounsellingSlot> existingSlots = slotRepository.findByCounsellorIdAndDateBetween(
                blockedCounsellorId, blockDate, blockDate);

        // Pool of AVAILABLE slots on the same date from OTHER active counsellors.
        // We draw from this pool when reassigning appointments so that each
        // replacement counsellor is picked at random (shuffled) and we never hand
        // out the same slot twice within one approval.
        List<CounsellingSlot> replacementPool = new ArrayList<>();
        for (CounsellingSlot s : slotRepository.findAvailableSlots(blockDate, blockDate)) {
            if (s.getCounsellor() != null
                    && !blockedCounsellorId.equals(s.getCounsellor().getId())
                    && !Boolean.TRUE.equals(s.getIsBlocked())) {
                replacementPool.add(s);
            }
        }
        Collections.shuffle(replacementPool);

        // Existing confirmed appointments on the blocked counsellor's day —
        // these are the students we need to reassign (or cancel as fallback).
        List<CounsellingAppointment> dayAppointments =
                appointmentRepository.findByCounsellorIdAndDate(blockedCounsellorId, blockDate);

        int cancelledCount = 0;
        int reassignedCount = 0;
        int studentsCancelledCount = 0;

        for (CounsellingAppointment appointment : dayAppointments) {
            String status = appointment.getStatus();
            if (!"CONFIRMED".equals(status) && !"ASSIGNED".equals(status) && !"PENDING".equals(status)) {
                continue;
            }

            // Pick the first remaining replacement slot whose start time is >=
            // appointment start, preferring the closest match. If none found,
            // any remaining slot will do (the student gets notified either way).
            CounsellingSlot replacement = null;
            int chosenIdx = -1;
            for (int i = 0; i < replacementPool.size(); i++) {
                CounsellingSlot candidate = replacementPool.get(i);
                if (candidate.getStartTime().equals(appointment.getSlot().getStartTime())) {
                    replacement = candidate;
                    chosenIdx = i;
                    break;
                }
            }
            if (replacement == null && !replacementPool.isEmpty()) {
                replacement = replacementPool.get(0);
                chosenIdx = 0;
            }

            CounsellingSlot oldSlot = appointment.getSlot();

            if (replacement != null) {
                replacementPool.remove(chosenIdx);

                Counsellor oldCounsellor = appointment.getCounsellor();
                Counsellor newCounsellor = replacement.getCounsellor();

                // Point the appointment at the replacement slot + counsellor
                appointment.setSlot(replacement);
                appointment.setCounsellor(newCounsellor);
                replacement.setStatus("CONFIRMED");
                slotRepository.save(replacement);

                // Regenerate meet link for the new slot
                try {
                    String meetLink = meetingLinkService.generateMeetLink(appointment);
                    appointment.setMeetingLink(meetLink);
                } catch (Exception e) {
                    logger.warn("Failed to regenerate meet link after counsellor change for appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }
                appointmentRepository.save(appointment);

                // Notify the newly-assigned counsellor
                try {
                    notificationService.sendAssignedToCounsellorEmail(appointment);
                    if (newCounsellor != null && newCounsellor.getUser() != null) {
                        notificationService.createInAppNotification(
                                newCounsellor.getUser(),
                                "APPOINTMENT_ASSIGNED",
                                "New Counselling Session Assigned",
                                "A session has been reassigned to you because another counsellor blocked the date.",
                                appointment.getId(),
                                "APPOINTMENT");
                    }
                } catch (Exception e) {
                    logger.warn("Failed to notify replacement counsellor for appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                // Notify the student that their counsellor changed
                try {
                    User studentUser = new User();
                    studentUser.setId(appointment.getStudent().getUserId());
                    String oldName = oldCounsellor != null ? oldCounsellor.getName() : "your previous counsellor";
                    String newName = newCounsellor != null ? newCounsellor.getName() : "a new counsellor";
                    notificationService.createInAppNotification(
                            studentUser,
                            "COUNSELLOR_CHANGED",
                            "Counsellor Changed",
                            "Your counsellor has been changed from " + oldName + " to " + newName
                                    + ". The session date and time remain the same.",
                            appointment.getId(),
                            "APPOINTMENT");
                } catch (Exception e) {
                    logger.warn("Failed to notify student of counsellor change for appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                reassignedCount++;
            } else {
                // No replacement counsellor available — cancel the appointment
                // so the student isn't left with a phantom session.
                appointment.setStatus("CANCELLED");
                appointmentRepository.save(appointment);

                try {
                    User studentUser = new User();
                    studentUser.setId(appointment.getStudent().getUserId());
                    notificationService.createInAppNotification(
                            studentUser,
                            "APPOINTMENT_CANCELLED",
                            "Counselling Session Cancelled",
                            "Your counsellor has blocked the date and no replacement was available. "
                                    + "Please book a new session at your convenience.",
                            appointment.getId(),
                            "APPOINTMENT");
                } catch (Exception e) {
                    logger.warn("Failed to notify student of cancellation for appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                studentsCancelledCount++;
            }

            // Original slot of the blocked counsellor gets hard-blocked below.
            oldSlot.setStatus("CANCELLED");
            oldSlot.setIsBlocked(true);
            slotRepository.save(oldSlot);
        }

        // Block every remaining slot on that date (AVAILABLE ones with no appointment)
        for (CounsellingSlot slot : existingSlots) {
            if (!"CANCELLED".equals(slot.getStatus())) {
                slot.setStatus("CANCELLED");
                slot.setIsBlocked(true);
                slot.setBlockReason("Date blocked: " + (request.getReason() != null ? request.getReason() : ""));
                slotRepository.save(slot);
                cancelledCount++;
            }
        }

        logger.info("Block date approved: id={} counsellor={} date={} slotsCancelled={} reassigned={} cancelledAppointments={}",
                id, request.getCounsellor().getName(), blockDate, cancelledCount, reassignedCount, studentsCancelledCount);

        activityLogService.log("BLOCK_DATE_APPROVED", "Block Date Approved",
                request.getCounsellor().getName() + "'s request to block " + blockDate
                + " was approved. " + cancelledCount + " slot(s) cancelled, "
                + reassignedCount + " session(s) reassigned, "
                + studentsCancelledCount + " session(s) cancelled.",
                request.getCounsellor(), "Admin");

        return ResponseEntity.ok(request);
    }

    /** Admin rejects a request */
    @PutMapping("/reject/{id}")
    public ResponseEntity<?> reject(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        BlockDateRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("BlockDateRequest", "id", id));

        if (!"PENDING".equals(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request is not pending"));
        }

        request.setStatus("REJECTED");
        if (body != null && body.get("adminResponse") != null) {
            request.setAdminResponse((String) body.get("adminResponse"));
        }
        requestRepository.save(request);

        logger.info("Block date request rejected: id={} counsellor={} date={}",
                id, request.getCounsellor().getName(), request.getBlockDate());

        activityLogService.log("BLOCK_DATE_REJECTED", "Block Date Rejected",
                request.getCounsellor().getName() + "'s request to block " + request.getBlockDate() + " was rejected.",
                request.getCounsellor(), "Admin");

        return ResponseEntity.ok(request);
    }
}
