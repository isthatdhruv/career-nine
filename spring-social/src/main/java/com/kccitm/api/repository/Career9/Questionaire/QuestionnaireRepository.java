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

    /**
     * Lightweight projection for the questionnaire list page. Soft-deleted rows
     * ({@code display = false}) belong to the Recycle Bin ({@link #findByDisplayFalse()})
     * only, so they are excluded here — same rule as {@link #findByDisplayTrueOrDisplayIsNull()}.
     */
    @Query("SELECT new com.kccitm.api.model.career9.Questionaire.Questionnaire(q.questionnaireId, q.name, q.modeId, q.type, q.isFree) "
         + "FROM Questionnaire q WHERE q.display = TRUE OR q.display IS NULL")
    List<Questionnaire> findQuestionnaireList();

    List<Questionnaire> findByDisplayFalse();
    List<Questionnaire> findByDisplayTrueOrDisplayIsNull();
}