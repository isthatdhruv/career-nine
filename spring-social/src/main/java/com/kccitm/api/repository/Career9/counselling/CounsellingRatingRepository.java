package com.kccitm.api.repository.Career9.counselling;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingRating;

@Repository
public interface CounsellingRatingRepository extends JpaRepository<CounsellingRating, Long> {

    Optional<CounsellingRating> findByAppointmentId(Long appointmentId);

    List<CounsellingRating> findByCounsellorId(Long counsellorId);

    @Query("SELECT AVG(r.rating) FROM CounsellingRating r WHERE r.counsellor.id = :counsellorId")
    Double averageRatingForCounsellor(@Param("counsellorId") Long counsellorId);

    @Query("SELECT r.counsellor.id, COUNT(r), AVG(r.rating) " +
           "FROM CounsellingRating r " +
           "WHERE r.counsellor IS NOT NULL " +
           "GROUP BY r.counsellor.id")
    List<Object[]> summaryByCounsellor();

    @Query("SELECT a FROM CounsellingAppointment a " +
           "WHERE a.student.userStudentId = :studentId " +
           "AND a.status = 'COMPLETED' " +
           "AND a.counsellor IS NOT NULL " +
           "AND NOT EXISTS (SELECT r FROM CounsellingRating r WHERE r.appointment.id = a.id) " +
           "ORDER BY a.slot.date ASC, a.slot.startTime ASC")
    List<CounsellingAppointment> findUnratedCompletedAppointmentsForStudent(@Param("studentId") Long studentId);
}
