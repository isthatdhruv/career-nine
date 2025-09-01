package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Branch;

@Repository
public interface BranchRepository extends JpaRepository<Branch, Integer> {

    public List<Branch> findAll();

    public List<Branch> findByName(String Name);

    public Branch getOne(int id);

    public Optional<Branch> findById(int id);
    // public Role findByID(int id);
}