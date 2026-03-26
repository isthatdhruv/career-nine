package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.OmrColumnMapping;

@Repository
public interface OmrColumnMappingRepository extends JpaRepository<OmrColumnMapping, Long> {

    Optional<OmrColumnMapping> findByAssessmentIdAndInstituteId(Long assessmentId, Long instituteId);

    List<OmrColumnMapping> findByAssessmentId(Long assessmentId);

    List<OmrColumnMapping> findByInstituteId(Long instituteId);

    Optional<OmrColumnMapping> findFirstByQuestionnaireIdOrderByUpdatedAtDesc(Long questionnaireId);
}
