package com.kccitm.api.controller;

import java.io.ByteArrayOutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.userDefinedModel.ExcelOptionData;
import com.kccitm.api.model.userDefinedModel.MeasuredQualityList;
import com.kccitm.api.model.userDefinedModel.QuestionOptionID;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
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
    @Autowired
    private com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository assessmentProctoringQuestionLogRepository;
    @Autowired
    private com.kccitm.api.service.CareerNineRollNumberService rollNumberService;
    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired
    private com.kccitm.api.service.AssessmentSessionService assessmentSessionService;
    @Autowired
    private com.kccitm.api.repository.Career9.School.SchoolSectionsRepository schoolSectionsRepository;

    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

    @GetMapping("/getStudentAnswersWithDetails")
    public List<Map<String, Object>> getStudentAnswersWithDetails(
            @RequestParam Long userStudentId,
            @RequestParam Long assessmentId) {

        var assessmentAnswers = assessmentAnswerRepository.findByUserStudentIdAndAssessmentIdWithDetails(userStudentId,
                assessmentId);

        return assessmentAnswers.stream()
                .map(aa -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("questionId", aa.getQuestionnaireQuestion() != null
                            ? aa.getQuestionnaireQuestion().getQuestionnaireQuestionId() : null);

                    // Question text - try QuestionnaireQuestion first, fall back to option's parent question
                    String questionText = "";
                    if (aa.getQuestionnaireQuestion() != null && aa.getQuestionnaireQuestion().getQuestion() != null) {
                        questionText = aa.getQuestionnaireQuestion().getQuestion().getQuestionText();
                    } else if (aa.getOption() != null && aa.getOption().getQuestion() != null) {
                        questionText = aa.getOption().getQuestion().getQuestionText();
                    }
                    row.put("questionText", questionText);

                    // Option ID and text
                    row.put("optionId", aa.getOption() != null ? aa.getOption().getOptionId() : null);
                    row.put("optionText", aa.getOption() != null ? aa.getOption().getOptionText() : "");

                    // Option number (1-based index) - useful when option is an image
                    int optionNumber = 0;
                    boolean isImageOption = false;
                    if (aa.getOption() != null && aa.getQuestionnaireQuestion() != null
                            && aa.getQuestionnaireQuestion().getQuestion() != null
                            && aa.getQuestionnaireQuestion().getQuestion().getOptions() != null) {
                        Long selectedOptionId = aa.getOption().getOptionId();
                        var allOptions = aa.getQuestionnaireQuestion().getQuestion().getOptions();
                        for (int i = 0; i < allOptions.size(); i++) {
                            if (allOptions.get(i).getOptionId().equals(selectedOptionId)) {
                                optionNumber = i + 1;
                                break;
                            }
                        }
                        isImageOption = (aa.getOption().getOptionText() == null
                                || aa.getOption().getOptionText().trim().isEmpty())
                                && aa.getOption().getOptionImage() != null
                                && aa.getOption().getOptionImage().length > 0;
                    }
                    row.put("optionNumber", optionNumber);
                    row.put("isImageOption", isImageOption);

                    // Section name (QuestionnaireQuestion -> section -> section -> sectionName)
                    String sectionName = "";
                    try {
                        if (aa.getQuestionnaireQuestion() != null
                                && aa.getQuestionnaireQuestion().getSection() != null
                                && aa.getQuestionnaireQuestion().getSection().getSection() != null) {
                            sectionName = aa.getQuestionnaireQuestion().getSection().getSection().getSectionName();
                        }
                    } catch (Exception e) {
                        sectionName = "";
                    }
                    row.put("sectionName", sectionName != null ? sectionName : "");

                    // Excel question header
                    String excelHeader = "";
                    if (aa.getQuestionnaireQuestion() != null) {
                        excelHeader = aa.getQuestionnaireQuestion().getExcelQuestionHeader();
                    }
                    row.put("excelQuestionHeader", excelHeader != null ? excelHeader : "");

                    return row;
                })
                .collect(Collectors.toList());
    }

    @PostMapping("/getBulkStudentAnswersWithDetails")
    public List<Map<String, Object>> getBulkStudentAnswersWithDetails(
            @RequestBody List<Map<String, Long>> studentAssessmentPairs) {

        List<Map<String, Object>> allRows = new ArrayList<>();

        for (Map<String, Long> pair : studentAssessmentPairs) {
            Long userStudentId = pair.get("userStudentId");
            Long assessmentId = pair.get("assessmentId");
            if (userStudentId == null || assessmentId == null) continue;

            String studentName = userStudentRepository.getNameByUserID(userStudentId);

            // Get assessment name
            String assessmentName = "";
            try {
                var assessmentOpt = assessmentTableRepository.findById(assessmentId);
                if (assessmentOpt.isPresent()) {
                    assessmentName = assessmentOpt.get().getAssessmentName();
                }
            } catch (Exception e) {
                assessmentName = "";
            }

            var assessmentAnswers = assessmentAnswerRepository
                    .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

            for (var aa : assessmentAnswers) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("studentName", studentName != null ? studentName : "");
                row.put("userStudentId", userStudentId);
                row.put("assessmentId", assessmentId);
                row.put("assessmentName", assessmentName);

                row.put("questionId", aa.getQuestionnaireQuestion() != null
                        ? aa.getQuestionnaireQuestion().getQuestionnaireQuestionId() : null);

                String questionText = "";
                if (aa.getQuestionnaireQuestion() != null && aa.getQuestionnaireQuestion().getQuestion() != null) {
                    questionText = aa.getQuestionnaireQuestion().getQuestion().getQuestionText();
                }
                row.put("questionText", questionText);

                row.put("optionId", aa.getOption() != null ? aa.getOption().getOptionId() : null);
                row.put("optionText", aa.getOption() != null ? aa.getOption().getOptionText() : "");
                row.put("textResponse", aa.getTextResponse() != null ? aa.getTextResponse() : "");

                // Option number (1-based index) - useful when option is an image
                int optionNumber = 0;
                boolean isImageOption = false;
                if (aa.getOption() != null && aa.getQuestionnaireQuestion() != null
                        && aa.getQuestionnaireQuestion().getQuestion() != null
                        && aa.getQuestionnaireQuestion().getQuestion().getOptions() != null) {
                    Long selectedOptionId = aa.getOption().getOptionId();
                    var allOptions = aa.getQuestionnaireQuestion().getQuestion().getOptions();
                    for (int i = 0; i < allOptions.size(); i++) {
                        if (allOptions.get(i).getOptionId().equals(selectedOptionId)) {
                            optionNumber = i + 1;
                            break;
                        }
                    }
                    isImageOption = (aa.getOption().getOptionText() == null
                            || aa.getOption().getOptionText().trim().isEmpty())
                            && aa.getOption().getOptionImage() != null
                            && aa.getOption().getOptionImage().length > 0;
                }
                row.put("optionNumber", optionNumber);
                row.put("isImageOption", isImageOption);

                String sectionName = "";
                try {
                    if (aa.getQuestionnaireQuestion() != null
                            && aa.getQuestionnaireQuestion().getSection() != null
                            && aa.getQuestionnaireQuestion().getSection().getSection() != null) {
                        sectionName = aa.getQuestionnaireQuestion().getSection().getSection().getSectionName();
                    }
                } catch (Exception e) {
                    sectionName = "";
                }
                row.put("sectionName", sectionName != null ? sectionName : "");

                String excelHeader = "";
                if (aa.getQuestionnaireQuestion() != null) {
                    excelHeader = aa.getQuestionnaireQuestion().getExcelQuestionHeader();
                }
                row.put("excelQuestionHeader", excelHeader != null ? excelHeader : "");

                allRows.add(row);
            }
        }

        return allRows;
    }

    @PostMapping("/add")
    public StudentAssessmentMapping addStudentInfo(@RequestBody StudentInfo studentInfo) {
        try {
            System.out.println("[DEBUG addStudentInfo] Received: name=" + studentInfo.getName()
                + ", rollNo=" + studentInfo.getSchoolRollNumber()
                + ", assesment_id=" + studentInfo.getAssesment_id()
                + ", instituteId=" + studentInfo.getInstituteId());

            User user = userRepository.save(new User((int) (Math.random() * 1000),
                    studentInfo.getStudentDob()));

            // Generate and set careerNineRollNumber
            String rollNumber = rollNumberService.generateNextRollNumber(
                    studentInfo.getInstituteId(), studentInfo.getSchoolSectionId());
            if (rollNumber != null) {
                user.setCareerNineRollNumber(rollNumber);
                user = userRepository.save(user);
            }

            studentInfo.setUser(user);
            Integer instituteId = studentInfo.getInstituteId();
            UserStudent userStudent = new UserStudent(user, studentInfoRepository.save(studentInfo),
                    instituteDetailRepository.getById(instituteId));
            UserStudent userStudentSAVED = userStudentRepository.save(userStudent);

            var assessmentId = Long.parseLong(studentInfo.getAssesment_id());

            System.out.println("[DEBUG addStudentInfo] Creating mapping: userStudentId="
                + userStudentSAVED.getUserStudentId() + ", assessmentId=" + assessmentId);

            // Check if mapping already exists before creating (prevent duplicates)
            StudentAssessmentMapping studentAssessmentMapping = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(
                            userStudentSAVED.getUserStudentId(), assessmentId)
                    .orElseGet(() -> studentAssessmentMappingRepository.save(
                            new StudentAssessmentMapping(userStudentSAVED.getUserStudentId(), assessmentId)));

            return studentAssessmentMapping;
        } catch (Exception e) {
            System.out.println("[DEBUG addStudentInfo] ERROR: " + e.getMessage());
            e.printStackTrace();
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
                studentData.put("schoolSectionId", si.getSchoolSectionId());
                studentData.put("controlNumber", si.getControlNumber());
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

                        // Deduplicate mappings by assessmentId (keep the first occurrence)
                        java.util.Map<Long, StudentAssessmentMapping> uniqueMappings = new java.util.LinkedHashMap<>();
                        for (StudentAssessmentMapping mapping : mappings) {
                            uniqueMappings.putIfAbsent(mapping.getAssessmentId(), mapping);
                        }
                        List<StudentAssessmentMapping> deduplicatedMappings = new java.util.ArrayList<>(uniqueMappings.values());

                        // Return all assigned assessment IDs (deduplicated)
                        List<Long> assignedAssessmentIds = new java.util.ArrayList<>();
                        for (StudentAssessmentMapping mapping : deduplicatedMappings) {
                            assignedAssessmentIds.add(mapping.getAssessmentId());
                        }
                        studentData.put("assignedAssessmentIds", assignedAssessmentIds);

                        // Return full assessment details (id, name, status) - deduplicated
                        List<java.util.Map<String, Object>> assessmentDetails = new java.util.ArrayList<>();
                        for (StudentAssessmentMapping mapping : deduplicatedMappings) {
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
            response.put("schoolSectionId", studentInfo.getSchoolSectionId());
            if (studentInfo.getUser() != null) {
                response.put("username", studentInfo.getUser().getUsername());
            }

            // Look up class name and section name from schoolSectionId
            if (studentInfo.getSchoolSectionId() != null) {
                schoolSectionsRepository.findById(studentInfo.getSchoolSectionId()).ifPresent(section -> {
                    response.put("sectionName", section.getSectionName());
                    if (section.getSchoolClasses() != null) {
                        response.put("className", section.getSchoolClasses().getClassName());
                    }
                });
            }

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

            // Delete assessment answers for this student + assessment
            assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(
                    userStudentId, assessmentId);

            // Delete raw scores for this mapping
            assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(
                    mapping.getStudentAssessmentId());

            // Delete proctoring data for this student + assessment
            assessmentProctoringQuestionLogRepository.deleteByUserStudentUserStudentIdAndAssessmentId(
                    userStudentId, assessmentId);

            // Clear all Redis state for this student+assessment to prevent:
            // 1. Auto-flush writing stale partial answers back to MySQL
            // 2. Retry scheduler re-processing old submitted answers
            assessmentSessionService.deleteSession(userStudentId, assessmentId);
            assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);
            assessmentSessionService.deletePartialAnswers(userStudentId, assessmentId);
            assessmentSessionService.deleteSubmittedAnswers(userStudentId, assessmentId);

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

    @GetMapping("/getStudentScores")
    public ResponseEntity<?> getStudentScores(
            @RequestParam Long userStudentId,
            @RequestParam Long assessmentId) {
        try {
            // Find the student assessment mapping
            Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

            if (mappingOpt.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "No assessment mapping found for this student and assessment");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            StudentAssessmentMapping mapping = mappingOpt.get();

            // Get raw scores for this mapping
            List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                    .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

            // Get student info
            UserStudent userStudent = userStudentRepository.findById(userStudentId).orElse(null);
            StudentInfo studentInfo = userStudent != null ? userStudent.getStudentInfo() : null;

            // Build response
            Map<String, Object> response = new HashMap<>();

            // Student details
            Map<String, Object> studentDetails = new HashMap<>();
            if (studentInfo != null) {
                studentDetails.put("name", studentInfo.getName());
                studentDetails.put("rollNumber", studentInfo.getSchoolRollNumber());
                studentDetails.put("studentClass", studentInfo.getStudentClass());
                studentDetails.put("dob", studentInfo.getStudentDob());
            }
            response.put("student", studentDetails);

            // Scores list
            List<Map<String, Object>> scoresList = rawScores.stream().map(score -> {
                Map<String, Object> scoreMap = new HashMap<>();
                if (score.getMeasuredQualityType() != null) {
                    scoreMap.put("measuredQualityTypeName", score.getMeasuredQualityType().getMeasuredQualityTypeName());
                    scoreMap.put("measuredQualityTypeDisplayName",
                            score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName() != null
                                    ? score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName()
                                    : score.getMeasuredQualityType().getMeasuredQualityTypeName());
                }
                if (score.getMeasuredQuality() != null) {
                    scoreMap.put("measuredQualityName", score.getMeasuredQuality().getMeasuredQualityName());
                }
                scoreMap.put("rawScore", score.getRawScore());
                return scoreMap;
            }).collect(Collectors.toList());

            response.put("scores", scoresList);
            response.put("status", mapping.getStatus());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("Error fetching student scores: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to fetch student scores: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/exportScoresByInstitute/{instituteId}")
    public ResponseEntity<?> exportScoresByInstitute(
            @PathVariable("instituteId") Integer instituteId,
            @RequestParam Long assessmentId) {
        try {
            // Get all UserStudents for this institute
            List<UserStudent> userStudents = userStudentRepository.findByInstituteInstituteCode(instituteId);

            if (userStudents.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "No students found for this institute");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            // Collect all student assessment mappings for the given assessment
            List<Long> mappingIds = new ArrayList<>();
            Map<Long, StudentAssessmentMapping> mappingByUserStudentId = new HashMap<>();

            for (UserStudent us : userStudents) {
                Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(us.getUserStudentId(), assessmentId);
                if (mappingOpt.isPresent() && "completed".equals(mappingOpt.get().getStatus())) {
                    StudentAssessmentMapping mapping = mappingOpt.get();
                    mappingIds.add(mapping.getStudentAssessmentId());
                    mappingByUserStudentId.put(us.getUserStudentId(), mapping);
                }
            }

            // Get all raw scores for these mappings in one query
            List<AssessmentRawScore> allScores = mappingIds.isEmpty()
                    ? new ArrayList<>()
                    : assessmentRawScoreRepository.findByStudentAssessmentMappingStudentAssessmentIdIn(mappingIds);

            // Group scores by MeasuredQuality -> MeasuredQualityType
            // Build ordered structure: Quality -> [Type1, Type2, ...]
            Map<String, Set<String>> qualityToTypesOrdered = new LinkedHashMap<>();
            Map<Long, Map<String, Integer>> scoresByMappingId = new HashMap<>();

            for (AssessmentRawScore score : allScores) {
                Long mappingId = score.getStudentAssessmentMapping().getStudentAssessmentId();

                String qualityName = "";
                if (score.getMeasuredQuality() != null) {
                    qualityName = score.getMeasuredQuality().getQualityDisplayName() != null
                            ? score.getMeasuredQuality().getQualityDisplayName()
                            : score.getMeasuredQuality().getMeasuredQualityName();
                } else if (score.getMeasuredQualityType() != null && score.getMeasuredQualityType().getMeasuredQuality() != null) {
                    MeasuredQualities mq = score.getMeasuredQualityType().getMeasuredQuality();
                    qualityName = mq.getQualityDisplayName() != null ? mq.getQualityDisplayName() : mq.getMeasuredQualityName();
                }
                if (qualityName == null || qualityName.isEmpty()) qualityName = "Other";

                String typeName = score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName() != null
                        ? score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName()
                        : score.getMeasuredQualityType().getMeasuredQualityTypeName();

                qualityToTypesOrdered.computeIfAbsent(qualityName, k -> new LinkedHashSet<>()).add(typeName);

                scoresByMappingId.computeIfAbsent(mappingId, k -> new HashMap<>())
                        .put(typeName, score.getRawScore());
            }

            // Build flat column list: for each quality -> individual types + cumulative
            List<String> columnHeaders = new ArrayList<>();
            List<String> columnQualityGroup = new ArrayList<>(); // tracks which quality each col belongs to
            List<Boolean> isCumulativeCol = new ArrayList<>();

            for (Map.Entry<String, Set<String>> entry : qualityToTypesOrdered.entrySet()) {
                String qualityName = entry.getKey();
                Set<String> types = entry.getValue();
                for (String typeName : types) {
                    columnHeaders.add(typeName);
                    columnQualityGroup.add(qualityName);
                    isCumulativeCol.add(false);
                }
                // Add cumulative column for this quality
                columnHeaders.add(qualityName + " (Total)");
                columnQualityGroup.add(qualityName);
                isCumulativeCol.add(true);
            }

            // Create Excel workbook
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("Student Scores");

            // Create header styles
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            CellStyle qualityHeaderStyle = workbook.createCellStyle();
            Font qualityFont = workbook.createFont();
            qualityFont.setBold(true);
            qualityFont.setColor(IndexedColors.WHITE.getIndex());
            qualityHeaderStyle.setFont(qualityFont);
            qualityHeaderStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            qualityHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle totalHeaderStyle = workbook.createCellStyle();
            Font totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalFont.setColor(IndexedColors.WHITE.getIndex());
            totalHeaderStyle.setFont(totalFont);
            totalHeaderStyle.setFillForegroundColor(IndexedColors.GREEN.getIndex());
            totalHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Row 0: Quality group headers
            Row qualityRow = sheet.createRow(0);
            String[] fixedHeaders = {"Name", "Roll Number", "Control Number", "Class", "DOB"};
            int colIndex = 0;

            for (String header : fixedHeaders) {
                Cell cell = qualityRow.createCell(colIndex++);
                cell.setCellValue(header);
                cell.setCellStyle(headerStyle);
            }

            // Write quality group names in row 0
            String prevQuality = "";
            for (int i = 0; i < columnHeaders.size(); i++) {
                String quality = columnQualityGroup.get(i);
                Cell cell = qualityRow.createCell(colIndex + i);
                if (!quality.equals(prevQuality)) {
                    cell.setCellValue(quality);
                    cell.setCellStyle(qualityHeaderStyle);
                    prevQuality = quality;
                } else {
                    cell.setCellStyle(qualityHeaderStyle);
                }
            }

            // Row 1: Individual type headers
            Row headerRow = sheet.createRow(1);
            colIndex = 0;
            for (String header : fixedHeaders) {
                Cell cell = headerRow.createCell(colIndex++);
                cell.setCellValue(header);
                cell.setCellStyle(headerStyle);
            }

            for (int i = 0; i < columnHeaders.size(); i++) {
                Cell cell = headerRow.createCell(colIndex + i);
                cell.setCellValue(columnHeaders.get(i));
                cell.setCellStyle(isCumulativeCol.get(i) ? totalHeaderStyle : headerStyle);
            }

            // Create data rows (only completed students)
            int rowIndex = 2;
            for (UserStudent us : userStudents) {
                StudentAssessmentMapping mapping = mappingByUserStudentId.get(us.getUserStudentId());
                if (mapping == null) continue; // skip students without completed mapping

                StudentInfo si = us.getStudentInfo();

                Row row = sheet.createRow(rowIndex++);
                colIndex = 0;

                // Fixed columns
                row.createCell(colIndex++).setCellValue(si != null && si.getName() != null ? si.getName() : "");
                row.createCell(colIndex++).setCellValue(si != null && si.getSchoolRollNumber() != null ? si.getSchoolRollNumber() : "");
                row.createCell(colIndex++).setCellValue(si != null && si.getControlNumber() != null ? si.getControlNumber().toString() : "");
                row.createCell(colIndex++).setCellValue(si != null && si.getStudentClass() != null ? si.getStudentClass().toString() : "");

                // Format DOB as string
                String dobStr = "";
                if (si != null && si.getStudentDob() != null) {
                    SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
                    dobStr = sdf.format(si.getStudentDob());
                }
                row.createCell(colIndex++).setCellValue(dobStr);

                // Score columns
                Map<String, Integer> studentScores = mapping != null
                        ? scoresByMappingId.getOrDefault(mapping.getStudentAssessmentId(), new HashMap<>())
                        : new HashMap<>();

                for (int i = 0; i < columnHeaders.size(); i++) {
                    Cell cell = row.createCell(colIndex + i);
                    if (isCumulativeCol.get(i)) {
                        // Cumulative: sum all types for this quality
                        String qualityName = columnQualityGroup.get(i);
                        int cumulative = 0;
                        boolean hasScore = false;
                        for (String typeName : qualityToTypesOrdered.get(qualityName)) {
                            Integer score = studentScores.get(typeName);
                            if (score != null) {
                                cumulative += score;
                                hasScore = true;
                            }
                        }
                        if (hasScore) {
                            cell.setCellValue(cumulative);
                        } else {
                            cell.setCellValue("");
                        }
                    } else {
                        // Individual type score
                        Integer score = studentScores.get(columnHeaders.get(i));
                        if (score != null) {
                            cell.setCellValue(score);
                        } else {
                            cell.setCellValue("");
                        }
                    }
                }
            }

            // Auto-size columns
            int totalCols = fixedHeaders.length + columnHeaders.size();
            for (int i = 0; i < totalCols; i++) {
                sheet.autoSizeColumn(i);
            }

            // Write to byte array
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            workbook.close();

            byte[] excelBytes = outputStream.toByteArray();

            // Return as downloadable file
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "student_scores_" + instituteId + "_" + assessmentId + ".xlsx");
            headers.setContentLength(excelBytes.length);

            return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            System.err.println("Error exporting scores: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to export scores: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/bet-report/{instituteId}/{assessmentId}")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getBetReport(
            @PathVariable("instituteId") Integer instituteId,
            @PathVariable("assessmentId") Long assessmentId) {
        try {
            // 1. Validate assessment exists and is BET type
            Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(assessmentId);
            if (assessmentOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Assessment not found"));
            }
            AssessmentTable assessment = assessmentOpt.get();
            if (assessment.getQuestionnaire() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Assessment has no linked questionnaire"));
            }
            Boolean qType = assessment.getQuestionnaire().getType();
            if (qType == null || !qType) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Assessment is not a BET type"));
            }

            Long questionnaireId = assessment.getQuestionnaire().getQuestionnaireId();

            // 2. Get question structure sorted by section order then question order
            List<QuestionnaireQuestion> qqList = questionnaireQuestionRepository
                    .findByQuestionnaireIdWithOptions(questionnaireId);

            // Sort by section orderIndex, then by questionnaireQuestionId within section
            qqList.sort((a, b) -> {
                String orderA = a.getSection() != null ? a.getSection().getOrder() : "";
                String orderB = b.getSection() != null ? b.getSection().getOrder() : "";
                int cmp = (orderA != null ? orderA : "").compareTo(orderB != null ? orderB : "");
                if (cmp != 0) return cmp;
                return Long.compare(a.getQuestionnaireQuestionId(), b.getQuestionnaireQuestionId());
            });

            // 3. Build dynamic columns
            List<Map<String, Object>> columns = new ArrayList<>();
            for (QuestionnaireQuestion qq : qqList) {
                String header = qq.getExcelQuestionHeader();
                if (header == null || header.isEmpty()) {
                    header = "Q_" + qq.getQuestionnaireQuestionId();
                }
                boolean isMQT = qq.getQuestion() != null
                        && qq.getQuestion().getIsMQT() != null
                        && qq.getQuestion().getIsMQT();

                Map<String, Object> col = new LinkedHashMap<>();
                col.put("key", header);
                col.put("header", header);
                col.put("questionId", qq.getQuestionnaireQuestionId());
                col.put("isMQT", isMQT);
                columns.add(col);
            }

            // 4. Get completed students for this institute and assessment
            List<UserStudent> userStudents = userStudentRepository.findByInstituteInstituteCode(instituteId);
            String instituteName = "";
            var instituteList = instituteDetailRepository.findByInstituteCode(instituteId);
            if (!instituteList.isEmpty()) {
                instituteName = instituteList.get(0).getInstituteName();
            }

            List<Map<String, Object>> rows = new ArrayList<>();

            for (UserStudent us : userStudents) {
                Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(
                                us.getUserStudentId(), assessmentId);
                if (mappingOpt.isEmpty() || !"completed".equals(mappingOpt.get().getStatus())) {
                    continue;
                }

                // 5. Get this student's answers
                var answers = assessmentAnswerRepository
                        .findByUserStudentIdAndAssessmentIdWithDetails(
                                us.getUserStudentId(), assessmentId);

                // Index answers by questionnaireQuestionId (multiple answers possible for isMQT)
                Map<Long, List<AssessmentAnswer>> answersByQuestionId = new HashMap<>();
                for (var aa : answers) {
                    if (aa.getQuestionnaireQuestion() != null) {
                        answersByQuestionId
                                .computeIfAbsent(aa.getQuestionnaireQuestion().getQuestionnaireQuestionId(),
                                        k -> new ArrayList<>())
                                .add(aa);
                    }
                }

                // 6. Build row
                Map<String, Object> row = new LinkedHashMap<>();
                StudentInfo si = us.getStudentInfo();
                row.put("name", si != null && si.getName() != null ? si.getName() : "");
                row.put("institute", instituteName);

                for (Map<String, Object> col : columns) {
                    String key = (String) col.get("key");
                    Long questionId = ((Number) col.get("questionId")).longValue();
                    boolean colIsMQT = (Boolean) col.get("isMQT");

                    List<AssessmentAnswer> questionAnswers = answersByQuestionId.get(questionId);

                    if (!colIsMQT) {
                        // Non-MQT: show MQT score of the single selected option
                        Object value = "";
                        if (questionAnswers != null && !questionAnswers.isEmpty()) {
                            AssessmentAnswer aa = questionAnswers.get(0);
                            if (aa.getOption() != null && aa.getOption().getOptionScores() != null) {
                                int totalScore = 0;
                                for (OptionScoreBasedOnMEasuredQualityTypes os : aa.getOption().getOptionScores()) {
                                    if (os.getScore() != null) {
                                        totalScore += os.getScore();
                                    }
                                }
                                value = totalScore;
                            }
                        }
                        row.put(key, value);
                    } else {
                        // MQT: cumulative score of all selected options
                        int cumulativeScore = 0;
                        boolean hasAnswers = false;
                        if (questionAnswers != null) {
                            for (AssessmentAnswer aa : questionAnswers) {
                                if (aa.getOption() != null && aa.getOption().getOptionScores() != null) {
                                    hasAnswers = true;
                                    for (OptionScoreBasedOnMEasuredQualityTypes os : aa.getOption().getOptionScores()) {
                                        if (os.getScore() != null) {
                                            cumulativeScore += os.getScore();
                                        }
                                    }
                                }
                            }
                        }
                        row.put(key, hasAnswers ? cumulativeScore : "");
                    }
                }

                rows.add(row);
            }

            // 7. Build response
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("columns", columns);
            response.put("rows", rows);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("Error generating BET report: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate BET report: " + e.getMessage()));
        }
    }

    @PostMapping("/bulkRemoveAssessment")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> bulkRemoveAssessment(@RequestBody List<Map<String, Long>> removals) {
        try {
            int removedCount = 0;
            for (Map<String, Long> removal : removals) {
                Long userStudentId = removal.get("userStudentId");
                Long assessmentId = removal.get("assessmentId");

                if (userStudentId != null && assessmentId != null) {
                    studentAssessmentMappingRepository.deleteByUserStudentUserStudentIdAndAssessmentId(
                            userStudentId, assessmentId);
                    removedCount++;
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("removedCount", removedCount);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error removing assessments: " + e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to remove assessments: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

}
