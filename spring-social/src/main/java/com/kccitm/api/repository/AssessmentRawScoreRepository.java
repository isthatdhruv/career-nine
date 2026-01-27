package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.AssessmentRawScore;

public interface AssessmentRawScoreRepository
        extends JpaRepository<AssessmentRawScore, Long> {

//     @Query("""
//                 SELECT ars
//                 FROM AssessmentRawScore ars
//                 WHERE ars.studentAssessmentMapping.studentAssessmentId = :mappingId
//             """)
//     List<AssessmentRawScore> findByStudentAssessmentId(
//             @Param("mappingId") Long mappingId);
}
