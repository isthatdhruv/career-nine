package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.PromoCode;

@Repository
public interface PromoCodeRepository extends JpaRepository<PromoCode, Long> {
    Optional<PromoCode> findByCodeIgnoreCase(String code);

    Optional<PromoCode> findByCodeIgnoreCaseAndIsActive(String code, Boolean isActive);

    List<PromoCode> findAllByOrderByCreatedAtDesc();
}
