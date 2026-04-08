package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingSlot;

@Repository
public interface CounsellingSlotRepository extends JpaRepository<CounsellingSlot, Long> {

    List<CounsellingSlot> findByStatusAndDateBetween(String status, LocalDate start, LocalDate end);

    List<CounsellingSlot> findByCounsellorIdAndDateBetween(Long counsellorId, LocalDate start, LocalDate end);

    List<CounsellingSlot> findByCounsellorId(Long counsellorId);

    @Query("SELECT s FROM CounsellingSlot s WHERE s.status = 'AVAILABLE' AND s.isBlocked = false AND s.date BETWEEN :start AND :end ORDER BY s.date, s.startTime")
    List<CounsellingSlot> findAvailableSlots(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT s FROM CounsellingSlot s WHERE s.counsellor.id = :counsellorId AND s.date = :date AND s.template.id = :templateId")
    List<CounsellingSlot> findByCounsellorIdAndDateAndTemplateId(
            @Param("counsellorId") Long counsellorId,
            @Param("date") LocalDate date,
            @Param("templateId") Long templateId);

    List<CounsellingSlot> findByCounsellorIdAndDateAndIsBlockedTrue(Long counsellorId, LocalDate date);
}
