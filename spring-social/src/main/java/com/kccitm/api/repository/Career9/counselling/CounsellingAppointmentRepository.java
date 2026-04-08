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

    List<CounsellingAppointment> findByStudentUserStudentId(Long userStudentId);

    List<CounsellingAppointment> findByCounsellorId(Long counsellorId);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.student.userStudentId = :studentId " +
           "ORDER BY a.slot.date DESC, a.slot.startTime DESC")
    List<CounsellingAppointment> findByStudentIdOrdered(@Param("studentId") Long studentId);

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

    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED') " +
           "AND a.slot.date BETWEEN :start AND :end")
    Long countActiveInWeek(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
