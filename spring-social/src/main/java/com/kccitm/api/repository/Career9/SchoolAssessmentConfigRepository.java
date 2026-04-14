package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.SchoolAssessmentConfig;

@Repository
public interface SchoolAssessmentConfigRepository extends JpaRepository<SchoolAssessmentConfig, Long> {

    List<SchoolAssessmentConfig> findByInstituteCodeAndSessionIdOrderByClassIdAsc(Integer instituteCode, Integer sessionId);

    List<SchoolAssessmentConfig> findByInstituteCodeAndSessionIdAndIsActiveTrue(Integer instituteCode, Integer sessionId);

    Optional<SchoolAssessmentConfig> findByInstituteCodeAndSessionIdAndClassId(Integer instituteCode, Integer sessionId, Integer classId);
}
