package com.kccitm.api.repository.Career9.counselling;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.career9.counselling.CounsellorAssessmentAssignment;

public interface CounsellorAssessmentAssignmentRepository
        extends JpaRepository<CounsellorAssessmentAssignment, Long> {

    List<CounsellorAssessmentAssignment> findByAssessmentId(Long assessmentId);

    List<CounsellorAssessmentAssignment> findByCounsellorId(Long counsellorId);

    boolean existsByCounsellorIdAndAssessmentId(Long counsellorId, Long assessmentId);

    /** Active counsellor ids assigned to an assessment — used to filter bookable slots. */
    @Query("SELECT a.counsellor.id FROM CounsellorAssessmentAssignment a "
            + "WHERE a.assessmentId = :assessmentId AND a.isActive = true")
    List<Long> findActiveCounsellorIdsForAssessment(@Param("assessmentId") Long assessmentId);

    /**
     * Assessments where counselling is toggled on in at least one active tier — the
     * admin assignment page only offers these for counsellor assignment. Counselling
     * is a per-tier inclusion, so an assessment qualifies through any of the three
     * tier sources: B2B mapping tiers, school tiers, or B2C campaign pricing tiers.
     */
    @Query(nativeQuery = true, value =
            "SELECT DISTINCT m.assessment_id FROM assessment_mapping_tier t "
            + "JOIN assessment_institute_mapping m ON m.mapping_id = t.mapping_id "
            + "WHERE t.includes_counselling = TRUE AND t.is_active = TRUE AND m.is_active = TRUE "
            + "UNION "
            + "SELECT DISTINCT s.assessment_id FROM school_assessment_tier s "
            + "WHERE s.includes_counselling = TRUE AND s.is_active = TRUE "
            + "UNION "
            + "SELECT DISTINCT cam.assessment_id FROM campaign_assessment_tiers cat "
            + "JOIN pricing_tiers p ON p.tier_id = cat.pricing_tier_id "
            + "JOIN campaign_assessment_mapping cam ON cam.id = cat.campaign_assessment_mapping_id "
            + "WHERE p.includes_counselling = TRUE AND p.is_active = TRUE AND cat.is_active = TRUE")
    List<Long> findCounsellingEnabledAssessmentIds();
}
