package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.StudentDemographicResponse;

@Repository
public interface StudentDemographicResponseRepository extends JpaRepository<StudentDemographicResponse, Long> {
    List<StudentDemographicResponse> findByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);
    Optional<StudentDemographicResponse> findByUserStudentIdAndAssessmentIdAndFieldDefinitionFieldId(
            Long userStudentId, Long assessmentId, Long fieldId);
    void deleteByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    void deleteByUserStudentId(Long userStudentId);

    // Cross-assessment lookups: demographic data is per-student per-field, not per-assessment
    List<StudentDemographicResponse> findByUserStudentId(Long userStudentId);
    List<StudentDemographicResponse> findByUserStudentIdAndFieldDefinitionFieldId(
            Long userStudentId, Long fieldId);

    // Bulk lookup for many students against a fixed set of field IDs
    List<StudentDemographicResponse> findByUserStudentIdInAndFieldDefinitionFieldIdIn(
            List<Long> userStudentIds, List<Long> fieldIds);

    /**
     * Global-search hook: returns distinct {@code userStudentId}s whose
     * demographic response value matches {@code :q} (caller-padded with
     * {@code %} wildcards). The display label and matched value are returned
     * alongside so the spotlight UI can render a "matched on: Father Name —
     * Rajesh Kumar" sub-hint.
     *
     * <p>This table has no scope columns of its own — scope is enforced
     * downstream by joining the returned {@code userStudentId}s against
     * {@code StudentInfo} (which IS scope-filtered) in the controller.
     */
    @Query("SELECT r.userStudentId, r.fieldDefinition.displayLabel, r.responseValue "
            + "FROM StudentDemographicResponse r "
            + "WHERE LOWER(COALESCE(r.responseValue, '')) LIKE LOWER(:q)")
    List<Object[]> searchByResponseValue(@Param("q") String q);
}
