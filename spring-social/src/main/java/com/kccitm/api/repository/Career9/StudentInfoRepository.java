package com.kccitm.api.repository.Career9;

import java.util.Date;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentInfo;

@Repository
public interface StudentInfoRepository extends JpaRepository<StudentInfo, Long> {

    StudentInfo findByUser(User user);

    List<StudentInfo> findByInstituteId(Integer instituteId);

    List<StudentInfo> findByEmailAndInstituteId(String email, Integer instituteId);

    List<StudentInfo> findByStudentDobAndInstituteIdAndStudentClass(Date studentDob, Integer instituteId,
            Integer studentClass);

    List<StudentInfo> findByNameIgnoreCaseAndStudentDobAndInstituteId(String name, Date studentDob,
            Integer instituteId);

    List<StudentInfo> findByNameIgnoreCaseAndPhoneNumberAndInstituteId(String name, String phoneNumber,
            Integer instituteId);

    List<StudentInfo> findByNameIgnoreCaseAndInstituteId(String name, Integer instituteId);

}
