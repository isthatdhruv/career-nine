package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;

@Repository
public interface CounsellingAppointmentRepository extends JpaRepository<CounsellingAppointment, Long> {

    List<CounsellingAppointment> findByStatus(String status);

    /** True if an appointment already exists for the slot (a hold became a real booking). */
    boolean existsBySlot_Id(Long slotId);

    List<CounsellingAppointment> findByStudentUserStudentId(Long userStudentId);

    List<CounsellingAppointment> findByCounsellorId(Long counsellorId);

    // Admin booking: which of these students already have an UPCOMING, still-active
    // counselling appointment (slot today or later, not cancelled/missed/etc.). Used to
    // surface the "already booked" list the admin chooses whether to re-book, and to skip
    // them by default during bulk allotment. Returns student ids only — one batch query.
    @Query("SELECT DISTINCT a.student.userStudentId FROM CounsellingAppointment a " +
           "WHERE a.student.userStudentId IN :studentIds " +
           "AND a.status NOT IN ('CANCELLED', 'MISSED', 'RESCHEDULED', 'DECLINED') " +
           "AND a.slot.date >= :today")
    List<Long> findStudentIdsWithUpcomingAppointment(
            @Param("studentIds") List<Long> studentIds,
            @Param("today") LocalDate today);

    // Dashboard release: which of these students have actually been counselled — a
    // completed appointment, not merely an assigned counsellor. The distinction matters
    // because the figure is printed in a school's report as "students counselled".
    // Student ids only, one batch query for the whole institute.
    @Query("SELECT DISTINCT a.student.userStudentId FROM CounsellingAppointment a " +
           "WHERE a.student.userStudentId IN :studentIds " +
           "AND UPPER(a.status) = 'COMPLETED'")
    List<Long> findCounselledStudentIds(@Param("studentIds") List<Long> studentIds);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.student.userStudentId = :studentId " +
           "ORDER BY a.slot.date DESC, a.slot.startTime DESC")
    List<CounsellingAppointment> findByStudentIdOrdered(@Param("studentId") Long studentId);

    // Admin booking: the actual upcoming, still-active appointments (slot + counsellor eager) for
    // these students, earliest first. The bulk-allotment preview maps each student to their
    // earliest upcoming session so the "already booked" list can show with whom and when, and
    // offer a counsellor change. Companion to findStudentIdsWithUpcomingAppointment (same filter).
    @Query("SELECT a FROM CounsellingAppointment a " +
           "WHERE a.student.userStudentId IN :studentIds " +
           "AND a.status NOT IN ('CANCELLED', 'MISSED', 'RESCHEDULED', 'DECLINED') " +
           "AND a.slot.date >= :today " +
           "ORDER BY a.slot.date ASC, a.slot.startTime ASC")
    List<CounsellingAppointment> findUpcomingAppointmentsForStudents(
            @Param("studentIds") List<Long> studentIds,
            @Param("today") LocalDate today);

    /**
     * A counsellor's still-to-happen online sessions — used to re-point their meeting link
     * when they change the permanent Teams room it points at.
     */
    @Query("SELECT a FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId "
         + "AND a.slot.date >= :fromDate AND a.mode = 'ONLINE' "
         + "AND a.status IN ('PENDING', 'ASSIGNED', 'CONFIRMED', 'AWAITING_RESCHEDULE')")
    List<CounsellingAppointment> findUpcomingOnlineByCounsellor(
            @Param("counsellorId") Long counsellorId,
            @Param("fromDate") java.time.LocalDate fromDate);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId " +
           "AND a.slot.date = :date " +
           "ORDER BY a.slot.startTime ASC")
    List<CounsellingAppointment> findByCounsellorIdAndDate(
            @Param("counsellorId") Long counsellorId,
            @Param("date") LocalDate date);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' " +
           "AND a.reminder24hSent = false " +
           "AND a.slot.date = :targetDate")
    List<CounsellingAppointment> findNeedingReminder24h(@Param("targetDate") LocalDate targetDate);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' " +
           "AND a.reminder1hSent = false " +
           "AND a.slot.date = :targetDate " +
           "AND a.slot.startTime BETWEEN :startTime AND :endTime")
    List<CounsellingAppointment> findNeedingReminder1h(
            @Param("targetDate") LocalDate targetDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.status = :status")
    Long countByStatus(@Param("status") String status);

    // Reminder scheduler: confirmed appointments whose slot date falls in the
    // window [start, end]. The scheduler then computes minutes-until-start in
    // Java and decides which offsets (12h/4h/2h/15m) are due. A 12h offset can
    // reach into tomorrow, so callers pass [today, today+1].
    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' " +
           "AND a.slot.date BETWEEN :start AND :end")
    List<CounsellingAppointment> findConfirmedBetween(
            @Param("start") LocalDate start, @Param("end") LocalDate end);

    // 8pm day-before digest: all confirmed appointments for a given date.
    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' " +
           "AND a.slot.date = :date ORDER BY a.counsellor.id ASC, a.slot.startTime ASC")
    List<CounsellingAppointment> findConfirmedOnDate(@Param("date") LocalDate date);

    // Dashboard summary: count by counsellor + status across a date window.
    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId " +
           "AND a.status = :status AND a.slot.date BETWEEN :start AND :end")
    Long countByCounsellorAndStatusInRange(
            @Param("counsellorId") Long counsellorId, @Param("status") String status,
            @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED') " +
           "AND a.slot.date BETWEEN :start AND :end")
    Long countActiveInWeek(@Param("start") LocalDate start, @Param("end") LocalDate end);

    // Lifecycle sweep (Counselling Phase 2): still-active sessions whose slot date is
    // today or earlier. The scheduler computes the slot end datetime in Java and closes
    // those whose end has passed — verified -> COMPLETED, never-checked-in -> MISSED.
    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status IN ('CONFIRMED', 'IN_PROGRESS') " +
           "AND a.slot.date <= :today")
    List<CounsellingAppointment> findActiveUpToDate(@Param("today") LocalDate today);

    // ─── Cancellation / no-show (docs/COUNSELLING_CANCELLATION.md) ───────────────

    /**
     * The student's used misses on one entitlement — cancellations she made plus no-shows
     * confirmed against her, in a single query.
     *
     * <p>Two exclusions matter. Only {@code STUDENT}-attributed rows count, so a counsellor
     * or admin cancellation never eats her allowance. A no-show with a dispute raised but not
     * yet resolved is skipped: an open dispute is not evidence, so the strike stays suspended
     * until someone decides (a dispute resolved against her keeps
     * {@code missedByRole = STUDENT} plus a resolution timestamp, and does count).
     *
     * <p>Attribution, not status, decides: a session she rescheduled carries
     * {@code cancelledByRole = STUDENT} on the abandoned row exactly like one she cancelled,
     * so both spend an allowance. Whatever the system imposed on her does not — a parked
     * session (counsellor dropped out, nothing offered in return) is never attributed to her.
     *
     * <p>Note the force-shift exemption applies to cancellations only. Failing to attend a
     * shifted session is still recorded against her, subject to admin discretion.
     *
     * <p>Counted per entitlement rather than per appointment because cancelling abandons the
     * row — any counter stored on the appointment resets the moment she rebooks.
     */
    @Query("SELECT COUNT(a) FROM CounsellingAppointment a "
         + "WHERE a.entitlementId = :entitlementId AND ("
         + "  (a.cancelledByRole = 'STUDENT') "
         + "  OR (a.missedByRole = 'STUDENT' "
         + "      AND (a.disputeRaisedAt IS NULL OR a.disputeResolvedAt IS NOT NULL))"
         + ")")
    Long countStudentMissesForEntitlement(@Param("entitlementId") Long entitlementId);

    /**
     * Her misses on this entitlement that came <b>before</b> a given appointment.
     *
     * <p>Used by the credit-back decision, which needs to know "is this her first?" and so
     * must not see itself or anything later. Counting all attributed rows instead breaks when
     * two sessions settle in the same sweep: each sees the other, both conclude they are the
     * second, and she loses both credits when she was owed one back.
     *
     * <p>Ordering by id makes the outcome deterministic regardless of how the sweep batches.
     */
    @Query("SELECT COUNT(a) FROM CounsellingAppointment a "
         + "WHERE a.entitlementId = :entitlementId AND a.id < :appointmentId AND ("
         + "  (a.cancelledByRole = 'STUDENT') "
         + "  OR (a.missedByRole = 'STUDENT' "
         + "      AND (a.disputeRaisedAt IS NULL OR a.disputeResolvedAt IS NOT NULL))"
         + ")")
    Long countStudentMissesBefore(
            @Param("entitlementId") Long entitlementId, @Param("appointmentId") Long appointmentId);

    /**
     * Check-in alarm sweep: confirmed sessions on {@code date} that have not been checked in,
     * not already marked absent, and not already prompted. The scheduler works out which have
     * passed the alarm threshold in Java, using {@link
     * com.kccitm.api.service.counselling.CounsellingClock} rather than the JVM clock.
     */
    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' "
         + "AND a.slot.date = :date AND a.checkinVerifiedAt IS NULL AND a.markedAbsentAt IS NULL")
    List<CounsellingAppointment> findAwaitingCheckinOnDate(@Param("date") LocalDate date);

    /** Admin dispute queue: raised, not yet decided. Should stay small. */
    @Query("SELECT a FROM CounsellingAppointment a WHERE a.disputeRaisedAt IS NOT NULL "
         + "AND a.disputeResolvedAt IS NULL ORDER BY a.disputeRaisedAt ASC")
    List<CounsellingAppointment> findOpenDisputes();

    /**
     * How many sessions a counsellor already holds on a date — used to hand a re-placement to
     * the lightest-loaded eligible counsellor. Without an explicit rule the query order
     * decides, which in practice means the same person absorbs every reassignment.
     */
    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId "
         + "AND a.slot.date = :date AND a.status IN ('PENDING', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS')")
    Long countActiveForCounsellorOnDate(
            @Param("counsellorId") Long counsellorId, @Param("date") LocalDate date);

    /**
     * Outcome tallies for one counsellor, split by who caused each one. A single merged
     * "no-shows" number is useless for management: a counsellor with many student no-shows
     * would look identical to one who keeps not turning up.
     */
    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId "
         + "AND a.slot.date BETWEEN :start AND :end AND a.missedByRole = :role")
    Long countMissedByRoleForCounsellor(
            @Param("counsellorId") Long counsellorId, @Param("role") String role,
            @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId "
         + "AND a.slot.date BETWEEN :start AND :end AND a.cancelledByRole = :role")
    Long countCancelledByRoleForCounsellor(
            @Param("counsellorId") Long counsellorId, @Param("role") String role,
            @Param("start") LocalDate start, @Param("end") LocalDate end);
}
