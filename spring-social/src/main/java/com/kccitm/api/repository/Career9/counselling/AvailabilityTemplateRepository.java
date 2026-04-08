package com.kccitm.api.repository.Career9.counselling;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;

@Repository
public interface AvailabilityTemplateRepository extends JpaRepository<AvailabilityTemplate, Long> {

    List<AvailabilityTemplate> findByCounsellorId(Long counsellorId);

    List<AvailabilityTemplate> findByCounsellorIdAndIsActiveTrue(Long counsellorId);

    List<AvailabilityTemplate> findByIsActiveTrue();
}
