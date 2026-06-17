package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.counselling.BookingService;

@RestController
@RequestMapping("/api/counselling-slot")
public class CounsellingSlotController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingSlotController.class);

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private BookingService bookingService;

    @PreAuthorize("@auth.allows('counselling.slot.read', #instituteCode, null, null, null)")
    @GetMapping("/available")
    public ResponseEntity<List<CounsellingSlot>> getAvailable(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week,
            @RequestParam(required = false) Integer instituteCode) {
        LocalDate weekStart = (week != null) ? week : LocalDate.now();

        List<CounsellingSlot> slots;
        if (instituteCode != null) {
            logger.info("Fetching available slots for week {} filtered by institute {}", weekStart, instituteCode);
            slots = bookingService.getAvailableSlotsForInstitute(weekStart, instituteCode);
        } else {
            logger.info("Fetching available slots for week starting: {}", weekStart);
            slots = bookingService.getAvailableSlots(weekStart);
        }
        return ResponseEntity.ok(slots);
    }

    // no scope arg: body is CounsellingSlot; admin manual slot creation
    @PreAuthorize("@auth.allows('counselling.slot.create')")
    @PostMapping("/create-manual")
    public ResponseEntity<?> createManual(@RequestBody CounsellingSlot slot) {
        logger.info("Creating manual counselling slot");

        Long counsellorId = slot.getCounsellor() != null ? slot.getCounsellor().getId() : null;
        if (counsellorId == null || slot.getDate() == null
                || slot.getStartTime() == null || slot.getEndTime() == null) {
            return ResponseEntity.badRequest()
                    .body("Counsellor, date, start time and end time are required.");
        }
        if (!slot.getStartTime().isBefore(slot.getEndTime())) {
            return ResponseEntity.badRequest().body("Start time must be before end time.");
        }
        // Default the delivery mode when the client didn't send one.
        if (slot.getMode() == null || slot.getMode().isBlank()) {
            slot.setMode("ONLINE");
        }

        // No double-booking: reject a slot that overlaps an existing active slot (any mode)
        // on the same date. An existing ONLINE slot blocks an OFFLINE slot at the same time,
        // and vice versa — the counsellor can't run two sessions at once.
        List<CounsellingSlot> sameDay =
                slotRepository.findByCounsellorIdAndDateBetween(counsellorId, slot.getDate(), slot.getDate());
        CounsellingSlot conflict = firstOverlap(sameDay, slot.getStartTime(), slot.getEndTime());
        if (conflict != null) {
            String mode = "OFFLINE".equals(conflict.getMode()) ? "In-person" : "Online";
            String msg = String.format(
                    "You already have an %s slot at %s–%s on %s. Pick a different time.",
                    mode, conflict.getStartTime(), conflict.getEndTime(), slot.getDate());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(msg);
        }

        slot.setIsManuallyCreated(true);
        slot.setStatus("AVAILABLE");
        slot.setIsBlocked(false);
        CounsellingSlot saved = slotRepository.save(slot);
        return ResponseEntity.ok(saved);
    }

    /** First active (non-cancelled, non-blocked) slot in the list that overlaps [start, end), or null. */
    private static CounsellingSlot firstOverlap(List<CounsellingSlot> sameDay,
            java.time.LocalTime start, java.time.LocalTime end) {
        for (CounsellingSlot ex : sameDay) {
            if (Boolean.TRUE.equals(ex.getIsBlocked()) || "CANCELLED".equals(ex.getStatus())) continue;
            if (ex.getStartTime() == null || ex.getEndTime() == null) continue;
            if (ex.getStartTime().isBefore(end) && start.isBefore(ex.getEndTime())) {
                return ex;
            }
        }
        return null;
    }

    // no scope arg: body is CounsellingSlot; admin block-date action
    @PreAuthorize("@auth.allows('counselling.slot.update')")
    @PostMapping("/block-date")
    public ResponseEntity<CounsellingSlot> blockDate(@RequestBody CounsellingSlot slot) {
        logger.info("Blocking date for counselling slot");
        slot.setIsBlocked(true);
        slot.setStatus("CANCELLED");
        slot.setIsManuallyCreated(true);
        CounsellingSlot saved = slotRepository.save(slot);
        return ResponseEntity.ok(saved);
    }

    // no scope arg: delete by id; admin-only
    @PreAuthorize("@auth.allows('counselling.slot.delete')")
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        CounsellingSlot slot = slotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingSlot", "id", id));
        boolean isDeletable = "AVAILABLE".equals(slot.getStatus()) || Boolean.TRUE.equals(slot.getIsBlocked());
        if (!isDeletable) {
            logger.warn("Cannot delete slot {} with status {}", id, slot.getStatus());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Cannot delete slot: only AVAILABLE or blocked slots can be deleted.");
        }
        slotRepository.deleteById(id);
        logger.info("Deleted counselling slot {}", id);
        return ResponseEntity.ok().build();
    }

    // no scope arg: identifies by counsellorId
    @PreAuthorize("@auth.allows('counselling.slot.read')")
    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellingSlot>> getByCounsellor(
            @PathVariable Long counsellorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        logger.info("Fetching slots for counsellor {}", counsellorId);
        List<CounsellingSlot> slots;
        if (start != null && end != null) {
            slots = slotRepository.findByCounsellorIdAndDateBetween(counsellorId, start, end);
        } else {
            slots = slotRepository.findByCounsellorId(counsellorId);
        }
        return ResponseEntity.ok(slots);
    }
}
