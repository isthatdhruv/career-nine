package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Batch;

@Repository
public interface BatchRepository extends JpaRepository<Batch, Integer> {

    public List<Batch> findAll();

    public List<Batch> findByBatch(String Name);

    public Batch getOne(int id);

    public Optional<Batch> findById(int id);    

    // public Role findByID(int id);
}