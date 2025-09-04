package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.BoardName;

@Repository
public interface BoardNameRepository extends JpaRepository<BoardName, Integer> {

    public List<BoardName> findAll();

    public BoardName findByName(String Name);

    public BoardName getOne(int id);

    public List<BoardName> findByDisplay(Boolean display);

    public Optional<BoardName> findById(int id);
    // public Role findByID(int id);
}