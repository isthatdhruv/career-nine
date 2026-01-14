package com.kccitm.api.controller;

import java.sql.Date;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.Career9.UserStudentRepository;

@RestController
@RequestMapping("/student-info")
public class StudentInfoController {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StudentInfoRepository studentInfoRepository;
    @Autowired
    private UserStudentRepository userStudentRepository;

    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

    @PostMapping("/add")
    public StudentInfo addStudentInfo(@RequestBody StudentInfo studentInfo) {
        try {
            User user = userRepository.save(new User((int) (Math.random() * 1000),
                    studentInfo.getStudentDob()));
            studentInfo.setUser(user);
            // UserStudent userStudent = new UserStudent(user, studentInfo);
            // userStudentRepository.save(userStudent);
            return studentInfoRepository.save(studentInfo);
        } catch (Exception e) {
            System.out.println(e);
            return null;
        }
    }

    @PostMapping("/update")
    public StudentInfo updateStudentInfo(@RequestBody StudentInfo studentInfo) {
        return studentInfoRepository.save(studentInfo);
    }

    @PostMapping("/delete/{id}")
    public void deleteStudentInfo(@PathVariable("id") Long id) {
        studentInfoRepository.deleteById(id);
    }

}
