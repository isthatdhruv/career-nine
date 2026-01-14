package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.InstituteDetail;

@Repository
public interface InstituteDetailRepository extends JpaRepository<InstituteDetail, Integer> {

    public List<InstituteDetail> findByDisplay(Boolean display);

    public List<InstituteDetail> findByInstituteName(String instituteName);

    public List<InstituteDetail> findByInstituteCode(int instituteCode);

    public List<InstituteDetail> findByInstituteAddress(String instituteAddress);

    public InstituteDetail getOne(int id);

    public InstituteDetail findById(int id);

    // @Query(value = "SELECT * FROM InstituteDetail i WHERE i.display = true",
    // nativeQuery = true)
    // public List<InstituteDetail> findAll();
    // public Role findByID(int id);
}