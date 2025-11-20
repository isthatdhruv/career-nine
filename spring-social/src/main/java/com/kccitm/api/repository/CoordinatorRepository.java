package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Coordinator;

@Repository
public interface CoordinatorRepository extends JpaRepository<Coordinator, Long> {
}