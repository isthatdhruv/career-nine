package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteSession;

@Repository
public interface InstituteSessionRepository extends JpaRepository<InstituteSession, Integer> {


    public List<InstituteSession> findBySessionId(int sessionId);

    // public List<InstituteSession> findBySessionStartDate(String sessionStartDate);

    // public List<InstituteSession> findBySessionEndDate(String sessionEndDate);

    // public List<InstituteSession> findBySessionDuration(int sessionDuration);

    // public List<InstituteSession> findBySessionDurationType(int sessionDurationType);

    public List<InstituteSession> findByBatchId(int batchId);

    public List<InstituteSession> findByDisplay(Boolean display);

    public InstituteSession getOne(int id);

    public Optional<InstituteSession> findById(int id);

    // @Query(value ="SELECT * FROM InstituteSession i WHERE i.display = true", nativeQuery = true)
    // public List<InstituteSession> findAll();
    // // public Role findByID(int id);
}