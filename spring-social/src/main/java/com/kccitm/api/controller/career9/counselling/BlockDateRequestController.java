package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
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
import com.kccitm.api.model.career9.counselling.BlockDateRequest;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.BlockDateRequestRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
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

        // Cancel all slots on that date for this counsellor
        List<CounsellingSlot> existingSlots = slotRepository.findByCounsellorIdAndDateBetween(
                request.getCounsellor().getId(), request.getBlockDate(), request.getBlockDate());
        int cancelledCount = 0;
        for (CounsellingSlot slot : existingSlots) {
            if (!"CANCELLED".equals(slot.getStatus())) {
                slot.setStatus("CANCELLED");
                slot.setIsBlocked(true);
                slot.setBlockReason("Date blocked: " + (request.getReason() != null ? request.getReason() : ""));
                slotRepository.save(slot);
                cancelledCount++;
            }
        }

        logger.info("Block date request approved: id={} counsellor={} date={} slotsCancelled={}",
                id, request.getCounsellor().getName(), request.getBlockDate(), cancelledCount);

        activityLogService.log("BLOCK_DATE_APPROVED", "Block Date Approved",
                request.getCounsellor().getName() + "'s request to block " + request.getBlockDate()
                + " was approved. " + cancelledCount + " slot(s) cancelled.",
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
