package com.kccitm.api.service.counselling;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.SlotConfiguration;
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
        /**
         * Slots that fell in the part of today that has already gone by. Counted apart from
         * {@link #skipped} because "you asked for a time that has passed" and "that time is
         * already covered" need different answers in the UI.
         */
        public final int past;
        public MaterializationResult(int created, int skipped) {
            this(created, skipped, 0);
        }
        public MaterializationResult(int created, int skipped, int past) {
            this.created = created;
            this.skipped = skipped;
            this.past = past;
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
        // A suspended counsellor's weekly rules must stop producing bookable hours —
        // otherwise every materialization run quietly restocks a diary nobody may
        // book. The templates stay; generation resumes if the counsellor is reactivated.
        if (template.getCounsellor() != null
                && Boolean.FALSE.equals(template.getCounsellor().getIsActive())) {
            return new MaterializationResult(0, 0, 0);
        }
        DayOfWeek templateDayOfWeek = DayOfWeek.valueOf(template.getDayOfWeek().toUpperCase());
        LocalDate today = LocalDate.now();
        // Honour the template's effective start date: materialize from max(startDate, today).
        //
        // Today counts. Generation used to begin at tomorrow, which silently made same-day
        // availability impossible: a schedule dated for today alone produced an empty window
        // (start = tomorrow, end = today), created nothing, and was discarded — so setting up
        // "today 13:00–18:00" at noon appeared to do nothing at all. Today's hours that have
        // already gone by are dropped slot by slot below, which is the part that actually
        // needs excluding; the rest of today is bookable.
        LocalDate start = (template.getStartDate() != null && template.getStartDate().isAfter(today))
                ? template.getStartDate()
                : today;
        LocalDate endDate = start.plusDays(days);
        // Honour the template's last effective date: never generate past it. A window
        // that ends before it begins yields nothing, which the caller reports.
        if (template.getEndDate() != null && template.getEndDate().isBefore(endDate)) {
            endDate = template.getEndDate();
        }
        // Read the clock once: a run that straddles a minute boundary would otherwise apply
        // two different cut-offs to the same day's slots.
        LocalTime now = LocalTime.now();
        int created = 0;
        int skipped = 0;
        int past = 0;

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

            // Generate slots for this date. Consecutive slots are separated by the
            // template's break (0/NULL = back-to-back, the historic behaviour).
            boolean isToday = date.equals(today);
            int breakMinutes = template.getBreakMinutes() != null && template.getBreakMinutes() > 0
                    ? template.getBreakMinutes() : 0;
            LocalTime slotStart = template.getStartTime();
            LocalTime slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());

            while (!slotEnd.isAfter(template.getEndTime())) {
                if (isToday && !slotStart.isAfter(now)) {
                    // Already started (or starting this instant) — nobody can book it, so it is
                    // not worth a row. Only today can hit this; every other date is in the future.
                    past++;
                } else if (overlapsExisting(sameDay, slotStart, slotEnd)) {
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

                slotStart = slotEnd.plusMinutes(breakMinutes);
                slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());
                // LocalTime wraps at midnight — a wrapped end reads as "early morning",
                // which would slip past the endTime guard and loop forever.
                if (slotEnd.isBefore(slotStart)) break;
            }
        }

        return new MaterializationResult(created, skipped, past);
    }

    /**
     * Materialize a saved {@link SlotConfiguration} onto one counsellor, covering every date in
     * the config's range. This is the admin "apply a configuration to these counsellors" path;
     * {@link #materializeForTemplate} is the counsellor's own recurring-availability path. They
     * describe availability differently — a config is a flat date range with an optional lunch
     * break, a template is a weekday rule — but they produce the same {@code CounsellingSlot}
     * rows, so slot creation and conflict detection live here for both.
     *
     * <p>A config has no weekday and no mode of its own, so — exactly as the controller loop did
     * before — config slots are left untemplated and keep {@code CounsellingSlot}'s own default
     * mode, rather than being given one here.
     */
    public MaterializationResult materializeForConfiguration(Counsellor counsellor, SlotConfiguration config) {
        int created = 0;
        int skipped = 0;
        for (LocalDate date = config.getStartDate(); !date.isAfter(config.getEndDate()); date = date.plusDays(1)) {
            MaterializationResult day = materializeConfigForDay(counsellor, config, date);
            created += day.created;
            skipped += day.skipped;
        }
        return new MaterializationResult(created, skipped);
    }

    /** One counsellor, one date: walk the config's window in slot-sized steps, skipping the break. */
    private MaterializationResult materializeConfigForDay(Counsellor counsellor, SlotConfiguration config,
            LocalDate date) {
        // Every slot the counsellor already has that day, so a generated slot that would land on
        // top of one is skipped rather than created. Newly created slots are appended as we go,
        // so later steps in this same run see them too.
        List<CounsellingSlot> sameDay = new ArrayList<>(
                slotRepository.findByCounsellorIdAndDateBetween(counsellor.getId(), date, date));

        int created = 0;
        int skipped = 0;
        LocalTime cursor = config.getStartTime();

        while (true) {
            LocalTime slotEnd = cursor.plusMinutes(config.getSlotDuration());
            if (slotEnd.isAfter(config.getEndTime())) break;

            // Jump the cursor past the break rather than generating a slot inside or across it.
            if (Boolean.TRUE.equals(config.getHasBreak())
                    && config.getBreakStart() != null && config.getBreakEnd() != null) {
                boolean startsInBreak = !cursor.isBefore(config.getBreakStart())
                        && cursor.isBefore(config.getBreakEnd());
                boolean runsIntoBreak = cursor.isBefore(config.getBreakStart())
                        && slotEnd.isAfter(config.getBreakStart());
                if (startsInBreak || runsIntoBreak) {
                    // A break that ends at or before the cursor (breakEnd < breakStart, say)
                    // would leave the cursor where it is and spin forever. Stop the day instead.
                    if (!config.getBreakEnd().isAfter(cursor)) {
                        logger.warn("Slot configuration {} has a break ending at or before {} — "
                                + "stopping generation for counsellor {} on {}",
                                config.getId(), cursor, counsellor.getId(), date);
                        break;
                    }
                    cursor = config.getBreakEnd();
                    continue;
                }
            }

            if (overlapsExisting(sameDay, cursor, slotEnd)) {
                skipped++;
            } else {
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
                sameDay.add(slot);
                created++;
            }

            cursor = slotEnd;
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
