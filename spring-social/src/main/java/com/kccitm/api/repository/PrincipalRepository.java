package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Principal;

@Repository
public interface PrincipalRepository extends JpaRepository<Principal, Long>{
	
}
