package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.SlotConfiguration;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.SlotConfigurationRepository;

@RestController
@RequestMapping("/api/slot-configuration")
public class SlotConfigurationController {

    private static final Logger logger = LoggerFactory.getLogger(SlotConfigurationController.class);

    @Autowired
    private SlotConfigurationRepository configRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    /** Save a new slot configuration */
    @PostMapping("/create")
    public ResponseEntity<SlotConfiguration> create(@RequestBody SlotConfiguration config) {
        SlotConfiguration saved = configRepository.save(config);
        logger.info("Created slot configuration: {} (id={})", saved.getName(), saved.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /** Get all saved configurations */
    @GetMapping("/getAll")
    public ResponseEntity<List<SlotConfiguration>> getAll() {
        return ResponseEntity.ok(configRepository.findAllOrderByCreatedAtDesc());
    }

    /** Delete a configuration */
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        configRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Apply a saved configuration to specific counsellors.
     * Generates actual CounsellingSlot rows for each counsellor
     * for every day in the config's date range.
     *
     * Body: { configId: Long, counsellorIds: [Long] }
     */
    @SuppressWarnings("unchecked")
    @PostMapping("/apply")
    public ResponseEntity<?> applyToCounsellors(@RequestBody Map<String, Object> body) {
        Long configId = ((Number) body.get("configId")).longValue();
        List<Number> idList = (List<Number>) body.get("counsellorIds");

        SlotConfiguration config = configRepository.findById(configId)
                .orElseThrow(() -> new ResourceNotFoundException("SlotConfiguration", "id", configId));

        int totalSlots = 0;
        int counsellorsProcessed = 0;

        for (Number idNum : idList) {
            Long counsellorId = idNum.longValue();
            Counsellor counsellor = counsellorRepository.findById(counsellorId).orElse(null);
            if (counsellor == null) continue;

            // Generate slots for each day in the date range
            LocalDate date = config.getStartDate();
            while (!date.isAfter(config.getEndDate())) {
                totalSlots += generateSlotsForDay(counsellor, config, date);
                date = date.plusDays(1);
            }
            counsellorsProcessed++;
        }

        logger.info("Applied config {} to {} counsellors, created {} slots",
                configId, counsellorsProcessed, totalSlots);

        return ResponseEntity.ok(Map.of(
                "counsellorsProcessed", counsellorsProcessed,
                "totalSlots", totalSlots));
    }

    /** Generate slot rows for a single counsellor on a single day using the config */
    private int generateSlotsForDay(Counsellor counsellor, SlotConfiguration config, LocalDate date) {
        int created = 0;

        // Pre-fetch existing slots for this counsellor on this date
        List<CounsellingSlot> existing = slotRepository.findByCounsellorIdAndDateBetween(
                counsellor.getId(), date, date);

        LocalTime cursor = config.getStartTime();

        while (true) {
            LocalTime slotEnd = cursor.plusMinutes(config.getSlotDuration());
            if (slotEnd.isAfter(config.getEndTime())) break;

            // Skip if cursor falls within break time
            if (Boolean.TRUE.equals(config.getHasBreak())
                    && config.getBreakStart() != null && config.getBreakEnd() != null) {
                if (!cursor.isBefore(config.getBreakStart()) && cursor.isBefore(config.getBreakEnd())) {
                    cursor = config.getBreakEnd();
                    continue;
                }
                if (cursor.isBefore(config.getBreakStart()) && slotEnd.isAfter(config.getBreakStart())) {
                    cursor = config.getBreakEnd();
                    continue;
                }
            }

            // Check for duplicate
            final LocalTime checkStart = cursor;
            final LocalTime checkEnd = slotEnd;
            boolean duplicate = existing.stream().anyMatch(s ->
                    s.getStartTime().equals(checkStart) && s.getEndTime().equals(checkEnd));

            if (!duplicate) {
                CounsellingSlot slot = new CounsellingSlot();
                slot.setCounsellor(counsellor);
                slot.setDate(date);
                slot.setStartTime(cursor);
                slot.setEndTime(slotEnd);
                slot.setDurationMinutes(config.getSlotDuration());
                slot.setStatus("AVAILABLE");
                slot.setIsManuallyCreated(false);
                slot.setIsBlocked(false);
                slotRepository.save(slot);
                created++;
            }

            cursor = slotEnd;
        }

        return created;
    }
}
