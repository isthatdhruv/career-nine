package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentQuestions;

@Repository
public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestions, Long> {

    @Query("SELECT new com.kccitm.api.model.career9.AssessmentQuestions(a.questionId, a.questionText, a.questionType, a.section) FROM AssessmentQuestions a WHERE a.isDeleted = false OR a.isDeleted IS NULL")
    List<AssessmentQuestions> findAllQuestionsProjection();

    List<AssessmentQuestions> findByIsDeletedFalseOrIsDeletedIsNull();

    List<AssessmentQuestions> findByIsDeletedTrue();

}