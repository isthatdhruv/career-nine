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
import org.apache.poi.ss.usermodel.Font;
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

                    // Question text
                    String questionText = "";
                    if (aa.getQuestionnaireQuestion() != null && aa.getQuestionnaireQuestion().getQuestion() != null) {
                        questionText = aa.getQuestionnaireQuestion().getQuestion().getQuestionText();
                    }
                    row.put("questionText", questionText);

                    // Option ID and text
                    row.put("optionId", aa.getOption() != null ? aa.getOption().getOptionId() : null);
                    row.put("optionText", aa.getOption() != null ? aa.getOption().getOptionText() : "");

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
                if (mappingOpt.isPresent()) {
                    StudentAssessmentMapping mapping = mappingOpt.get();
                    mappingIds.add(mapping.getStudentAssessmentId());
                    mappingByUserStudentId.put(us.getUserStudentId(), mapping);
                }
            }

            // Get all raw scores for these mappings in one query
            List<AssessmentRawScore> allScores = mappingIds.isEmpty()
                    ? new ArrayList<>()
                    : assessmentRawScoreRepository.findByStudentAssessmentMappingStudentAssessmentIdIn(mappingIds);

            // Collect all unique MQT names (in order)
            Set<String> mqtNamesSet = new LinkedHashSet<>();
            Map<Long, Map<String, Integer>> scoresByMappingId = new HashMap<>();

            for (AssessmentRawScore score : allScores) {
                Long mappingId = score.getStudentAssessmentMapping().getStudentAssessmentId();
                String mqtName = score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName() != null
                        ? score.getMeasuredQualityType().getMeasuredQualityTypeDisplayName()
                        : score.getMeasuredQualityType().getMeasuredQualityTypeName();

                mqtNamesSet.add(mqtName);

                scoresByMappingId.computeIfAbsent(mappingId, k -> new HashMap<>())
                        .put(mqtName, score.getRawScore());
            }

            List<String> mqtNames = new ArrayList<>(mqtNamesSet);

            // Create Excel workbook
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("Student Scores");

            // Create header style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            // Create header row
            Row headerRow = sheet.createRow(0);
            String[] fixedHeaders = {"Name", "Roll Number", "Control Number", "Class", "DOB"};
            int colIndex = 0;

            for (String header : fixedHeaders) {
                Cell cell = headerRow.createCell(colIndex++);
                cell.setCellValue(header);
                cell.setCellStyle(headerStyle);
            }

            for (String mqtName : mqtNames) {
                Cell cell = headerRow.createCell(colIndex++);
                cell.setCellValue(mqtName);
                cell.setCellStyle(headerStyle);
            }

            // Create data rows
            int rowIndex = 1;
            for (UserStudent us : userStudents) {
                StudentInfo si = us.getStudentInfo();
                StudentAssessmentMapping mapping = mappingByUserStudentId.get(us.getUserStudentId());

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

                // MQT score columns
                Map<String, Integer> studentScores = mapping != null
                        ? scoresByMappingId.getOrDefault(mapping.getStudentAssessmentId(), new HashMap<>())
                        : new HashMap<>();

                for (String mqtName : mqtNames) {
                    Integer score = studentScores.get(mqtName);
                    if (score != null) {
                        row.createCell(colIndex++).setCellValue(score);
                    } else {
                        row.createCell(colIndex++).setCellValue("");
                    }
                }
            }

            // Auto-size columns
            for (int i = 0; i < fixedHeaders.length + mqtNames.size(); i++) {
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
