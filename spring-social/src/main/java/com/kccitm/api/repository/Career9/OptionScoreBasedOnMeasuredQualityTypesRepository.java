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

    @Query("SELECT os FROM OptionScoreBasedOnMEasuredQualityTypes os " +
           "LEFT JOIN FETCH os.measuredQualityType mt " +
           "LEFT JOIN FETCH mt.measuredQuality " +
           "WHERE os.question_option.optionId IN :optionIds")
    java.util.List<OptionScoreBasedOnMEasuredQualityTypes> findByOptionIdIn(@Param("optionIds") java.util.List<Long> optionIds);
}
