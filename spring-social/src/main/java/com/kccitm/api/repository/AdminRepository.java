package com.kccitm.api.repository;

import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Admin;

import org.springframework.data.jpa.repository.JpaRepository;

@Repository
public interface AdminRepository extends JpaRepository<Admin, Long>{
	
}
