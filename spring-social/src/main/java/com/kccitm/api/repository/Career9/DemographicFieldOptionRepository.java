package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.DemographicFieldOption;

@Repository
public interface DemographicFieldOptionRepository extends JpaRepository<DemographicFieldOption, Long> {
    List<DemographicFieldOption> findByFieldDefinitionFieldIdOrderByDisplayOrderAsc(Long fieldId);
}
