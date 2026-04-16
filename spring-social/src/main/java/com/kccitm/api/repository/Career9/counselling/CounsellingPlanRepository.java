package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingPlan;

@Repository
public interface CounsellingPlanRepository extends JpaRepository<CounsellingPlan, Long> {

    List<CounsellingPlan> findByInstituteInstituteCode(Integer instituteCode);

    List<CounsellingPlan> findByStatus(String status);

    /**
     * Find active plans for an institute where today falls within the plan date range
     * and sessions are still available.
     */
    @Query("SELECT p FROM CounsellingPlan p WHERE p.institute.instituteCode = :instituteCode "
         + "AND p.status = 'ACTIVE' "
         + "AND p.startDate <= :today AND p.endDate >= :today "
         + "AND p.sessionsUsed < p.totalSessions")
    List<CounsellingPlan> findActivePlansForInstitute(
            @Param("instituteCode") Integer instituteCode,
            @Param("today") LocalDate today);
}
