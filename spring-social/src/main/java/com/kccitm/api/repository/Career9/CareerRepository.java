package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Career;

@Repository
public interface CareerRepository extends JpaRepository<Career, Long> {

    @Query("SELECT DISTINCT c FROM Career c LEFT JOIN FETCH c.measuredQualityTypes mqt "
         + "WHERE mqt.isDeleted = false OR mqt.isDeleted IS NULL")
    List<Career> findAllWithMeasuredQualityTypes();
}