package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstitueAcademic;

@Repository
public interface InstitueAcademicRepository extends JpaRepository<InstitueAcademic, Integer> {

    public List<InstitueAcademic> findAll();

    public List<InstitueAcademic> findByAcademicId(int academicId);

    public List<InstitueAcademic> findByAcademicName(String academicName);

    public List<InstitueAcademic> findByAcademicType(String academicType);

    public InstitueAcademic getOne(int id);

    public Optional<InstitueAcademic> findById(int id);
    // public Role findByID(int id);
}