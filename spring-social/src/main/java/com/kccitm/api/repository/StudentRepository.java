package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Student;

@Repository
public interface StudentRepository extends JpaRepository<Student, Integer> {

    public List<Student> findAll();

    public List<Student> findByPersonalEmailAddress(String Name);

    public Student getOne(int id);

    public Student findById(int id);

    public Student getByPersonalEmailAddress(String Name);

    public Student getByWebcamPhoto(String Name);

    public List<Student> getById(int id);
    // @Modifying
    // @Query(value = "delete from Student where name = :webcamPhoto")
    // void deleteBywebcamPhoto(@Param("webcamPhoto") String webcamPhoto);  

    // public Role findByID(int id);
}