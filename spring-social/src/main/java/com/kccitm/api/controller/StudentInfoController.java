package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
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
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

@GetMapping("/getStudentAnswersWithDetails")
    public ResponseEntity<?> getStudentAnswersWithDetails(
            @RequestParam Long userStudentId,
            @RequestParam Long assessmentId) {
        
        System.out.println("=== DEBUG INFO ===");
        System.out.println("Received request - userStudentId: " + userStudentId + ", assessmentId: " + assessmentId);
        
        try {
            // Check if there are any answers for this user_student_id
            Long totalAnswers = assessmentAnswerRepository.countByUserStudent_UserStudentId(userStudentId);
            System.out.println("Total answers for user_student_id " + userStudentId + ": " + totalAnswers);
            
            // Check for this specific assessment
            Long assessmentAnswers = assessmentAnswerRepository
                    .countByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);
            System.out.println("Answers for user_student_id " + userStudentId + " and assessment " + 
                    assessmentId + ": " + assessmentAnswers);
            
            // Get answers with question and option details using JOIN FETCH
            List<AssessmentAnswer> answers = assessmentAnswerRepository
                    .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);
            
            // Convert to Map format (similar to JDBC result)
            List<Map<String, Object>> results = new ArrayList<>();
            
            for (AssessmentAnswer answer : answers) {
                Map<String, Object> resultMap = new HashMap<>();
                
                // Add question details from QuestionnaireQuestion
                if (answer.getQuestionnaireQuestion() != null) {
                    resultMap.put("questionId", answer.getQuestionnaireQuestion().getQuestionnaireQuestionId());

                    if (answer.getQuestionnaireQuestion().getQuestion() != null) {
                        resultMap.put("questionText",
                                answer.getQuestionnaireQuestion().getQuestion().getQuestionText());
                    } else {
                        resultMap.put("questionText", null);
                    }

                    String excelHeader = answer.getQuestionnaireQuestion().getExcelQuestionHeader();
                    if (excelHeader == null || excelHeader.trim().isEmpty()) {
                        excelHeader = (answer.getQuestionnaireQuestion().getQuestion() != null)
                                ? answer.getQuestionnaireQuestion().getQuestion().getQuestionText()
                                : null;
                    }
                    resultMap.put("excelQuestionHeader", excelHeader);

                    if (answer.getQuestionnaireQuestion().getSection() != null
                            && answer.getQuestionnaireQuestion().getSection().getSection() != null) {
                        resultMap.put("sectionName",
                                answer.getQuestionnaireQuestion().getSection().getSection().getSectionName());
                    } else {
                        resultMap.put("sectionName", null);
                    }
                } else {
                    resultMap.put("questionId", null);
                    resultMap.put("questionText", null);
                    resultMap.put("excelQuestionHeader", null);
                    resultMap.put("sectionName", null);
                }
                
                // Add option details from AssessmentQuestionOptions
                if (answer.getOption() != null) {
                    resultMap.put("optionId", answer.getOption().getOptionId());
                    resultMap.put("optionText", answer.getOption().getOptionText());
                } else {
                    resultMap.put("optionId", null);
                    resultMap.put("optionText", null);
                }
                
                results.add(resultMap);
            }
            
            System.out.println("Final query results count: " + results.size());
            if (results.size() > 0) {
                System.out.println("First result: " + results.get(0));
            }
            System.out.println("=================");
            
            return ResponseEntity.ok(results);
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error fetching student answers: " + e.getMessage());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
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
                studentData.put("studentDob", si.getStudentDob());
                studentData.put("username", si.getUser().getUsername());

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
