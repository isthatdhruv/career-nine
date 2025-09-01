package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteBranch;

@Repository
public interface InstituteBranchRepository extends JpaRepository<InstituteBranch, Integer> {


    public List<InstituteBranch> findByBranchName(String branchName);

    public List<InstituteBranch> findByBranchId(int branchId);

    public List<InstituteBranch> findByCourseId(int courseId);

    // public List<InstituteBranch> findCourseByBranchId(int branchId);


    // public List<InstituteBranch> findByDisplay(Boolean display);

    public InstituteBranch getOne(int id);

    public InstituteBranch findById(int id);

    // @Query(value ="SELECT * FROM InstituteBranch i WHERE i.display = true", nativeQuery = true)
    // public List<InstituteBranch> findAll();
    // public Role findByID(int id);
}