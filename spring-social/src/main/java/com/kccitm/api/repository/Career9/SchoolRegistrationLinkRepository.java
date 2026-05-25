package com.kccitm.api.repository.Career9;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.SchoolRegistrationLink;

@Repository
public interface SchoolRegistrationLinkRepository extends JpaRepository<SchoolRegistrationLink, Long> {

    Optional<SchoolRegistrationLink> findByTokenAndIsActive(String token, Boolean isActive);

    Optional<SchoolRegistrationLink> findByInstituteCodeAndSessionId(Integer instituteCode, Integer sessionId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE SchoolRegistrationLink l SET l.currentCount = COALESCE(l.currentCount, 0) + 1 " +
           "WHERE l.linkId = :linkId AND (COALESCE(l.maxRegistrations, 0) = 0 OR COALESCE(l.currentCount, 0) < COALESCE(l.maxRegistrations, 0))")
    int tryIncrementCount(@Param("linkId") Long linkId);
}
