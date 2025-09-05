package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteBatchGoogleGroup;

@Repository
public interface InstituteBatchGoogleGroupRepository extends JpaRepository<InstituteBatchGoogleGroup, Integer>{
    public List<InstituteBatchGoogleGroup> findByName(String Name);
    public InstituteBatchGoogleGroup findByInstituteBatchId(int Name);
    public InstituteBatchGoogleGroup findById(int id);
    
}
