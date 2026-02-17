package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentInstituteMapping;

@Repository
public interface AssessmentInstituteMappingRepository extends JpaRepository<AssessmentInstituteMapping, Long> {

    Optional<AssessmentInstituteMapping> findByToken(String token);

    Optional<AssessmentInstituteMapping> findByTokenAndIsActive(String token, Boolean isActive);

    List<AssessmentInstituteMapping> findByInstituteCode(Integer instituteCode);

    List<AssessmentInstituteMapping> findByInstituteCodeAndIsActive(Integer instituteCode, Boolean isActive);

    List<AssessmentInstituteMapping> findByAssessmentId(Long assessmentId);
}
