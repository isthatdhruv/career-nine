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

    @Query(value = "SELECT aq.question_id, COUNT(DISTINCT s.fk_quality_type) FROM assessment_questions aq JOIN assessment_question_options aqo ON aqo.fk_assessment_questions = aq.question_id JOIN score_based_on_measured_quality_types s ON s.fk_assessment_questions_option = aqo.option_id WHERE (aq.is_deleted = false OR aq.is_deleted IS NULL) GROUP BY aq.question_id", nativeQuery = true)
    List<Object[]> findMqtCountsPerQuestion();

}