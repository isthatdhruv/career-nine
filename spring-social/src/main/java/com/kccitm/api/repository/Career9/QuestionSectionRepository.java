package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.QuestionSection;

@Repository
public interface QuestionSectionRepository extends JpaRepository<QuestionSection, Long> {
    @Query("SELECT new com.kccitm.api.model.career9.QuestionSection(q.sectionId, q.sectionName, q.sectionDescription) " +
           "FROM QuestionSection q WHERE q.isDeleted = false OR q.isDeleted IS NULL")
    List<QuestionSection> findAllSectionsProjection();

    List<QuestionSection> findByIsDeletedFalseOrIsDeletedIsNull();
    List<QuestionSection> findByIsDeletedTrue();
}