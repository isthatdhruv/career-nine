package com.kccitm.api.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.AuthAudit;

@Repository
public interface AuthAuditRepository extends JpaRepository<AuthAudit, Long> {
    List<AuthAudit> findByUserIdAndTsAfter(Long userId, LocalDateTime tsAfter);
    List<AuthAudit> findByDecisionAndTsAfter(AuthAudit.Decision decision, LocalDateTime tsAfter);
}
