package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.userDefinedModel.ExcelOptionData;
import com.kccitm.api.model.userDefinedModel.MeasuredQualityList;
import com.kccitm.api.model.userDefinedModel.QuestionOptionID;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
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
    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;
    @Autowired
    private com.kccitm.api.repository.Career9.AssessmentTableRepository assessmentTableRepository;

    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

    @GetMapping("/getStudentAnswersWithDetails")
    public ExcelOptionData getStudentAnswersWithDetails(
            @RequestParam Long userStudentId,
            @RequestParam Long assessmentId) {
        
        var assessmentAnswers = assessmentAnswerRepository.findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);
        
        // Transform AssessmentAnswer entities to QuestionOptionID DTOs
        ArrayList<QuestionOptionID> questionOptionList = assessmentAnswers.stream()
            .map(aa -> {
                // Create measured quality list from option scores
                ArrayList<MeasuredQualityList> measuredList = new ArrayList<>();
                if (aa.getOption() != null && aa.getOption().getOptionScores() != null) {
                    measuredList = aa.getOption().getOptionScores().stream()
                        .map(os -> new MeasuredQualityList(
                            os.getMeasuredQualityType().getMeasuredQualityTypeName(),
                            os.getScore(),
                            os.getMeasuredQualityType().getMeasuredQuality() != null 
                                ? os.getMeasuredQualityType().getMeasuredQuality().getMeasuredQualityName() 
                                : null
                        ))
                        .collect(Collectors.toCollection(ArrayList::new));
                }
                
                return new QuestionOptionID(
                    aa.getQuestionnaireQuestion().getQuestionnaireQuestionId(),
                    aa.getOption().getOptionId(),
                    measuredList
                );
            })
            .collect(Collectors.toCollection(ArrayList::new));
        
        return new ExcelOptionData(
            userStudentRepository.getNameByUserID(userStudentId),
            questionOptionList
        );
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
            
            // if (studentInfo.getAssesment_id() != null && !studentInfo.getAssesment_id().isEmpty()) {
               var assessmentId = Long.parseLong(studentInfo.getAssesment_id());
            // }

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
    @org.springframework.transaction.annotation.Transactional
    public synchronized List<StudentAssessmentMapping> bulkAlotAssessment(
            @RequestBody List<java.util.Map<String, Long>> assignments) {
        List<StudentAssessmentMapping> savedMappings = new java.util.ArrayList<>();
        
        // Deduplicate assignments in the request itself
        java.util.Set<String> processedKeys = new java.util.HashSet<>();
        
        for (java.util.Map<String, Long> assignment : assignments) {
            Long userStudentId = assignment.get("userStudentId");
            Long assessmentId = assignment.get("assessmentId");
            
            if (userStudentId != null && assessmentId != null) {
                // Check for duplicates within the same request
                String key = userStudentId + "-" + assessmentId;
                if (processedKeys.contains(key)) {
                    continue; // Skip duplicate in same request
                }
                processedKeys.add(key);
                
                // Check if mapping already exists in database
                java.util.Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(
                                userStudentId, assessmentId);

                if (existingMapping.isEmpty()) {
                    // Only create new mapping if it doesn't exist
                    StudentAssessmentMapping mapping = new StudentAssessmentMapping(userStudentId, assessmentId);
                    savedMappings.add(studentAssessmentMappingRepository.save(mapping));
                }
                // If mapping exists, skip (don't create duplicate)
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

                        // Get ALL assessment mappings for this student
                        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                                .findByUserStudentUserStudentId(us.getUserStudentId());

                        // Return all assigned assessment IDs
                        List<Long> assignedAssessmentIds = new java.util.ArrayList<>();
                        for (StudentAssessmentMapping mapping : mappings) {
                            assignedAssessmentIds.add(mapping.getAssessmentId());
                        }
                        studentData.put("assignedAssessmentIds", assignedAssessmentIds);

                        // Return full assessment details (id, name, status)
                        List<java.util.Map<String, Object>> assessmentDetails = new java.util.ArrayList<>();
                        for (StudentAssessmentMapping mapping : mappings) {
                            java.util.Map<String, Object> detail = new java.util.HashMap<>();
                            detail.put("assessmentId", mapping.getAssessmentId());
                            detail.put("status", mapping.getStatus());
                            // Get assessment name
                            java.util.Optional<com.kccitm.api.model.career9.AssessmentTable> assessment = assessmentTableRepository
                                    .findById(mapping.getAssessmentId());
                            if (assessment.isPresent()) {
                                detail.put("assessmentName", assessment.get().getAssessmentName());
                            } else {
                                detail.put("assessmentName", "Unknown");
                            }
                            assessmentDetails.add(detail);
                        }
                        studentData.put("assessments", assessmentDetails);

                        // Also keep the latest for backward compatibility
                        if (!mappings.isEmpty()) {
                            StudentAssessmentMapping latestMapping = mappings.get(mappings.size() - 1);
                            studentData.put("assessmentId", latestMapping.getAssessmentId());
                        } else {
                            studentData.put("assessmentId", null);
                        }
                    } else {
                        studentData.put("userStudentId", null);
                        studentData.put("assessmentId", null);
                        studentData.put("assignedAssessmentIds", new java.util.ArrayList<>());
                        studentData.put("assessments", new java.util.ArrayList<>());
                    }
                } catch (Exception e) {
                    System.out.println("Error finding mapping for student " + si.getId() + ": " + e.getMessage());
                    studentData.put("userStudentId", null);
                    studentData.put("assessmentId", null);
                    studentData.put("assignedAssessmentIds", new java.util.ArrayList<>());
                    studentData.put("assessments", new java.util.ArrayList<>());
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

    @GetMapping("/getDemographics/{userStudentId}")
    public ResponseEntity<?> getDemographics(@PathVariable("userStudentId") Long userStudentId) {
        try {
            // Find UserStudent by userStudentId
            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElse(null);

            if (userStudent == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Student not found with userStudentId: " + userStudentId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            // Get associated StudentInfo
            StudentInfo studentInfo = userStudent.getStudentInfo();

            if (studentInfo == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Student info not found for userStudentId: " + userStudentId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            // Build response with demographic data
            Map<String, Object> response = new HashMap<>();
            response.put("name", studentInfo.getName());
            response.put("gender", studentInfo.getGender());
            response.put("studentClass", studentInfo.getStudentClass());
            response.put("schoolBoard", studentInfo.getSchoolBoard());
            response.put("sibling", studentInfo.getSibling());
            response.put("family", studentInfo.getFamily());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("Error fetching demographics: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to fetch demographics: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/updateDemographics")
    public ResponseEntity<?> updateDemographics(@RequestBody Map<String, Object> request) {
        try {
            Long userStudentId = Long.valueOf(request.get("userStudentId").toString());

            // Find UserStudent by userStudentId
            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElse(null);

            if (userStudent == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Student not found with userStudentId: " + userStudentId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            // Get associated StudentInfo
            StudentInfo studentInfo = userStudent.getStudentInfo();

            // Update fields if present in request
            if (request.containsKey("name")) {
                studentInfo.setName(request.get("name").toString());
            }
            if (request.containsKey("gender")) {
                studentInfo.setGender(request.get("gender").toString());
            }
            if (request.containsKey("sibling")) {
                Object siblingVal = request.get("sibling");
                if (siblingVal != null) {
                    studentInfo.setSibling(Integer.valueOf(siblingVal.toString()));
                }
            }
            if (request.containsKey("family")) {
                studentInfo.setFamily(request.get("family").toString());
            }
            if (request.containsKey("schoolBoard")) {
                studentInfo.setSchoolBoard(request.get("schoolBoard").toString());
            }
            if (request.containsKey("studentClass")) {
                Object classVal = request.get("studentClass");
                if (classVal != null) {
                    studentInfo.setStudentClass(Integer.valueOf(classVal.toString()));
                }
            }

            // Save updated StudentInfo
            StudentInfo saved = studentInfoRepository.save(studentInfo);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Demographics updated successfully");
            response.put("studentInfo", saved);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("Error updating demographics: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to update demographics: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/resetAssessment")
    @javax.transaction.Transactional
    public ResponseEntity<?> resetAssessment(@RequestBody Map<String, Long> request) {
        try {
            Long userStudentId = request.get("userStudentId");
            Long assessmentId = request.get("assessmentId");

            if (userStudentId == null || assessmentId == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "userStudentId and assessmentId are required");
                return ResponseEntity.badRequest().body(error);
            }

            // Find the mapping
            java.util.Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

            if (mappingOpt.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "No assessment mapping found for this student and assessment");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            StudentAssessmentMapping mapping = mappingOpt.get();

            // Delete raw scores for this mapping
            assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(
                    mapping.getStudentAssessmentId());

            // Reset status to 'notstarted'
            mapping.setStatus("notstarted");
            studentAssessmentMappingRepository.save(mapping);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Assessment reset successfully");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("Error resetting assessment: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to reset assessment: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

}
