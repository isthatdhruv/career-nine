package com.kccitm.api.repository.Career9;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.MeasuredQualityTypes;


@Repository
public interface MeasuredQualityTypesRepository extends JpaRepository<MeasuredQualityTypes, Long> {
    // Repository methods for MeasuredQualityTypes entity
    public List<MeasuredQualityTypes> findAll();

    public MeasuredQualityTypes getOne(Long id);

}