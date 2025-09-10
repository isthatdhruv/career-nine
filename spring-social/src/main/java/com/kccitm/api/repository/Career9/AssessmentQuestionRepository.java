package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentQuestions;

@Repository
public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestions, Long> {

    // Find questions by section ID
    List<AssessmentQuestions> findByQuestionSectionQuestionSectionId(Long sectionId);
    
    // Find questions by question text (partial match)
    List<AssessmentQuestions> findByAssessmentQuestionTextContainingIgnoreCase(String questionText);
    
    // Find questions by measured quality type
    @Query("SELECT aq FROM AssessmentQuestions aq JOIN aq.measuredQualityTypes mqt WHERE mqt.measured_quality_type_id = :qualityTypeId")
    List<AssessmentQuestions> findByMeasuredQualityType(@Param("qualityTypeId") Long qualityTypeId);
    
    // Find questions with their options count
    @Query("SELECT aq, SIZE(aq.options) as optionCount FROM AssessmentQuestions aq")
    List<Object[]> findQuestionsWithOptionCount();
    
    // Find questions by section name
    @Query("SELECT aq FROM AssessmentQuestions aq WHERE aq.questionSection.question_section_name = :sectionName")
    List<AssessmentQuestions> findBySectionName(@Param("sectionName") String sectionName);
}