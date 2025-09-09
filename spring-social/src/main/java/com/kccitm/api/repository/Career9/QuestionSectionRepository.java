package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.QuestionSection;

@Repository
public interface QuestionSectionRepository extends JpaRepository<QuestionSection, Long> {

    // Find section by name
    Optional<QuestionSection> findByQuestionSectionName(String sectionName);
    
    // Find sections by name containing (partial match)
    List<QuestionSection> findByQuestionSectionNameContainingIgnoreCase(String name);
    
    // Find sections with questions count
    @Query("SELECT qs, SIZE(qs.questions) as questionCount FROM QuestionSection qs")
    List<Object[]> findSectionsWithQuestionCount();
    
    // Find sections that have questions
    @Query("SELECT DISTINCT qs FROM QuestionSection qs WHERE SIZE(qs.questions) > 0")
    List<QuestionSection> findSectionsWithQuestions();
    
    // Find sections ordered by name
    List<QuestionSection> findAllByOrderByQuestionSectionName();
}