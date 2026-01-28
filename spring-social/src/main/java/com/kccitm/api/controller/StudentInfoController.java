package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;

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
    @Autowired
    private NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

@GetMapping("/getStudentAnswersWithDetails")
public ResponseEntity<?> getStudentAnswersWithDetails(
        @RequestParam Integer userStudentId,
        @RequestParam Integer assessmentId) {
    
    System.out.println("=== DEBUG INFO ===");
    System.out.println("Received request - userStudentId: " + userStudentId + ", assessmentId: " + assessmentId);
    
    try {
        // First, let's check if there are any answers for this user_student_id
        String debugQuery = "SELECT COUNT(*) as count FROM assessment_answer WHERE user_student_id = :userStudentId";
        List<Map<String, Object>> debugResults = jdbcTemplate.queryForList(debugQuery,
                Map.of("userStudentId", userStudentId));
        System.out.println("Total answers for user_student_id " + userStudentId + ": " + debugResults.get(0).get("count"));
        
        // Check for this specific assessment
        String debugQuery2 = "SELECT COUNT(*) as count FROM assessment_answer WHERE user_student_id = :userStudentId AND assessment_id = :assessmentId";
        List<Map<String, Object>> debugResults2 = jdbcTemplate.queryForList(debugQuery2,
                Map.of("userStudentId", userStudentId, "assessmentId", assessmentId));
        System.out.println("Answers for user_student_id " + userStudentId + " and assessment " + assessmentId + ": " + debugResults2.get(0).get("count"));
        
        // Main query to get answers with question and option details
        String query = "SELECT aq.question_id as questionId, " +
                      "aq.question_text as questionText, " +
                      "aqo.option_id as optionId, " +
                      "aqo.option_text as optionText " +
                      "FROM assessment_answer aa " +
                      "INNER JOIN assessment_questions aq ON aa.questionnaire_question_id = aq.question_id " +
                      "INNER JOIN assessment_question_options aqo ON aa.option_id = aqo.option_id " +
                      "WHERE aa.user_student_id = :userStudentId " +
                      "AND aa.assessment_id = :assessmentId " +
                      "ORDER BY aq.question_id";
        
        List<Map<String, Object>> results = jdbcTemplate.queryForList(query,
                Map.of("userStudentId", userStudentId, "assessmentId", assessmentId));
        
        System.out.println("Final query results count: " + results.size());
        if (results.size() > 0) {
            System.out.println("First result: " + results.get(0));
        }
        System.out.println("=================");
        
        return ResponseEntity.ok(results);
        
    } catch (Exception e) {
        System.err.println("Error: " + e.getMessage());
        e.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Error fetching student answers: " + e.getMessage()));
    }
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
    public StudentAssessmentMapping alotAssessmentToStudent(
            @RequestBody StudentAssessmentMapping studentAssessmentMapping) {
        return studentAssessmentMappingRepository.save(studentAssessmentMapping);
    }

    @PostMapping("/bulkAlotAssessment")
    public List<StudentAssessmentMapping> bulkAlotAssessment(
            @RequestBody List<java.util.Map<String, Long>> assignments) {
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
    public List<java.util.Map<String, Object>> getStudentsWithMappingByInstituteId(
            @PathVariable("instituteId") Integer instituteId) {
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
                        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                                .findByUserStudentUserStudentId(us.getUserStudentId());
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
