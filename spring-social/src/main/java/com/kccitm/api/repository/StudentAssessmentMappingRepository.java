package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;

public interface StudentAssessmentMappingRepository extends JpaRepository<StudentAssessmentMapping, Long> {

    List<StudentAssessmentMapping> findByUserStudent(UserStudent userStudentId);

    List<StudentAssessmentMapping> findByUserStudentUserStudentId(Long userStudentId);

    Optional<StudentAssessmentMapping> findFirstByUserStudentUserStudentIdAndAssessmentId(Long userStudentId,
            Long assessmentId);

    Optional<StudentAssessmentMapping> findByAssessmentId(Long assessmentId);

    List<StudentAssessmentMapping> findAllByAssessmentId(Long assessmentId);

    void deleteByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    void deleteByUserStudentUserStudentId(Long userStudentId);
    // Get distinct assessment IDs for students belonging to a specific institute
    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT m.assessmentId FROM StudentAssessmentMapping m " +
        "JOIN UserStudent us ON us.userStudentId = m.userStudent.userStudentId " +
        "WHERE us.institute.instituteCode = :instituteCode")
    List<Long> findDistinctAssessmentIdsByInstituteCode(
        @org.springframework.data.repository.query.Param("instituteCode") Integer instituteCode);

    // Bulk load mappings for multiple students at once
    @org.springframework.data.jpa.repository.Query(
        "SELECT m FROM StudentAssessmentMapping m WHERE m.userStudent.userStudentId IN :ids")
    List<StudentAssessmentMapping> findByUserStudentUserStudentIdIn(
        @org.springframework.data.repository.query.Param("ids") List<Long> userStudentIds);

    // Lightweight projection: only student id, name, email, username, status in a single query
    @org.springframework.data.jpa.repository.Query(
        "SELECT m.userStudent.userStudentId, si.name, si.email, m.status, u.username " +
        "FROM StudentAssessmentMapping m " +
        "JOIN m.userStudent us " +
        "JOIN us.studentInfo si " +
        "LEFT JOIN si.user u " +
        "WHERE m.assessmentId = :assessmentId")
    List<Object[]> findLiteByAssessmentId(
        @org.springframework.data.repository.query.Param("assessmentId") Long assessmentId);

    // All completed mappings for an assessment — used by the admin Pending
    // Persistence view. We fetch broadly and classify in Java (needs db answer
    // count per row anyway for the diagnostic); the UI filters out truly-done
    // rows (persisted + dbCount==expected + no Redis payload).
    @org.springframework.data.jpa.repository.Query(
        "SELECT m FROM StudentAssessmentMapping m " +
        "WHERE m.assessmentId = :assessmentId " +
        "  AND m.status = 'completed'")
    List<StudentAssessmentMapping> findCompletedForAssessment(
        @org.springframework.data.repository.query.Param("assessmentId") Long assessmentId);

    // Stuck-ongoing: student has Redis partial data but hasn't clicked final
    // submit. Used by admin view to let them force-finalise on behalf of the
    // student (existing submit-from-redis path).
    @org.springframework.data.jpa.repository.Query(
        "SELECT m FROM StudentAssessmentMapping m " +
        "WHERE m.assessmentId = :assessmentId " +
        "  AND m.status = 'ongoing'")
    List<StudentAssessmentMapping> findOngoingForAssessment(
        @org.springframework.data.repository.query.Param("assessmentId") Long assessmentId);

    // Failures needing auto-expire sweep attention.
    @org.springframework.data.jpa.repository.Query(
        "SELECT m FROM StudentAssessmentMapping m " +
        "WHERE m.status = 'completed' " +
        "  AND m.persistenceState IN ('pending', 'failed')")
    List<StudentAssessmentMapping> findAllCompletedPendingPersistence();

}
