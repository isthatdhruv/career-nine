package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Gender;

@Repository
public interface GenderRepository extends JpaRepository<Gender, Integer> {

    public List<Gender> findAll();

    public List<Gender> findBytype(String Type);

    public Gender getOne(int id);

    public Optional<Gender> findById(int id);
    // public Role findByID(int id);
}