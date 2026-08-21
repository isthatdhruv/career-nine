package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.AvailabilityTemplateRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

/**
 * Removing a weekly schedule, and the tidying that has to follow it.
 *
 * <p>Kept out of the controllers because two of them need the same rules: deleting a
 * template deletes its unbooked inventory, and deleting the last slot a template still
 * has ahead of it deletes the template — otherwise "Weekly Schedule" keeps advertising
 * days that no longer produce a single bookable slot, which is exactly what a counsellor
 * sees when their templates have run past their end date.
 */
@Service
public class AvailabilityTemplateService {

    private static final Logger logger = LoggerFactory.getLogger(AvailabilityTemplateService.class);

    @Autowired
    private AvailabilityTemplateRepository templateRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    /** What removing one template actually did, so the UI can report it. */
    public static class DeletionResult {
        public final int slotsDeleted;
        public final int slotsKept;

        public DeletionResult(int slotsDeleted, int slotsKept) {
            this.slotsDeleted = slotsDeleted;
            this.slotsKept = slotsKept;
        }
    }

    /**
     * Delete a template together with the unbooked slots it generated.
     *
     * <p>Anything a student has a claim on is kept and merely detached from the template:
     * booked or blocked slots, and — the case that used to fail the whole request with a
     * 500 — slots an appointment row still points at even though the slot itself went back
     * to AVAILABLE (a reschedule leaves exactly that behind). The appointment's FK to the
     * slot makes the row undeletable, so it has to be spared rather than attempted.
     */
    @Transactional
    public DeletionResult deleteTemplate(Long templateId) {
        List<CounsellingSlot> slots = slotRepository.findByTemplateId(templateId);
        int deleted = 0, kept = 0;
        for (CounsellingSlot slot : slots) {
            if (isDeletable(slot)) {
                slotRepository.delete(slot);
                deleted++;
            } else {
                slot.setTemplate(null);
                slotRepository.save(slot);
                kept++;
            }
        }
        logger.info("Deleting availability template {}: removed {} unbooked slots, detached {} kept slots",
                templateId, deleted, kept);
        templateRepository.deleteById(templateId);
        return new DeletionResult(deleted, kept);
    }

    /**
     * Drop the template if it has nothing left to offer — no slot from today onward that is
     * still live. Called after a single slot is deleted so that clearing out a schedule's
     * remaining days removes the schedule row itself, instead of leaving a weekly rule on
     * screen that generates nothing.
     *
     * @return true if the template was removed
     */
    @Transactional
    public boolean deleteTemplateIfExhausted(Long templateId) {
        if (templateId == null) return false;
        if (slotRepository.countActiveFutureByTemplate(templateId, LocalDate.now()) > 0) return false;
        if (!templateRepository.existsById(templateId)) return false;
        logger.info("Availability template {} has no live slots left — removing it", templateId);
        deleteTemplate(templateId);
        return true;
    }

    /** A slot is ours to delete only when nobody holds it and no appointment points at it. */
    private boolean isDeletable(CounsellingSlot slot) {
        boolean unbooked = "AVAILABLE".equals(slot.getStatus()) && !Boolean.TRUE.equals(slot.getIsBlocked());
        return unbooked && !appointmentRepository.existsBySlot_Id(slot.getId());
    }
}
