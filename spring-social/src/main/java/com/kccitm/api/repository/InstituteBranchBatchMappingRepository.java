package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteBranchBatchMapping;

@Repository
public interface InstituteBranchBatchMappingRepository extends JpaRepository<InstituteBranchBatchMapping, Integer> {

    public List<InstituteBranchBatchMapping> findAll();

    public List<InstituteBranchBatchMapping> findByDisplay(Boolean display);

    public List<InstituteBranchBatchMapping> findByBranchId(int instituteBranchId );

    public List<InstituteBranchBatchMapping> findByBatchId(int instituteBatchId);

    // public List<InstituteBranchBatchMapping> findByBatchId(int batchId);

    // public List<InstituteBranchBatchMapping> findByBranchId(int instituteBranchId);

    public InstituteBranchBatchMapping getOne(int id);

}