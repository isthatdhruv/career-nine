package com.kccitm.api.repository.Career9.b2c;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.ServiceDeliveryLog;

@Repository
public interface ServiceDeliveryLogRepository extends JpaRepository<ServiceDeliveryLog, Long> {
    List<ServiceDeliveryLog> findByEntitlementIdOrderByCreatedAtDesc(Long entitlementId);

    List<ServiceDeliveryLog> findByUserStudentIdOrderByCreatedAtDesc(Long userStudentId);

    long countByEntitlementIdAndServiceType(Long entitlementId, String serviceType);

    List<ServiceDeliveryLog> findTop200ByOrderByCreatedAtDesc();
}
