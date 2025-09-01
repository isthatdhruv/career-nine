package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Topic;

@Repository
public interface TopicRepository extends JpaRepository<Topic, Integer> {

    public List<Topic> findAll();

    // public List<Topic> findByDisplay(Boolean display);

    public List<Topic> findByName(String Name);

    public Topic getOne(int id);

    public Optional<Topic> findById(int id);

    @Query(value = "SELECT * FROM Topic t WHERE t.display = true", nativeQuery = true)
    public List<Topic> findByTopic();
}