package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CheckFacultyRegistrationField;

import java.util.List;

@Repository
public interface CheckFacultyRegistrationFieldRepository extends JpaRepository<CheckFacultyRegistrationField, Integer>{

    public List<CheckFacultyRegistrationField> findAll();

    // public List<CheckRegistrationFeild> findByEmailAddress(String Name);

    public CheckFacultyRegistrationField getOne(int id);

    public CheckFacultyRegistrationField findById(int id);
}
