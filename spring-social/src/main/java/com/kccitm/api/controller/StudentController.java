package com.kccitm.api.controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.model.Student; 


@RestController
@RequestMapping("/student")
public class StudentController {
    @Autowired
    private StudentRepository studentRepository;
    
    @GetMapping("/all")
    public List<Student> getAllStudents() {
        return studentRepository.findAll();
    }

    @PostMapping("/add")
    public Student addStudent(@RequestBody Student student) {
        return studentRepository.save(student);
    }
}