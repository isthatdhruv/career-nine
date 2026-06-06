package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.InstituteAssessment;

@Repository
public interface InstituteAssessmentRepository extends JpaRepository<InstituteAssessment, Long> {

    Optional<InstituteAssessment> findByInstituteCodeAndAssessmentId(Integer instituteCode, Long assessmentId);

    boolean existsByInstituteCodeAndAssessmentId(Integer instituteCode, Long assessmentId);

    List<InstituteAssessment> findByInstituteCode(Integer instituteCode);

    List<InstituteAssessment> findByInstituteCodeAndIsActive(Integer instituteCode, Boolean isActive);

    long countByInstituteCodeAndIsActive(Integer instituteCode, Boolean isActive);
}
