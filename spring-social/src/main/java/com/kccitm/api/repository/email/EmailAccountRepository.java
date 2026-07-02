package com.kccitm.api.repository.email;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.email.EmailAccount;

public interface EmailAccountRepository extends JpaRepository<EmailAccount, Long> {

    Optional<EmailAccount> findFirstByIsGlobalDefaultTrueAndActiveTrue();

    List<EmailAccount> findByIsGlobalDefaultTrue();

    List<EmailAccount> findByActiveTrueOrderByNameAsc();

    List<EmailAccount> findAllByOrderByNameAsc();
}
