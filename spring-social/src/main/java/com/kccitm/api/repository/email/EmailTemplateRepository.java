package com.kccitm.api.repository.email;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.email.EmailTemplate;

public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {

    List<EmailTemplate> findByEmailTypeOrderByNameAsc(String emailType);

    /** The default template for a send-scenario (first active default). */
    Optional<EmailTemplate> findFirstByEmailTypeAndIsDefaultTrueAndActiveTrue(String emailType);

    List<EmailTemplate> findByEmailTypeAndIsDefaultTrue(String emailType);

    List<EmailTemplate> findAllByOrderByEmailTypeAscNameAsc();
}
