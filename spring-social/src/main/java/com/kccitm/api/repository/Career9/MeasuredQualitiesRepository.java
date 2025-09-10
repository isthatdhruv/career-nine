package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.MeasuredQualities;

@Repository
public interface MeasuredQualitiesRepository extends JpaRepository<MeasuredQualities, Long> {

    // Find by name (partial match)
    List<MeasuredQualities> findByMeasuredQualityNameContainingIgnoreCase(String name);
    
    // Find qualities that have associated tools
    @Query("SELECT DISTINCT mq FROM MeasuredQualities mq WHERE SIZE(mq.tools) > 0")
    List<MeasuredQualities> findQualitiesWithTools();
    
    // Find qualities by tool ID
    @Query("SELECT mq FROM MeasuredQualities mq JOIN mq.tools t WHERE t.tool_id = :toolId")
    List<MeasuredQualities> findByToolId(@Param("toolId") Long toolId);
    
    // Find qualities with free tools
    @Query("SELECT DISTINCT mq FROM MeasuredQualities mq JOIN mq.tools t WHERE t.isFree = true")
    List<MeasuredQualities> findQualitiesWithFreeTools();
}