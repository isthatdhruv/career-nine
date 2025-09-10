package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;

@Repository
public interface OptionScoreBasedOnMeasuredQualityTypesRepository extends JpaRepository<OptionScoreBasedOnMEasuredQualityTypes, Long> {

   
}
