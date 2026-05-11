package com.kccitm.api.repository.Career9.b2c;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.ReportGenerationLog;

@Repository
public interface ReportGenerationLogRepository extends JpaRepository<ReportGenerationLog, Long> {

    Optional<ReportGenerationLog> findFirstByEntitlementIdAndStatusOrderByCreatedAtDesc(
            Long entitlementId, String status);

    List<ReportGenerationLog> findByEntitlementIdOrderByCreatedAtDesc(Long entitlementId);

    List<ReportGenerationLog> findByEntitlementIdInAndStatusOrderByCreatedAtDesc(
            Collection<Long> entitlementIds, String status);
}
