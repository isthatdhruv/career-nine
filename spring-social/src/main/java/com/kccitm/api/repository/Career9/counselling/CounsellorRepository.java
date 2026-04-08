package com.kccitm.api.repository.Career9.counselling;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.Counsellor;

@Repository
public interface CounsellorRepository extends JpaRepository<Counsellor, Long> {

    List<Counsellor> findByIsActiveTrue();

    Optional<Counsellor> findByUserId(Long userId);

    Optional<Counsellor> findByEmail(String email);

    List<Counsellor> findByOnboardingStatus(String status);

    List<Counsellor> findByIsActiveTrueAndOnboardingStatus(String status);
}
