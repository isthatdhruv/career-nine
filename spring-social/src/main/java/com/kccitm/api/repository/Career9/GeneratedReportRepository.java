package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.GeneratedReport;

@Repository
public interface GeneratedReportRepository extends JpaRepository<GeneratedReport, Long> {

    List<GeneratedReport> findByAssessmentId(Long assessmentId);

    List<GeneratedReport> findByAssessmentIdAndTypeOfReport(Long assessmentId, String typeOfReport);

    Optional<GeneratedReport> findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
            Long userStudentId, Long assessmentId, String typeOfReport);

    Optional<GeneratedReport> findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(
            Long userStudentId, Long assessmentId, Long reportTemplateId);

    List<GeneratedReport> findByUserStudentUserStudentId(Long userStudentId);

    List<GeneratedReport> findByUserStudentUserStudentIdAndTypeOfReport(Long userStudentId, String typeOfReport);

    List<GeneratedReport> findByAssessmentIdAndReportStatus(Long assessmentId, String reportStatus);

    // Bulk existence check: which of these students have at least one successfully
    // generated report. Used to gate the admin "Dashboard" button on the group-student
    // listing (single round-trip instead of one call per student).
    List<GeneratedReport> findByUserStudentUserStudentIdInAndReportStatus(
            List<Long> userStudentIds, String reportStatus);

    void deleteByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
            Long userStudentId, Long assessmentId, String typeOfReport);

    List<GeneratedReport> findByUserStudentUserStudentIdAndVisibleToStudent(Long userStudentId, Boolean visibleToStudent);

    void deleteByUserStudentUserStudentId(Long userStudentId);

    void deleteByAssessmentIdAndTypeOfReport(Long assessmentId, String typeOfReport);

    // Cohort insights: all pager reports (with a stored navigator dashboard) for an
    // institute + assessment — the source set for cohort aggregation.
    @Query("SELECT gr FROM GeneratedReport gr "
         + "WHERE gr.assessmentId = :assessmentId "
         + "AND gr.typeOfReport = 'pager' "
         + "AND gr.navigatorDashboardJson IS NOT NULL "
         + "AND gr.userStudent.institute.instituteCode = :instituteCode")
    List<GeneratedReport> findPagerReportsByInstituteAndAssessment(
            @Param("instituteCode") Long instituteCode,
            @Param("assessmentId") Long assessmentId);
}
