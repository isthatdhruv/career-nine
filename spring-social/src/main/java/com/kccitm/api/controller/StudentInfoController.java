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

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
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
    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

    @PostMapping("/add")
    public StudentAssessmentMapping addStudentInfo(@RequestBody StudentInfo studentInfo) {
        try {
            User user = userRepository.save(new User((int) (Math.random() * 1000),
                    studentInfo.getStudentDob()));
            studentInfo.setUser(user);
            Integer instituteId = studentInfo.getInstituteId();
            UserStudent userStudent = new UserStudent(user, studentInfoRepository.save(studentInfo),
                    instituteDetailRepository.getById(instituteId));
            UserStudent userStudentSAVED = userStudentRepository.save(userStudent);
            
            // Use assessment ID from request, default to 11 if not provided
            Long assessmentId = 11L;
            if (studentInfo.getAssesment_id() != null && !studentInfo.getAssesment_id().isEmpty()) {
                assessmentId = Long.parseLong(studentInfo.getAssesment_id());
            }
            
            StudentAssessmentMapping studentAssessmentMapping = studentAssessmentMappingRepository.save(
                    new StudentAssessmentMapping(userStudentSAVED.getUserStudentId(), assessmentId));
            return studentAssessmentMapping;
        } catch (Exception e) {
            System.out.println(e);
            return null;
        }
    }

    @PostMapping("/alotAssessmentToStudent")
    public StudentAssessmentMapping alotAssessmentToStudent(@RequestBody StudentAssessmentMapping studentAssessmentMapping) {
        return studentAssessmentMappingRepository.save(studentAssessmentMapping);
    }

    @PostMapping("/bulkAlotAssessment")
    public List<StudentAssessmentMapping> bulkAlotAssessment(@RequestBody List<java.util.Map<String, Long>> assignments) {
        List<StudentAssessmentMapping> savedMappings = new java.util.ArrayList<>();
        for (java.util.Map<String, Long> assignment : assignments) {
            Long userStudentId = assignment.get("userStudentId");
            Long assessmentId = assignment.get("assessmentId");
            if (userStudentId != null && assessmentId != null) {
                StudentAssessmentMapping mapping = new StudentAssessmentMapping(userStudentId, assessmentId);
                savedMappings.add(studentAssessmentMappingRepository.save(mapping));
            }
        }
        return savedMappings;
    }

    @GetMapping("/getByInstituteId/{instituteId}")
    public List<StudentInfo> getByInstituteId(@PathVariable("instituteId") Integer instituteId) {
        return studentInfoRepository.findByInstituteId(instituteId);
    }

    @GetMapping("/getStudentsWithMappingByInstituteId/{instituteId}")
    public List<java.util.Map<String, Object>> getStudentsWithMappingByInstituteId(@PathVariable("instituteId") Integer instituteId) {
        try {
            List<StudentInfo> students = studentInfoRepository.findByInstituteId(instituteId);
            List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
            
            for (StudentInfo si : students) {
                java.util.Map<String, Object> studentData = new java.util.HashMap<>();
                studentData.put("id", si.getId());
                studentData.put("name", si.getName());
                studentData.put("schoolRollNumber", si.getSchoolRollNumber());
                studentData.put("phoneNumber", si.getPhoneNumber());
                studentData.put("email", si.getEmail());
                studentData.put("instituteId", si.getInstituteId());
                
                // Find UserStudent for this StudentInfo to get userStudentId
                try {
                    List<UserStudent> userStudentList = userStudentRepository.findByStudentInfoId(si.getId());
                    if (!userStudentList.isEmpty()) {
                        UserStudent us = userStudentList.get(0); // Take the first one if multiple exist
                        studentData.put("userStudentId", us.getUserStudentId());
                        
                        // Get current assessment mapping if exists - use userStudentId directly
                        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository.findByUserStudentUserStudentId(us.getUserStudentId());
                        if (!mappings.isEmpty()) {
                            // Get the latest mapping (last one)
                            StudentAssessmentMapping latestMapping = mappings.get(mappings.size() - 1);
                            studentData.put("assessmentId", latestMapping.getAssessmentId());
                        } else {
                            studentData.put("assessmentId", null);
                        }
                    } else {
                        studentData.put("userStudentId", null);
                        studentData.put("assessmentId", null);
                    }
                } catch (Exception e) {
                    System.out.println("Error finding mapping for student " + si.getId() + ": " + e.getMessage());
                    studentData.put("userStudentId", null);
                    studentData.put("assessmentId", null);
                }
                
                result.add(studentData);
            }
            return result;
        } catch (Exception e) {
            System.out.println("Error in getStudentsWithMappingByInstituteId: " + e.getMessage());
            e.printStackTrace();
            return new java.util.ArrayList<>();
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
