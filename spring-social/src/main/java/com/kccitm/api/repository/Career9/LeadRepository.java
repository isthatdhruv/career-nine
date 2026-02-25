package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.LeadType;
import com.kccitm.api.model.career9.OdooSyncStatus;

@Repository
public interface LeadRepository extends JpaRepository<Lead, Long> {

    List<Lead> findByLeadType(LeadType leadType);

    List<Lead> findByOdooSyncStatus(OdooSyncStatus odooSyncStatus);
}
