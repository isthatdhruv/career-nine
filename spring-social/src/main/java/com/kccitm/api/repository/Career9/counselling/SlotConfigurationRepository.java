package com.kccitm.api.repository.Career9.counselling;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.SlotConfiguration;

@Repository
public interface SlotConfigurationRepository extends JpaRepository<SlotConfiguration, Long> {

    @Query("SELECT sc FROM SlotConfiguration sc ORDER BY sc.createdAt DESC")
    List<SlotConfiguration> findAllOrderByCreatedAtDesc();
}
