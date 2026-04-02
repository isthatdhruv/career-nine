package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/available")
    public ResponseEntity<List<CounsellingSlot>> getAvailable(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        LocalDate weekStart = (week != null) ? week : LocalDate.now();
        logger.info("Fetching available slots for week starting: {}", weekStart);
        List<CounsellingSlot> slots = bookingService.getAvailableSlots(weekStart);
        return ResponseEntity.ok(slots);
    }

    @PostMapping("/create-manual")
    public ResponseEntity<CounsellingSlot> createManual(@RequestBody CounsellingSlot slot) {
        logger.info("Creating manual counselling slot");
        slot.setIsManuallyCreated(true);
        slot.setStatus("AVAILABLE");
        slot.setIsBlocked(false);
        CounsellingSlot saved = slotRepository.save(slot);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/block-date")
    public ResponseEntity<CounsellingSlot> blockDate(@RequestBody CounsellingSlot slot) {
        logger.info("Blocking date for counselling slot");
        slot.setIsBlocked(true);
        slot.setStatus("CANCELLED");
        slot.setIsManuallyCreated(true);
        CounsellingSlot saved = slotRepository.save(slot);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        CounsellingSlot slot = slotRepository.findById(id).orElse(null);
        if (slot == null) {
            return ResponseEntity.notFound().build();
        }
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
