package com.kccitm.api.repository.Career9.report;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.CalculatedReportData;

@Repository
public interface CalculatedReportDataRepository extends JpaRepository<CalculatedReportData, Long> {

    Optional<CalculatedReportData> findByUserStudentIdAndAssessmentIdAndReportType_CodeAndReportSubtype_Code(
            Long userStudentId, Long assessmentId, String reportTypeCode, String reportSubtypeCode);
}
