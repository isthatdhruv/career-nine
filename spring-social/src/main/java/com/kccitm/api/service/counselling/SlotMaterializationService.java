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
    /** Outcome of a materialization run: slots created vs slots skipped for overlapping an existing slot. */
    public static class MaterializationResult {
        public final int created;
        public final int skipped;
        public MaterializationResult(int created, int skipped) {
            this.created = created;
            this.skipped = skipped;
        }
    }

    public void materializeSlots() {
        List<AvailabilityTemplate> activeTemplates = templateRepository.findByIsActiveTrue();
        int totalCreated = 0;

        for (AvailabilityTemplate template : activeTemplates) {
            totalCreated += materializeSlotsForTemplate(template).created;
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
            totalCreated += materializeSlotsForTemplate(template, days).created;
        }

        logger.info("SlotMaterializationService: slots created for counsellor {} = {} (days={})", counsellorId, totalCreated, days);
        return totalCreated;
    }

    /**
     * Materialize a single template's slots (used right after a template is created) and
     * report how many slots were skipped for overlapping an existing slot — so the UI can
     * tell the counsellor "N slot(s) skipped because they conflicted with existing times".
     */
    public MaterializationResult materializeForTemplate(AvailabilityTemplate template, int days) {
        return materializeSlotsForTemplate(template, days);
    }

    private MaterializationResult materializeSlotsForTemplate(AvailabilityTemplate template) {
        return materializeSlotsForTemplate(template, WEEKS_AHEAD);
    }

    private MaterializationResult materializeSlotsForTemplate(AvailabilityTemplate template, int days) {
        DayOfWeek templateDayOfWeek = DayOfWeek.valueOf(template.getDayOfWeek().toUpperCase());
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        // Honour the template's effective start date: materialize from max(startDate, tomorrow).
        LocalDate start = (template.getStartDate() != null && template.getStartDate().isAfter(tomorrow))
                ? template.getStartDate()
                : tomorrow;
        LocalDate endDate = start.plusDays(days);
        int created = 0;
        int skipped = 0;

        for (LocalDate date = start; !date.isAfter(endDate); date = date.plusDays(1)) {
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

            // All other active slots on this date (any template / manual, any mode) — used
            // to skip generating a slot that would overlap one the counsellor already has.
            // A counsellor can't run two sessions at once, so an existing ONLINE slot also
            // blocks an OFFLINE slot at the same time (and vice versa).
            List<CounsellingSlot> sameDay = slotRepository
                    .findByCounsellorIdAndDateBetween(template.getCounsellor().getId(), date, date);

            // Generate slots for this date
            LocalTime slotStart = template.getStartTime();
            LocalTime slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());

            while (!slotEnd.isAfter(template.getEndTime())) {
                if (overlapsExisting(sameDay, slotStart, slotEnd)) {
                    // Conflicts with an existing slot — skip this one, keep generating the rest.
                    skipped++;
                } else {
                    CounsellingSlot slot = new CounsellingSlot();
                    slot.setCounsellor(template.getCounsellor());
                    slot.setTemplate(template);
                    slot.setDate(date);
                    slot.setStartTime(slotStart);
                    slot.setEndTime(slotEnd);
                    slot.setDurationMinutes(template.getDefaultSlotDuration());
                    slot.setMode(template.getMode());
                    slot.setStatus("AVAILABLE");
                    slot.setIsManuallyCreated(false);
                    slot.setIsBlocked(false);

                    slotRepository.save(slot);
                    sameDay.add(slot); // so later slots in this run also see it
                    created++;
                }

                slotStart = slotEnd;
                slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());
            }
        }

        return new MaterializationResult(created, skipped);
    }

    /**
     * True if [start, end) overlaps any active (non-cancelled, non-blocked) slot in the list.
     * Two half-open intervals overlap iff each starts before the other ends.
     */
    public static boolean overlapsExisting(List<CounsellingSlot> sameDay, LocalTime start, LocalTime end) {
        for (CounsellingSlot ex : sameDay) {
            if (Boolean.TRUE.equals(ex.getIsBlocked()) || "CANCELLED".equals(ex.getStatus())) continue;
            if (ex.getStartTime() == null || ex.getEndTime() == null) continue;
            if (ex.getStartTime().isBefore(end) && start.isBefore(ex.getEndTime())) {
                return true;
            }
        }
        return false;
    }
}
