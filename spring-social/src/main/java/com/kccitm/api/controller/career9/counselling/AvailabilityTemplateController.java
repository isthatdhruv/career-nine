package com.kccitm.api.controller.career9.counselling;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import com.kccitm.api.repository.Career9.counselling.AvailabilityTemplateRepository;
import com.kccitm.api.service.counselling.AvailabilityTemplateService;
import com.kccitm.api.service.counselling.SlotMaterializationService;

@RestController
@RequestMapping("/api/availability-template")
public class AvailabilityTemplateController {

    private static final Logger logger = LoggerFactory.getLogger(AvailabilityTemplateController.class);

    @Autowired
    private AvailabilityTemplateRepository templateRepository;

    @Autowired
    private SlotMaterializationService materializationService;

    @Autowired
    private AvailabilityTemplateService templateService;

    // no scope arg: body is AvailabilityTemplate; counsellor-scoped admin
    @PreAuthorize("@auth.allows('counselling.availability_template.create')")
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody AvailabilityTemplate template,
            @org.springframework.web.bind.annotation.RequestParam(required = false, defaultValue = "30") int days) {
        logger.info("Creating availability template for counsellor id: {}, days: {}",
                template.getCounsellor() != null ? template.getCounsellor().getId() : null, days);
        AvailabilityTemplate saved = templateRepository.save(template);
        // Materialize just this template's slots; overlapping slots (a time the counsellor
        // already has a slot for, in any mode) are skipped — the rest are created.
        SlotMaterializationService.MaterializationResult result =
                materializationService.materializeForTemplate(saved, days);

        java.util.Map<String, Object> body = new java.util.HashMap<>();
        if (result.created == 0) {
            // Every slot clashed with one that already exists, had already passed today, or
            // the range yields none — so this template produced no bookable time. Keeping it
            // would leave a phantom row in "Weekly Schedule" promising availability that isn't
            // in Upcoming Slots. Nothing references it yet, so drop it again.
            templateRepository.delete(saved);
            logger.info("Discarded availability template for counsellor {} on {}: 0 slots created, {} skipped, {} already past",
                    saved.getCounsellor() != null ? saved.getCounsellor().getId() : null,
                    saved.getDayOfWeek(), result.skipped, result.past);
            body.put("template", null);
            body.put("discarded", true);
        } else {
            body.put("template", saved);
            body.put("discarded", false);
        }
        body.put("slotsCreated", result.created);
        body.put("slotsSkipped", result.skipped);
        // Distinct from slotsSkipped: these were dropped for being in the part of today that
        // has already gone by, not for clashing. The UI says something different for each.
        body.put("slotsPast", result.past);
        return ResponseEntity.ok(body);
    }

    // no scope arg: identifies by counsellorId; scope-filter narrows access
    @PreAuthorize("@auth.allows('counselling.availability_template.read')")
    @GetMapping("/get/by-counsellor/{counsellorId}")
    public ResponseEntity<List<AvailabilityTemplate>> getByCounsellorId(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(templateRepository.findByCounsellorId(counsellorId));
    }

    // no scope arg: update by id; scope-filter narrows access
    @PreAuthorize("@auth.allows('counselling.availability_template.update')")
    @PutMapping("/update/{id}")
    public ResponseEntity<AvailabilityTemplate> update(@PathVariable Long id,
            @RequestBody AvailabilityTemplate updated) {
        return templateRepository.findById(id).map(existing -> {
            if (updated.getDayOfWeek() != null) {
                existing.setDayOfWeek(updated.getDayOfWeek());
            }
            if (updated.getStartTime() != null) {
                existing.setStartTime(updated.getStartTime());
            }
            if (updated.getEndTime() != null) {
                existing.setEndTime(updated.getEndTime());
            }
            if (updated.getDefaultSlotDuration() != null) {
                existing.setDefaultSlotDuration(updated.getDefaultSlotDuration());
            }
            if (updated.getMode() != null) {
                existing.setMode(updated.getMode());
            }
            if (updated.getStartDate() != null) {
                existing.setStartDate(updated.getStartDate());
            }
            if (updated.getEndDate() != null) {
                existing.setEndDate(updated.getEndDate());
            }
            logger.info("Updating availability template with id: {}", id);
            return ResponseEntity.ok(templateRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    // no scope arg: delete by id; scope-filter narrows access
    @PreAuthorize("@auth.allows('counselling.availability_template.delete')")
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!templateRepository.existsById(id)) {
            // Already gone — two people removing the same row, or a stale list. Nothing to
            // do and nothing wrong, so don't fail the caller over it.
            return ResponseEntity.ok().build();
        }
        AvailabilityTemplateService.DeletionResult result = templateService.deleteTemplate(id);
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("slotsDeleted", result.slotsDeleted);
        body.put("slotsKept", result.slotsKept);
        return ResponseEntity.ok(body);
    }

    /**
     * Remove several weekly schedules in one go — what the "select all / remove selected"
     * control on the availability screen calls. Each id is deleted in its own transaction
     * so one bad row cannot take the rest of the batch down with it; the response says
     * exactly which ones failed.
     */
    // no scope arg: delete by ids; scope-filter narrows access
    @PreAuthorize("@auth.allows('counselling.availability_template.delete')")
    @PostMapping("/delete-batch")
    public ResponseEntity<?> deleteBatch(@RequestBody java.util.Map<String, List<Long>> payload) {
        List<Long> ids = payload != null ? payload.get("ids") : null;
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body("No schedules selected.");
        }
        List<Long> deletedIds = new java.util.ArrayList<>();
        List<Long> failedIds = new java.util.ArrayList<>();
        int slotsDeleted = 0, slotsKept = 0;
        for (Long id : ids) {
            if (id == null) continue;
            try {
                if (!templateRepository.existsById(id)) {
                    deletedIds.add(id);
                    continue;
                }
                AvailabilityTemplateService.DeletionResult result = templateService.deleteTemplate(id);
                slotsDeleted += result.slotsDeleted;
                slotsKept += result.slotsKept;
                deletedIds.add(id);
            } catch (RuntimeException e) {
                logger.error("Failed to delete availability template {} in batch", id, e);
                failedIds.add(id);
            }
        }
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("deletedIds", deletedIds);
        body.put("failedIds", failedIds);
        body.put("slotsDeleted", slotsDeleted);
        body.put("slotsKept", slotsKept);
        logger.info("Batch template delete: {} removed, {} failed, {} slots deleted, {} slots kept",
                deletedIds.size(), failedIds.size(), slotsDeleted, slotsKept);
        return ResponseEntity.ok(body);
    }

    // no scope arg: toggle by id; scope-filter narrows access
    @PreAuthorize("@auth.allows('counselling.availability_template.update')")
    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<AvailabilityTemplate> toggleActive(@PathVariable Long id) {
        return templateRepository.findById(id).map(template -> {
            template.setIsActive(!template.getIsActive());
            logger.info("Toggled active status for availability template id: {} to {}", id, template.getIsActive());
            return ResponseEntity.ok(templateRepository.save(template));
        }).orElse(ResponseEntity.notFound().build());
    }
}
