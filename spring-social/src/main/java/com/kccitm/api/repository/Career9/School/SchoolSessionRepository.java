package com.kccitm.api.repository.Career9.School;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.SchoolSession;

@Repository
public interface SchoolSessionRepository extends JpaRepository<SchoolSession, Long> {

}