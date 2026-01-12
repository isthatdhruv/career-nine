package com.kccitm.api.repository.Career9;

import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentTable;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface AssessmentTableRepository extends JpaRepository<AssessmentTable, Long> {

    // Optional<AssessmentTable> findByInstituteId(Long instituteId);
    // Optional<AssessmentTable> findByToolId(Long toolId);

}
