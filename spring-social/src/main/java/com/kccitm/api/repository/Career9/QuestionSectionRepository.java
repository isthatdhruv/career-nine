package com.kccitm.api.repository.Career9;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.QuestionSection;

@Repository
public interface QuestionSectionRepository extends JpaRepository<QuestionSection, Long> {
    // Repository methods for QuestionSection entity
    public List<QuestionSection> findAll();

    public QuestionSection getOne(Long id);

}