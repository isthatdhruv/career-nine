package com.kccitm.api.repository.Career9.b2c;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.Campaign;

@Repository
public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    Optional<Campaign> findBySlugIgnoreCaseAndIsDeletedFalse(String slug);

    Optional<Campaign> findBySlugIgnoreCase(String slug);

    List<Campaign> findByIsDeletedFalseOrderByCreatedAtDesc();
}
