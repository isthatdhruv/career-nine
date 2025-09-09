package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;

@Repository
public interface AssessmentQuestionOptionsRepository extends JpaRepository<AssessmentQuestionOptions, Long> {

    // Find options by question ID
    List<AssessmentQuestionOptions> findByAssessmentQuestionAssessmentQuestionId(Long questionId);
    
    // Find options by option text (partial match)
    List<AssessmentQuestionOptions> findByAssessmentQuestionOptionTextContainingIgnoreCase(String optionText);
    
    // Find options that have scores configured
    @Query("SELECT DISTINCT aqo FROM AssessmentQuestionOptions aqo WHERE EXISTS (SELECT 1 FROM OptionScoreBasedOnMEasuredQualityTypes os WHERE os.question_option = aqo)")
    List<AssessmentQuestionOptions> findOptionsWithScores();
    
    // Find options by question and order them by option order
    @Query("SELECT aqo FROM AssessmentQuestionOptions aqo WHERE aqo.assessmentQuestion.assessment_question_id = :questionId ORDER BY aqo.assessment_question_option_id")
    List<AssessmentQuestionOptions> findByQuestionIdOrderedByOptionId(@Param("questionId") Long questionId);
    
    // Count options for a specific question
    @Query("SELECT COUNT(aqo) FROM AssessmentQuestionOptions aqo WHERE aqo.assessmentQuestion.assessment_question_id = :questionId")
    Long countOptionsByQuestionId(@Param("questionId") Long questionId);
}