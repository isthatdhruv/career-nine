package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Tool;

@Repository
public interface ToolMeasuredQualitiesMappingRepository extends JpaRepository<Tool, Long> {

    // Find tools by measured quality ID
    @Query("SELECT t FROM Tool t JOIN t.measuredQualities mq WHERE mq.measured_quality_id = :qualityId")
    List<Tool> findByMeasuredQualityId(@Param("qualityId") Long qualityId);
    
    // Find tools by measured quality name
    @Query("SELECT t FROM Tool t JOIN t.measuredQualities mq WHERE mq.measured_quality_name = :qualityName")
    List<Tool> findByMeasuredQualityName(@Param("qualityName") String qualityName);
    
    // Find free tools by measured quality
    @Query("SELECT t FROM Tool t JOIN t.measuredQualities mq WHERE mq.measured_quality_id = :qualityId AND t.isFree = true")
    List<Tool> findFreeToolsByMeasuredQualityId(@Param("qualityId") Long qualityId);
}
