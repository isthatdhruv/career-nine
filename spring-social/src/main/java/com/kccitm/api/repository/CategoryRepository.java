package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Category;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {

    public List<Category> findAll();

    public List<Category> findByName(String Name);

    public Category getOne(int id);

    public Optional<Category> findById(int id);
    // public Role findByID(int id);
}