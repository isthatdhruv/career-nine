package com.kccitm.api.repository.Career9;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentTable;

@Repository
public interface AssessmentTableRepository extends JpaRepository<AssessmentTable, Long> {

    // Optional<AssessmentTable> findByInstituteId(Long instituteId);
    // Optional<AssessmentTable> findByToolId(Long toolId);

    // @Query("SELECT new com.kccitm.api.model.career9.AssessmentTable(a.id,a.AssessmentName,a.starDate,a.endDate,a.questionnaire_id) FROM AssessmentTable a")
    // List<AssessmentTable> findAssessmentList();

}
