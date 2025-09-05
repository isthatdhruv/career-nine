package com.kccitm.api.repository.Career9;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentQuestions;

@Repository
public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestions, Long> {
    // Repository methods for AssessmentQuestions entity
    public List<AssessmentQuestions> findAll();

    public AssessmentQuestions getOne(Long id);

}