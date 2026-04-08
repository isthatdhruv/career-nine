package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.SchoolReport;

public interface SchoolReportRepository extends JpaRepository<SchoolReport, Long> {

    Optional<SchoolReport> findByInstituteCodeAndAssessmentId(Long instituteCode, Long assessmentId);

    List<SchoolReport> findByInstituteCode(Long instituteCode);

    List<SchoolReport> findByAssessmentId(Long assessmentId);
}
