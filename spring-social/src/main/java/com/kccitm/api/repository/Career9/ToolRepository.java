package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Tool;

@Repository
public interface ToolRepository extends JpaRepository<Tool, Long> {

    // Find tools by name (partial match)
    List<Tool> findByNameContainingIgnoreCase(String name);
    
    // Find free tools
    List<Tool> findByIsFreeTrue();
    
    // Find paid tools
    List<Tool> findByIsFreeFalse();
    
    // Find tools by price range
    List<Tool> findByPriceBetween(Double minPrice, Double maxPrice);
    
    // Find tools by measured quality
    @Query("SELECT t FROM Tool t JOIN t.measuredQualities mq WHERE mq.measured_quality_id = :qualityId")
    List<Tool> findByMeasuredQualityId(@Param("qualityId") Long qualityId);
    
    // Find tools with no measured qualities assigned
    @Query("SELECT t FROM Tool t WHERE SIZE(t.measuredQualities) = 0")
    List<Tool> findToolsWithoutMeasuredQualities();
}
