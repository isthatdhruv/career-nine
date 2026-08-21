package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.counselling.CounsellingSlot;

@Repository
public interface CounsellingSlotRepository extends JpaRepository<CounsellingSlot, Long> {

    List<CounsellingSlot> findByStatusAndDateBetween(String status, LocalDate start, LocalDate end);

    List<CounsellingSlot> findByCounsellorIdAndDateBetween(Long counsellorId, LocalDate start, LocalDate end);

    List<CounsellingSlot> findByCounsellorId(Long counsellorId);

    /**
     * Bookable slots in a date range.
     *
     * <p>Slots belonging to a suspended counsellor are excluded. Deactivation says the
     * counsellor "cannot sign in or be booked", but only the institute- and
     * assessment-scoped lookups enforced that; this unscoped query did not, so a suspended
     * counsellor's diary stayed offerable to anyone reaching it through the unscoped path
     * (the admin reschedule picker, for one). {@code isActive} is NULL-tolerant so rows
     * predating the flag are still treated as bookable.
     */
    @Query("SELECT s FROM CounsellingSlot s WHERE s.status = 'AVAILABLE' AND s.isBlocked = false "
            + "AND s.date BETWEEN :start AND :end "
            + "AND (s.counsellor IS NULL OR s.counsellor.isActive IS NULL OR s.counsellor.isActive = true) "
            + "ORDER BY s.date, s.startTime")
    List<CounsellingSlot> findAvailableSlots(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT s FROM CounsellingSlot s WHERE s.counsellor.id = :counsellorId AND s.date = :date AND s.template.id = :templateId")
    List<CounsellingSlot> findByCounsellorIdAndDateAndTemplateId(
            @Param("counsellorId") Long counsellorId,
            @Param("date") LocalDate date,
            @Param("templateId") Long templateId);

    List<CounsellingSlot> findByCounsellorIdAndDateAndIsBlockedTrue(Long counsellorId, LocalDate date);

    /** Bookable slots a counsellor still has from {@code today} onward. */
    @Query("SELECT COUNT(s) FROM CounsellingSlot s WHERE s.counsellor.id = :counsellorId "
         + "AND s.status = 'AVAILABLE' AND s.isBlocked = false AND s.date >= :today")
    long countUpcomingAvailable(@Param("counsellorId") Long counsellorId, @Param("today") LocalDate today);

    /**
     * Bookable slot count per counsellor from {@code today} onward, as [counsellorId, count]
     * rows — one query for the whole admin list rather than one call per counsellor.
     */
    @Query("SELECT s.counsellor.id, COUNT(s) FROM CounsellingSlot s WHERE s.status = 'AVAILABLE' "
         + "AND s.isBlocked = false AND s.date >= :today GROUP BY s.counsellor.id")
    List<Object[]> countUpcomingAvailableByCounsellor(@Param("today") LocalDate today);

    /** Soft-hold sweep: REQUESTED slots whose hold TTL has expired (Counselling Phase 3). */
    List<CounsellingSlot> findByStatusAndHeldUntilBefore(String status, LocalDateTime cutoff);

    /** Find available slots for a specific set of counsellors (institute-filtered) */
    @Query("SELECT s FROM CounsellingSlot s WHERE s.status = 'AVAILABLE' AND s.isBlocked = false "
         + "AND s.counsellor.id IN :counsellorIds AND s.date BETWEEN :start AND :end "
         + "ORDER BY s.date, s.startTime")
    List<CounsellingSlot> findAvailableSlotsForCounsellors(
            @Param("counsellorIds") List<Long> counsellorIds,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * All non-cancelled, non-blocked slots for a set of counsellors — both AVAILABLE and
     * already-taken (REQUESTED/BOOKED/CONFIRMED). The student picker shows the taken ones
     * greyed-out with a "Booked" badge so the day's real availability is visible.
     */
    @Query("SELECT s FROM CounsellingSlot s WHERE s.isBlocked = false AND s.status <> 'CANCELLED' "
         + "AND s.counsellor.id IN :counsellorIds AND s.date BETWEEN :start AND :end "
         + "ORDER BY s.date, s.startTime")
    List<CounsellingSlot> findActiveSlotsForCounsellors(
            @Param("counsellorIds") List<Long> counsellorIds,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /** Slots generated from one template — cleanup when that template is deleted. */
    List<CounsellingSlot> findByTemplateId(Long templateId);

    /** Nullify template_id on every slot — needed before deleting templates */
    @Modifying
    @Transactional
    @Query(value = "UPDATE counselling_slot SET template_id = NULL WHERE template_id IS NOT NULL", nativeQuery = true)
    int nullifyAllTemplateRefs();

    /** Bulk delete all AVAILABLE slots that were auto-generated (had a template ref) */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM counselling_slot WHERE status = 'AVAILABLE' AND is_manually_created = FALSE", nativeQuery = true)
    int deleteAutoGeneratedAvailableSlots();
}
