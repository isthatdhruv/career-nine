package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.GeneratedReport;

@Repository
public interface GeneratedReportRepository extends JpaRepository<GeneratedReport, Long> {

    List<GeneratedReport> findByAssessmentId(Long assessmentId);

    List<GeneratedReport> findByAssessmentIdAndTypeOfReport(Long assessmentId, String typeOfReport);

    Optional<GeneratedReport> findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
            Long userStudentId, Long assessmentId, String typeOfReport);

    List<GeneratedReport> findByUserStudentUserStudentId(Long userStudentId);

    List<GeneratedReport> findByUserStudentUserStudentIdAndTypeOfReport(Long userStudentId, String typeOfReport);

    List<GeneratedReport> findByAssessmentIdAndReportStatus(Long assessmentId, String reportStatus);

    void deleteByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
            Long userStudentId, Long assessmentId, String typeOfReport);

    List<GeneratedReport> findByUserStudentUserStudentIdAndVisibleToStudent(Long userStudentId, Boolean visibleToStudent);

    void deleteByUserStudentUserStudentId(Long userStudentId);

    void deleteByAssessmentIdAndTypeOfReport(Long assessmentId, String typeOfReport);
}
