package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CheckRegistrationFeild;

@Repository
public interface CheckRegistrationFeildRepository extends JpaRepository<CheckRegistrationFeild, Integer> {

    public List<CheckRegistrationFeild> findAll();

    // public List<CheckRegistrationFeild> findByEmailAddress(String Name);

    public CheckRegistrationFeild getOne(int id);

    public CheckRegistrationFeild findById(int id);

    // public void save(CheckRegistrationFeild df);    

    // public Role findByID(int id);
}
