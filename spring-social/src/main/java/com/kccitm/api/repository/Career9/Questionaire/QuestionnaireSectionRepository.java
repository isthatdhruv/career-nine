package com.kccitm.api.repository.Career9.Questionaire;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;

@Repository
public interface QuestionnaireSectionRepository extends JpaRepository<QuestionnaireSection, Long> {

   

    
}