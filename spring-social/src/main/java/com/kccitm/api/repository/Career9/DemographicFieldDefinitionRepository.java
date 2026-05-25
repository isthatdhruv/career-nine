package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.DemographicFieldDefinition;

@Repository
public interface DemographicFieldDefinitionRepository extends JpaRepository<DemographicFieldDefinition, Long> {
    List<DemographicFieldDefinition> findByIsActiveTrue();
    List<DemographicFieldDefinition> findByFieldSource(String fieldSource);
    Optional<DemographicFieldDefinition> findByFieldName(String fieldName);

    @Query("SELECT d FROM DemographicFieldDefinition d "
            + "WHERE LOWER(d.systemFieldKey) = LOWER(:key) "
            + "   OR LOWER(d.fieldName) = LOWER(:key)")
    List<DemographicFieldDefinition> findGenderLikeFields(@Param("key") String key);
}
