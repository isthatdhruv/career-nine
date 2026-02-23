package com.kccitm.api.repository.Career9;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;

@Repository
public interface OptionScoreBasedOnMeasuredQualityTypesRepository extends JpaRepository<OptionScoreBasedOnMEasuredQualityTypes, Long> {
    @Query("SELECT os FROM OptionScoreBasedOnMEasuredQualityTypes os WHERE os.question_option.optionId = :optionId")
    java.util.List<OptionScoreBasedOnMEasuredQualityTypes> findByOptionId(@Param("optionId") Long optionId);
}
