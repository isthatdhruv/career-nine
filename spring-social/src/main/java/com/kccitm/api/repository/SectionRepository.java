package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Section;

@Repository
public interface SectionRepository extends JpaRepository<Section, Integer> {

    public List<Section> findAll();

    public List<Section> findByName(String Name);

    public Section getOne(int id);

    public List<Section> findByDisplay(Boolean display);


    public Optional<Section> findById(int id);
    // public Role findByID(int id);
}