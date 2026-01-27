package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.StudentInfo;

@Repository
public interface StudentInfoRepository extends JpaRepository<StudentInfo, Long> {

    List<StudentInfo> findByInstituteId(Integer instituteId);

}
