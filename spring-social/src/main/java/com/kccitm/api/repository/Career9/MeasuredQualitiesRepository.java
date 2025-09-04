package com.kccitm.api.repository.Career9;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.MeasuredQualities;


@Repository
public interface MeasuredQualitiesRepository extends JpaRepository<MeasuredQualities, Long> {
    // Repository methods for MeasuredQualities entity
    public List<MeasuredQualities> findAll();

    public MeasuredQualities getOne(Long id);

}