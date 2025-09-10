package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Career;

@Repository
public interface CareerRepository extends JpaRepository<Career, Long> {

    // Find careers by name (partial match)
    List<Career> findByCareerNameContainingIgnoreCase(String name);
    
    // Find careers by measured quality type
    @Query("SELECT c FROM Career c JOIN c.measuredQualityTypes mqt WHERE mqt.measured_quality_type_id = :qualityTypeId")
    List<Career> findByMeasuredQualityType(@Param("qualityTypeId") Long qualityTypeId);
    
    // Find careers by skill level
    List<Career> findBySkillLevel(String skillLevel);
    
    // Find careers within a salary range
    @Query("SELECT c FROM Career c WHERE c.averageSalary BETWEEN :minSalary AND :maxSalary")
    List<Career> findBySalaryRange(@Param("minSalary") Double minSalary, @Param("maxSalary") Double maxSalary);
    
    // Find careers by industry
    List<Career> findByIndustryContainingIgnoreCase(String industry);
}