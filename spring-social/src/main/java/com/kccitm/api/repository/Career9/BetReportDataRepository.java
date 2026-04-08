package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.BetReportData;

@Repository
public interface BetReportDataRepository extends JpaRepository<BetReportData, Long> {

    List<BetReportData> findByAssessmentId(Long assessmentId);

    Optional<BetReportData> findByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    List<BetReportData> findByUserStudentUserStudentId(Long userStudentId);

    void deleteByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    void deleteByUserStudentUserStudentId(Long userStudentId);
}
