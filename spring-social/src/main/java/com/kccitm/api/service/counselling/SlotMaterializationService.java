package com.kccitm.api.service.counselling;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.AvailabilityTemplateRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

@Service
public class SlotMaterializationService {

    private static final Logger logger = LoggerFactory.getLogger(SlotMaterializationService.class);

    private static final int WEEKS_AHEAD = 4;

    @Autowired
    private AvailabilityTemplateRepository templateRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    /**
     * DEPRECATED: Scheduled auto-materialization disabled.
     * Slots are now created via SlotConfigurationController.applyToCounsellors()
     * when admin picks a saved configuration from the Manage Counsellors page.
     */
    public void materializeSlots() {
        List<AvailabilityTemplate> activeTemplates = templateRepository.findByIsActiveTrue();
        int totalCreated = 0;

        for (AvailabilityTemplate template : activeTemplates) {
            totalCreated += materializeSlotsForTemplate(template);
        }

        logger.info("SlotMaterializationService: total slots created = {}", totalCreated);
    }

    public int materializeSlotsForCounsellor(Long counsellorId) {
        return materializeSlotsForCounsellor(counsellorId, WEEKS_AHEAD);
    }

    public int materializeSlotsForCounsellor(Long counsellorId, int days) {
        List<AvailabilityTemplate> templates = templateRepository.findByCounsellorIdAndIsActiveTrue(counsellorId);
        int totalCreated = 0;

        for (AvailabilityTemplate template : templates) {
            totalCreated += materializeSlotsForTemplate(template, days);
        }

        logger.info("SlotMaterializationService: slots created for counsellor {} = {} (days={})", counsellorId, totalCreated, days);
        return totalCreated;
    }

    private int materializeSlotsForTemplate(AvailabilityTemplate template) {
        return materializeSlotsForTemplate(template, WEEKS_AHEAD);
    }

    private int materializeSlotsForTemplate(AvailabilityTemplate template, int days) {
        DayOfWeek templateDayOfWeek = DayOfWeek.valueOf(template.getDayOfWeek().toUpperCase());
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate endDate = LocalDate.now().plusDays(days);
        int created = 0;

        for (LocalDate date = tomorrow; !date.isAfter(endDate); date = date.plusDays(1)) {
            if (date.getDayOfWeek() != templateDayOfWeek) {
                continue;
            }

            // Skip if date is blocked for this counsellor
            List<CounsellingSlot> blockedSlots = slotRepository
                    .findByCounsellorIdAndDateAndIsBlockedTrue(template.getCounsellor().getId(), date);
            if (!blockedSlots.isEmpty()) {
                continue;
            }

            // Skip if slots already exist for this template + date
            List<CounsellingSlot> existingSlots = slotRepository
                    .findByCounsellorIdAndDateAndTemplateId(template.getCounsellor().getId(), date, template.getId());
            if (!existingSlots.isEmpty()) {
                continue;
            }

            // Generate slots for this date
            LocalTime slotStart = template.getStartTime();
            LocalTime slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());

            while (!slotEnd.isAfter(template.getEndTime())) {
                CounsellingSlot slot = new CounsellingSlot();
                slot.setCounsellor(template.getCounsellor());
                slot.setTemplate(template);
                slot.setDate(date);
                slot.setStartTime(slotStart);
                slot.setEndTime(slotEnd);
                slot.setDurationMinutes(template.getDefaultSlotDuration());
                slot.setStatus("AVAILABLE");
                slot.setIsManuallyCreated(false);
                slot.setIsBlocked(false);

                slotRepository.save(slot);
                created++;

                slotStart = slotEnd;
                slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());
            }
        }

        return created;
    }
}
