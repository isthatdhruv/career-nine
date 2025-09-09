package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.MeasuredQualityTypes;

@Repository
public interface MeasuredQualityTypesRepository extends JpaRepository<MeasuredQualityTypes, Long> {

    // Find quality types by measured quality ID
    List<MeasuredQualityTypes> findByMeasuredQualityMeasuredQualityId(Long measuredQualityId);
    
    // Find quality types by name
    List<MeasuredQualityTypes> findByMeasuredQualityTypeNameContainingIgnoreCase(String name);
    
    // Find quality types associated with a specific career
    @Query("SELECT mqt FROM MeasuredQualityTypes mqt JOIN mqt.careers c WHERE c.career_id = :careerId")
    List<MeasuredQualityTypes> findByCareer(@Param("careerId") Long careerId);
    
    // Find quality types by assessment question
    @Query("SELECT mqt FROM MeasuredQualityTypes mqt JOIN mqt.assessmentQuestions aq WHERE aq.assessment_question_id = :questionId")
    List<MeasuredQualityTypes> findByAssessmentQuestion(@Param("questionId") Long questionId);
}