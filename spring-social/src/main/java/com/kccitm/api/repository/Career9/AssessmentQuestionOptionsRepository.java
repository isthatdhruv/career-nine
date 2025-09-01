package com.kccitm.api.repository.Career9;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;


@Repository
public interface AssessmentQuestionOptionsRepository extends JpaRepository<AssessmentQuestionOptions, Long> {
    // Repository methods for AssessmentQuestionOptions entity
    public List<AssessmentQuestionOptions> findAll();

    public AssessmentQuestionOptions getOne(Long id);

}