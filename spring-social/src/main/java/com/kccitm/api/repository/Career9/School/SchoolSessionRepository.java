package com.kccitm.api.repository.Career9.School;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.SchoolSession;

@Repository
public interface SchoolSessionRepository extends JpaRepository<SchoolSession, Integer> {

    // Find all sessions for a specific institute (simple query without nested data)
    List<SchoolSession> findByInstitute_InstituteCode(Integer instituteCode);

    // Find all sessions with nested classes eagerly loaded
    @Query("SELECT DISTINCT s FROM SchoolSession s " +
           "LEFT JOIN FETCH s.schoolClasses " +
           "WHERE s.institute.instituteCode = :instituteCode")
    List<SchoolSession> findByInstituteCodeWithClasses(@Param("instituteCode") Integer instituteCode);
}