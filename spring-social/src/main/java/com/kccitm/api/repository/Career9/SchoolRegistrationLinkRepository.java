package com.kccitm.api.repository.Career9;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.SchoolRegistrationLink;

@Repository
public interface SchoolRegistrationLinkRepository extends JpaRepository<SchoolRegistrationLink, Long> {

    Optional<SchoolRegistrationLink> findByTokenAndIsActive(String token, Boolean isActive);

    Optional<SchoolRegistrationLink> findByInstituteCodeAndSessionId(Integer instituteCode, Integer sessionId);
}
