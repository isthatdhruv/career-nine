package com.kccitm.api.repository.Career9.School;

import com.kccitm.api.model.career9.school.FirebaseQuestionMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FirebaseQuestionMappingRepository extends JpaRepository<FirebaseQuestionMapping, Long> {

    List<FirebaseQuestionMapping> findByAssessmentId(Long assessmentId);

    void deleteByAssessmentId(Long assessmentId);

    List<FirebaseQuestionMapping> findByAssessmentIdAndCategory(Long assessmentId, String category);
}
