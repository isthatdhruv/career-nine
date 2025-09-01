package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteCourse;

@Repository
public interface InstituteCourseRepository extends JpaRepository<InstituteCourse, Integer> {


    public InstituteCourse findByCourseName(String courseName);

    // public List<InstituteCourse> findByCourseCode(int courseCode);


    public List<InstituteCourse> findByInstituteId(int instituteId);

    // public List<InstituteCourse> findByDisplay(Boolean display);

    // // public List<InstituteCourse> findCollegeByCourse(int instituteId );

    public InstituteCourse getOne(int id);

    // public Optional<InstituteCourse> findById(int id);

    @Query("SELECT a.courseCode , a.abbreviation FROM InstituteCourse a")
    public List<InstituteCourse> findOnlyCourseCodeAndAbbCourses();
    

    // @Query(value ="SELECT * FROM InstituteCourse i WHERE i.display = true", nativeQuery = true)
    // public List<InstituteCourse> findAll();
    // public Role findByID(int id);
}