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

    /**
     * Every report row for one student on one assessment, whatever template produced it.
     * The typed finders above all need the caller to know the template or report type up
     * front; a counselling email only knows "this student, this assessment" and wants
     * whichever report is actually ready.
     */
    List<GeneratedReport> findByUserStudentUserStudentIdAndAssessmentId(
            Long userStudentId, Long assessmentId);

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

    /**
     * One row per rendered PDF of a school's students on the given assessments,
     * with the class/section names already joined in — the source set for the
     * auto report ZIP. Native + scalar on purpose: the bundling runs on a
     * background thread, where touching a lazy association would throw.
     * Institute is matched on student_info (the Reports Hub's roster), not on
     * user_student.
     */
    @Query(value = "SELECT gr.assessment_id AS assessmentId, gr.pdf_url AS pdfUrl, "
         + "rt.template_name AS templateName, us.user_student_id AS userStudentId, "
         + "si.id AS studentInfoId, si.name AS studentName, si.school_roll_number AS rollNumber, "
         + "si.student_class AS studentClass, sc.class_name AS className, ss.section_name AS sectionName "
         + "FROM generated_report gr "
         + "JOIN user_student us ON us.user_student_id = gr.user_student_id "
         + "JOIN student_info si ON si.id = us.id "
         + "LEFT JOIN school_sections ss ON ss.id = si.school_section_id "
         + "LEFT JOIN school_classes sc ON sc.id = ss.school_classes_id "
         + "LEFT JOIN report_template rt ON rt.report_template_id = gr.report_template_id "
         + "WHERE si.institute_id = :instituteId "
         + "AND gr.assessment_id IN (:assessmentIds) "
         + "AND gr.pdf_status = 'ready' AND gr.pdf_url IS NOT NULL",
         nativeQuery = true)
    List<SchoolPdfRow> findReadyPdfsForInstitute(
            @Param("instituteId") Integer instituteId,
            @Param("assessmentIds") List<Long> assessmentIds);

    /**
     * Every (student, assessment) allotment at a school — compared against
     * {@link #findReadyPdfsForInstitute} to list who is missing a report.
     */
    @Query(value = "SELECT sam.assessment_id AS assessmentId, sam.status AS assessmentStatus, "
         + "us.user_student_id AS userStudentId, si.id AS studentInfoId, si.name AS studentName, "
         + "si.school_roll_number AS rollNumber, si.student_class AS studentClass, "
         + "sc.class_name AS className, ss.section_name AS sectionName "
         + "FROM student_assessment_mapping sam "
         + "JOIN user_student us ON us.user_student_id = sam.user_student_id "
         + "JOIN student_info si ON si.id = us.id "
         + "LEFT JOIN school_sections ss ON ss.id = si.school_section_id "
         + "LEFT JOIN school_classes sc ON sc.id = ss.school_classes_id "
         + "WHERE si.institute_id = :instituteId "
         + "AND sam.assessment_id IN (:assessmentIds)",
         nativeQuery = true)
    List<SchoolAllotmentRow> findAllotmentsForInstitute(
            @Param("instituteId") Integer instituteId,
            @Param("assessmentIds") List<Long> assessmentIds);

    /** Student columns shared by the two auto-ZIP projections. */
    interface SchoolStudentRow {
        Long getAssessmentId();
        Long getUserStudentId();
        Integer getStudentInfoId();
        String getStudentName();
        String getRollNumber();
        String getStudentClass();
        String getClassName();
        String getSectionName();
    }

    interface SchoolPdfRow extends SchoolStudentRow {
        String getPdfUrl();
        String getTemplateName();
    }

    interface SchoolAllotmentRow extends SchoolStudentRow {
        String getAssessmentStatus();
    }
}
