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
}
