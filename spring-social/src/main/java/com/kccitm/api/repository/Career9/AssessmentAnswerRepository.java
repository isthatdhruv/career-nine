package com.kccitm.api.repository.Career9;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;

@Repository
public interface AssessmentAnswerRepository extends JpaRepository<AssessmentAnswer, Long> {

    public java.util.List<AssessmentAnswer> findByUserStudent(com.kccitm.api.model.career9.UserStudent userStudent);

     // Count methods using entity relationships
    Long countByUserStudent_UserStudentId(Long userStudentId);
    
    Long countByUserStudent_UserStudentIdAndAssessment_Id(Long userStudentId, Long assessmentId);
    
    // Main query with JOIN FETCH to load related entities
    @Query("SELECT aa FROM AssessmentAnswer aa " +
           "WHERE aa.userStudent.userStudentId = :userStudentId " +
           "AND aa.assessment.id = :assessmentId")
    List<AssessmentAnswer> findByUserStudentIdAndAssessmentIdWithDetails(
            @Param("userStudentId") Long userStudentId,
            @Param("assessmentId") Long assessmentId);
}
