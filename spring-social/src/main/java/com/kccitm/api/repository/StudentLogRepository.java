package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.StudentLog;

@Repository
public interface StudentLogRepository extends JpaRepository<StudentLog, Integer> {

    public List<StudentLog> findAll();

    public List<StudentLog> findByEmailAddress(String Name);

    public StudentLog getOne(int id);

    public Optional<StudentLog> findById(int id);
    // public Role findByID(int id);
}