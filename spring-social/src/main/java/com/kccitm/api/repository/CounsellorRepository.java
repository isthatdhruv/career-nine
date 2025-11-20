package com.kccitm.api.repository;

import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Counsellor;

import org.springframework.data.jpa.repository.JpaRepository;

@Repository
public interface CounsellorRepository extends JpaRepository<Counsellor, Long>{
	
}
