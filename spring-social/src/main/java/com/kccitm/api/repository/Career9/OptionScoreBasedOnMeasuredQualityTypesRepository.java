package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;

@Repository
public interface OptionScoreBasedOnMeasuredQualityTypesRepository extends JpaRepository<OptionScoreBasedOnMEasuredQualityTypes, Long> {

    // Find scores by option ID
    List<OptionScoreBasedOnMEasuredQualityTypes> findByQuestionOptionAssessmentQuestionOptionId(Long optionId);
    
    // Find scores by measured quality type ID
    List<OptionScoreBasedOnMEasuredQualityTypes> findByMeasuredQualityTypeMeasuredQualityTypeId(Long qualityTypeId);
    
    // Find score by option and quality type (should be unique due to constraint)
    @Query("SELECT o FROM OptionScoreBasedOnMEasuredQualityTypes o WHERE o.question_option.assessment_question_option_id = :optionId AND o.measuredQualityType.measured_quality_type_id = :qualityTypeId")
    OptionScoreBasedOnMEasuredQualityTypes findByOptionAndQualityType(@Param("optionId") Long optionId, @Param("qualityTypeId") Long qualityTypeId);
    
    // Get all scores for a specific question (through its options)
    @Query("SELECT o FROM OptionScoreBasedOnMEasuredQualityTypes o WHERE o.question_option.assessment_question.assessment_question_id = :questionId")
    List<OptionScoreBasedOnMEasuredQualityTypes> findByQuestionId(@Param("questionId") Long questionId);
    
    // Get average score for a quality type
    @Query("SELECT AVG(o.score) FROM OptionScoreBasedOnMEasuredQualityTypes o WHERE o.measuredQualityType.measured_quality_type_id = :qualityTypeId")
    Double getAverageScoreByQualityType(@Param("qualityTypeId") Long qualityTypeId);
}
