package com.kccitm.api.repository.mail;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.mail.MailAutomation;

public interface MailAutomationRepository extends JpaRepository<MailAutomation, Long> {
    Optional<MailAutomation> findFirstByAutomationKey(String automationKey);
    boolean existsByAutomationKey(String automationKey);
    List<MailAutomation> findAllByOrderByNameAsc();
}
