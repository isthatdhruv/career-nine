package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.DemographicFieldDefinition;

@Repository
public interface DemographicFieldDefinitionRepository extends JpaRepository<DemographicFieldDefinition, Long> {
    List<DemographicFieldDefinition> findByIsActiveTrue();
    List<DemographicFieldDefinition> findByFieldSource(String fieldSource);
    Optional<DemographicFieldDefinition> findByFieldName(String fieldName);
}
