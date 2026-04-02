package com.kccitm.api.controller.career9.counselling;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
import com.kccitm.api.service.counselling.SlotMaterializationService;

@RestController
@RequestMapping("/api/availability-template")
public class AvailabilityTemplateController {

    private static final Logger logger = LoggerFactory.getLogger(AvailabilityTemplateController.class);

    @Autowired
    private AvailabilityTemplateRepository templateRepository;

    @Autowired
    private SlotMaterializationService materializationService;

    @PostMapping("/create")
    public ResponseEntity<AvailabilityTemplate> create(@RequestBody AvailabilityTemplate template) {
        logger.info("Creating availability template for counsellor id: {}",
                template.getCounsellor() != null ? template.getCounsellor().getId() : null);
        AvailabilityTemplate saved = templateRepository.save(template);
        materializationService.materializeSlotsForCounsellor(saved.getCounsellor().getId());
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/get/by-counsellor/{counsellorId}")
    public ResponseEntity<List<AvailabilityTemplate>> getByCounsellorId(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(templateRepository.findByCounsellorId(counsellorId));
    }

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
            logger.info("Updating availability template with id: {}", id);
            return ResponseEntity.ok(templateRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        logger.info("Deleting availability template with id: {}", id);
        templateRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<AvailabilityTemplate> toggleActive(@PathVariable Long id) {
        return templateRepository.findById(id).map(template -> {
            template.setIsActive(!template.getIsActive());
            logger.info("Toggled active status for availability template id: {} to {}", id, template.getIsActive());
            return ResponseEntity.ok(templateRepository.save(template));
        }).orElse(ResponseEntity.notFound().build());
    }
}
