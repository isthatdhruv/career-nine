package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteBatch;

@Repository
public interface InstituteBatchRepository extends JpaRepository<InstituteBatch, Integer> {

    public List<InstituteBatch> findByBatchId(int batchId);

    public List<InstituteBatch> findByBatchStart(String batchStart);

    public List<InstituteBatch> findByBatchEnd(String batchEnd);

    public List<InstituteBatch> findByBatchDuration(int batchDuration);

    public List<InstituteBatch> findByBatchDurationType(String batchDurationType);

    public List<InstituteBatch> findByDisplay(Boolean display);

    // public List<InstituteBatch> findBranchByBatchId(int batchId);

    // public List<InstituteBatch> findByBranchId(int branchId);

    public InstituteBatch getOne(int id);

    public InstituteBatch findById(int id);

    // @Query(value ="SELECT * FROM InstituteBatch i WHERE i.display = true",
    // nativeQuery = true)
    // public List<InstituteBatch> findAll();
    // public Role findByID(int id);

}