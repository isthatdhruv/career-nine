package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.NavigatorReportData;

@Repository
public interface NavigatorReportDataRepository extends JpaRepository<NavigatorReportData, Long> {

    List<NavigatorReportData> findByAssessmentId(Long assessmentId);

    Optional<NavigatorReportData> findByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    List<NavigatorReportData> findByUserStudentUserStudentId(Long userStudentId);

    void deleteByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    void deleteByUserStudentUserStudentId(Long userStudentId);

    void deleteByAssessmentId(Long assessmentId);

    List<NavigatorReportData> findByAssessmentIdAndEligible(Long assessmentId, boolean eligible);
}
