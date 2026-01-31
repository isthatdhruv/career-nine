package com.kccitm.api.repository.Career9.Questionaire;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Questionaire.Questionnaire;

@Repository
public interface QuestionnaireRepository extends JpaRepository<Questionnaire, Long> {

//    Optional<Questionnaire> findByAssessmentTableId(Long id);
    // Opt<Questionnaire> findById(Long id);
    @Query("SELECT q FROM Questionnaire q WHERE q.id = :questionnaireId")
    List<Questionnaire> findAllByQuestionnaireId(@Param("questionnaireId") Long questionnaireId);

    @Query("SELECT new com.kccitm.api.model.career9.Questionaire.Questionnaire(q.questionnaireId,q.name,q.modeId) FROM Questionnaire q")
List<Questionnaire> findQuestionnaireList();
}