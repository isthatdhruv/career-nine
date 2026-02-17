package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentTable;

@Repository
public interface AssessmentTableRepository extends JpaRepository<AssessmentTable, Long> {

    /**
     * Lightweight projection returning only id, name, and isActive.
     * Does not cascade into questionnaire/questions/options.
     */
    interface AssessmentSummary {
        Long getId();
        String getAssessmentName();
        Boolean getIsActive();
    }

    @Query("SELECT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive FROM AssessmentTable a")
    List<AssessmentSummary> findAssessmentSummaryList();

}
