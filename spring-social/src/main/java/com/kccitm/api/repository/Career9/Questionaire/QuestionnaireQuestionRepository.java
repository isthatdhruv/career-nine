package com.kccitm.api.repository.Career9.Questionaire;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;

@Repository
public interface QuestionnaireQuestionRepository extends JpaRepository<QuestionnaireQuestion, Long> {

    @Query("SELECT DISTINCT qq FROM QuestionnaireQuestion qq " +
           "JOIN FETCH qq.question q " +
           "LEFT JOIN FETCH q.options o " +
           "JOIN FETCH qq.section s " +
           "WHERE s.questionnaire.questionnaireId = :questionnaireId " +
           "ORDER BY qq.questionnaireQuestionId")
    List<QuestionnaireQuestion> findByQuestionnaireIdWithOptions(
            @Param("questionnaireId") Long questionnaireId);
}