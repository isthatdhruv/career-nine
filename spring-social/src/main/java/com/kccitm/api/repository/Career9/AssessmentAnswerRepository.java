package com.kccitm.api.repository.Career9;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;

@Repository
public interface AssessmentAnswerRepository extends JpaRepository<AssessmentAnswer, Long> {

       public java.util.List<AssessmentAnswer> findByUserStudent(com.kccitm.api.model.career9.UserStudent userStudent);

       // Count methods using entity relationships
       Long countByUserStudent_UserStudentId(Long userStudentId);

       Long countByUserStudent_UserStudentIdAndAssessment_Id(Long userStudentId, Long assessmentId);

       // Main query with JOIN FETCH to load related entities including measured
       // qualities
       @Query("SELECT DISTINCT aa FROM AssessmentAnswer aa " +
                     "LEFT JOIN FETCH aa.option o " +
                     "LEFT JOIN FETCH o.optionScores os " +
                     "LEFT JOIN FETCH os.measuredQualityType mqt " +
                     "LEFT JOIN FETCH mqt.measuredQuality mq " +
                     "WHERE aa.userStudent.userStudentId = :userStudentId " +
                     "AND aa.assessment.id = :assessmentId")
       ArrayList<AssessmentAnswer> findByUserStudentIdAndAssessmentIdWithDetails(
                     @Param("userStudentId") Long userStudentId,
                     @Param("assessmentId") Long assessmentId);

       @Transactional
       void deleteByUserStudent_UserStudentIdAndAssessment_Id(Long userStudentId, Long assessmentId);

       List<AssessmentAnswer> findByAssessment_IdAndTextResponseIsNotNull(Long assessmentId);

       List<AssessmentAnswer> findByUserStudent_UserStudentIdAndAssessment_Id(Long userStudentId, Long assessmentId);

       // Find a previously mapped text response for the same question (for auto-mapping)
       Optional<AssessmentAnswer> findFirstByQuestionnaireQuestion_QuestionnaireQuestionIdAndTextResponseAndMappedOptionIsNotNull(
                     Long questionnaireQuestionId, String textResponse);

       // @Query("SELECT"+
       // " new
       // com.kccitm.api.model.userDefinedModel.QuestionOptionID(aa.questionnaireQuestion.questionnaireQuestionId,
       // aa.option.optionId , " +
       // "new com.kccitm.api.model.userDefinedModel.MeasuredQualityList(os.score,
       // mqt.measured_quality_type_name, mq.measured_quality_name )" +
       // "FROM AssessmentAnswer aa " +
       // "JOIN aa.option.optionScores os " +
       // "JOIN os.measuredQualityType mqt " +
       // "JOIN mqt.measuredQuality mq " +
       // "WHERE aa.userStudent.userStudentId = :userStudentId " +
       // "AND aa.assessment.id = :assessmentId")
       // ArrayList<Object> iDoNotKnow(
       // @Param("userStudentId") Long userStudentId,
       // @Param("assessmentId") Long assessmentId);
}
