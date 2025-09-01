package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Faculty;

@Repository
public interface FacultyRepository extends JpaRepository<Faculty, Integer> {

    public List<Faculty> findAll();

    public List<Faculty> findByPersonalEmailAddress(String Name);

    public Faculty getOne(int collegeIdentificationNumber);

    public Faculty findById(int collegeIdentificationNumber);

    public List<Faculty> getById(int collegeIdentificationNumber);

    // @Query(value ="SELECT * FROM faculty_metadata f WHERE f.display = true",
    // nativeQuery = true)
    // public List<Faculty> findByFaculty();
}
