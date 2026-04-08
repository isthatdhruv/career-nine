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

    // Lightweight projection: only student id, name, email, status in a single query
    @org.springframework.data.jpa.repository.Query(
        "SELECT m.userStudent.userStudentId, si.name, si.email, m.status " +
        "FROM StudentAssessmentMapping m " +
        "JOIN m.userStudent us " +
        "JOIN us.studentInfo si " +
        "WHERE m.assessmentId = :assessmentId")
    List<Object[]> findLiteByAssessmentId(
        @org.springframework.data.repository.query.Param("assessmentId") Long assessmentId);

}
