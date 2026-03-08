package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentDemographicMapping;
import com.kccitm.api.model.career9.DemographicFieldDefinition;
import com.kccitm.api.model.career9.DemographicFieldOption;
import com.kccitm.api.model.career9.StudentDemographicResponse;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentDemographicMappingRepository;
import com.kccitm.api.repository.Career9.StudentDemographicResponseRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;

@RestController
@RequestMapping("/student-demographics")
public class StudentDemographicResponseController {

    @Autowired
    private AssessmentDemographicMappingRepository mappingRepository;

    @Autowired
    private StudentDemographicResponseRepository responseRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @GetMapping("/fields/{assessmentId}/{userStudentId}")
    public ResponseEntity<?> getFieldsForAssessment(
            @PathVariable Long assessmentId,
            @PathVariable Long userStudentId) {
        try {
            // Get configured demographic fields for this assessment
            List<AssessmentDemographicMapping> mappings =
                    mappingRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessmentId);

            if (mappings.isEmpty()) {
                return ResponseEntity.ok(new ArrayList<>());
            }

            // Get the student's info for pre-filling SYSTEM fields
            UserStudent userStudent = userStudentRepository.findById(userStudentId).orElse(null);
            StudentInfo studentInfo = (userStudent != null) ? userStudent.getStudentInfo() : null;

            // Get existing custom responses for pre-filling CUSTOM fields (across all assessments)
            List<StudentDemographicResponse> existingResponses =
                    responseRepository.findByUserStudentId(userStudentId);
            Map<Long, String> responseMap = new HashMap<>();
            for (StudentDemographicResponse resp : existingResponses) {
                responseMap.put(resp.getFieldDefinition().getFieldId(), resp.getResponseValue());
            }

            // Build response array
            List<Map<String, Object>> result = new ArrayList<>();
            for (AssessmentDemographicMapping mapping : mappings) {
                DemographicFieldDefinition field = mapping.getFieldDefinition();
                Map<String, Object> fieldData = new LinkedHashMap<>();

                fieldData.put("mappingId", mapping.getMappingId());
                fieldData.put("fieldId", field.getFieldId());
                fieldData.put("fieldName", field.getFieldName());
                fieldData.put("displayLabel", field.getDisplayLabel());
                fieldData.put("customLabel", mapping.getCustomLabel());
                fieldData.put("fieldSource", field.getFieldSource());
                fieldData.put("dataType", field.getDataType());
                fieldData.put("validationRegex", field.getValidationRegex());
                fieldData.put("validationMessage", field.getValidationMessage());
                fieldData.put("minValue", field.getMinValue());
                fieldData.put("maxValue", field.getMaxValue());
                fieldData.put("placeholder", field.getPlaceholder());
                fieldData.put("defaultValue", field.getDefaultValue());
                fieldData.put("isMandatory", mapping.getIsMandatory());
                fieldData.put("displayOrder", mapping.getDisplayOrder());

                // Pre-fill current value
                String currentValue = null;
                if ("SYSTEM".equals(field.getFieldSource()) && studentInfo != null) {
                    currentValue = getSystemFieldValue(studentInfo, field.getSystemFieldKey());
                } else if ("CUSTOM".equals(field.getFieldSource())) {
                    currentValue = responseMap.get(field.getFieldId());
                }
                fieldData.put("currentValue", currentValue);

                // Include options for SELECT type fields
                List<Map<String, Object>> optionsList = new ArrayList<>();
                if (field.getOptions() != null) {
                    for (DemographicFieldOption option : field.getOptions()) {
                        Map<String, Object> optionData = new LinkedHashMap<>();
                        optionData.put("optionId", option.getOptionId());
                        optionData.put("optionValue", option.getOptionValue());
                        optionData.put("optionLabel", option.getOptionLabel());
                        optionsList.add(optionData);
                    }
                }
                fieldData.put("options", optionsList);

                result.add(fieldData);
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("Error fetching demographic fields: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to fetch demographic fields: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/submit")
    @Transactional
    public ResponseEntity<?> submit(@RequestBody Map<String, Object> request) {
        try {
            Long userStudentId = Long.valueOf(request.get("userStudentId").toString());
            Long assessmentId = Long.valueOf(request.get("assessmentId").toString());

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> responses = (List<Map<String, Object>>) request.get("responses");

            // Verify student exists
            UserStudent userStudent = userStudentRepository.findById(userStudentId).orElse(null);
            if (userStudent == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Student not found with userStudentId: " + userStudentId));
            }

            StudentInfo studentInfo = userStudent.getStudentInfo();

            // Get all mappings for validation
            List<AssessmentDemographicMapping> mappings =
                    mappingRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessmentId);

            // Build a lookup for submitted responses
            Map<Long, String> submittedValues = new HashMap<>();
            if (responses != null) {
                for (Map<String, Object> resp : responses) {
                    Long fieldId = Long.valueOf(resp.get("fieldId").toString());
                    String value = resp.get("value") != null ? resp.get("value").toString() : "";
                    submittedValues.put(fieldId, value);
                }
            }

            // Validate mandatory fields and regex
            List<String> validationErrors = new ArrayList<>();
            for (AssessmentDemographicMapping mapping : mappings) {
                DemographicFieldDefinition field = mapping.getFieldDefinition();
                String value = submittedValues.get(field.getFieldId());

                // Check mandatory
                if (Boolean.TRUE.equals(mapping.getIsMandatory())) {
                    if (value == null || value.trim().isEmpty()) {
                        String label = mapping.getCustomLabel() != null
                                ? mapping.getCustomLabel() : field.getDisplayLabel();
                        validationErrors.add(label + " is required");
                        continue;
                    }
                }

                // Check regex validation for non-empty TEXT fields
                if (value != null && !value.trim().isEmpty()
                        && "TEXT".equals(field.getDataType())
                        && field.getValidationRegex() != null
                        && !field.getValidationRegex().isEmpty()) {
                    if (!Pattern.matches(field.getValidationRegex(), value)) {
                        String message = field.getValidationMessage() != null
                                ? field.getValidationMessage()
                                : "Invalid value for " + field.getDisplayLabel();
                        validationErrors.add(message);
                    }
                }
            }

            if (!validationErrors.isEmpty()) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "Validation failed");
                errorResponse.put("validationErrors", validationErrors);
                return ResponseEntity.badRequest().body(errorResponse);
            }

            // Process responses
            for (AssessmentDemographicMapping mapping : mappings) {
                DemographicFieldDefinition field = mapping.getFieldDefinition();
                String value = submittedValues.get(field.getFieldId());

                if (value == null) continue;

                if ("SYSTEM".equals(field.getFieldSource()) && studentInfo != null) {
                    // Update StudentInfo field directly
                    updateSystemField(studentInfo, field.getSystemFieldKey(), value);
                } else if ("CUSTOM".equals(field.getFieldSource())) {
                    // Upsert by (userStudentId, fieldId) - shared across assessments
                    List<StudentDemographicResponse> existingList =
                            responseRepository.findByUserStudentIdAndFieldDefinitionFieldId(
                                    userStudentId, field.getFieldId());

                    StudentDemographicResponse response;
                    if (!existingList.isEmpty()) {
                        // Keep the first entry, delete any duplicates from old data
                        response = existingList.get(0);
                        response.setResponseValue(value);
                        response.setSubmittedAt(new Date());
                        for (int i = 1; i < existingList.size(); i++) {
                            responseRepository.delete(existingList.get(i));
                        }
                    } else {
                        response = new StudentDemographicResponse();
                        response.setUserStudentId(userStudentId);
                        response.setAssessmentId(assessmentId);
                        response.setFieldDefinition(field);
                        response.setResponseValue(value);
                    }
                    responseRepository.save(response);
                }
            }

            // Save StudentInfo if any SYSTEM fields were updated
            if (studentInfo != null) {
                studentInfoRepository.save(studentInfo);
            }

            Map<String, Object> successResponse = new HashMap<>();
            successResponse.put("success", true);
            successResponse.put("message", "Demographics submitted successfully");
            return ResponseEntity.ok(successResponse);

        } catch (Exception e) {
            System.err.println("Error submitting demographics: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to submit demographics: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/status/{assessmentId}/{userStudentId}")
    public ResponseEntity<?> getStatus(
            @PathVariable Long assessmentId,
            @PathVariable Long userStudentId) {
        try {
            List<AssessmentDemographicMapping> mappings =
                    mappingRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessmentId);

            int totalFields = mappings.size();

            if (totalFields == 0) {
                Map<String, Object> result = new HashMap<>();
                result.put("completed", true);
                result.put("totalFields", 0);
                result.put("completedFields", 0);
                result.put("missingMandatoryFields", new ArrayList<>());
                return ResponseEntity.ok(result);
            }

            // Get student info for SYSTEM fields
            UserStudent userStudent = userStudentRepository.findById(userStudentId).orElse(null);
            StudentInfo studentInfo = (userStudent != null) ? userStudent.getStudentInfo() : null;

            // Get existing custom responses (across all assessments - data is shared per field)
            List<StudentDemographicResponse> existingResponses =
                    responseRepository.findByUserStudentId(userStudentId);
            Map<Long, String> responseMap = new HashMap<>();
            for (StudentDemographicResponse resp : existingResponses) {
                responseMap.put(resp.getFieldDefinition().getFieldId(), resp.getResponseValue());
            }

            int completedFields = 0;
            List<String> missingMandatoryFields = new ArrayList<>();

            for (AssessmentDemographicMapping mapping : mappings) {
                DemographicFieldDefinition field = mapping.getFieldDefinition();
                String value = null;

                if ("SYSTEM".equals(field.getFieldSource()) && studentInfo != null) {
                    value = getSystemFieldValue(studentInfo, field.getSystemFieldKey());
                } else if ("CUSTOM".equals(field.getFieldSource())) {
                    value = responseMap.get(field.getFieldId());
                }

                boolean hasValue = value != null && !value.trim().isEmpty();
                if (hasValue) {
                    completedFields++;
                } else if (Boolean.TRUE.equals(mapping.getIsMandatory())) {
                    String label = mapping.getCustomLabel() != null
                            ? mapping.getCustomLabel() : field.getDisplayLabel();
                    missingMandatoryFields.add(label);
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("completed", missingMandatoryFields.isEmpty());
            result.put("totalFields", totalFields);
            result.put("completedFields", completedFields);
            result.put("missingMandatoryFields", missingMandatoryFields);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            System.err.println("Error checking demographic status: " + e.getMessage());
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to check demographic status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/bulk-fields")
    public ResponseEntity<?> getBulkDemographicData(@RequestBody List<Map<String, Object>> pairs) {
        try {
            List<Map<String, Object>> result = new ArrayList<>();

            for (Map<String, Object> pair : pairs) {
                Long userStudentId = Long.valueOf(pair.get("userStudentId").toString());
                Long assessmentId = Long.valueOf(pair.get("assessmentId").toString());

                List<AssessmentDemographicMapping> mappings =
                        mappingRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessmentId);

                if (mappings.isEmpty()) continue;

                UserStudent userStudent = userStudentRepository.findById(userStudentId).orElse(null);
                StudentInfo studentInfo = (userStudent != null) ? userStudent.getStudentInfo() : null;

                // Fetch responses across all assessments (data is shared per field)
                List<StudentDemographicResponse> existingResponses =
                        responseRepository.findByUserStudentId(userStudentId);
                Map<Long, String> responseMap = new HashMap<>();
                for (StudentDemographicResponse resp : existingResponses) {
                    responseMap.put(resp.getFieldDefinition().getFieldId(), resp.getResponseValue());
                }

                for (AssessmentDemographicMapping mapping : mappings) {
                    DemographicFieldDefinition field = mapping.getFieldDefinition();
                    String currentValue = null;
                    if ("SYSTEM".equals(field.getFieldSource()) && studentInfo != null) {
                        currentValue = getSystemFieldValue(studentInfo, field.getSystemFieldKey());
                    } else if ("CUSTOM".equals(field.getFieldSource())) {
                        currentValue = responseMap.get(field.getFieldId());
                    }

                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("userStudentId", userStudentId);
                    row.put("assessmentId", assessmentId);
                    row.put("fieldName", field.getFieldName());
                    row.put("displayLabel", mapping.getCustomLabel() != null ? mapping.getCustomLabel() : field.getDisplayLabel());
                    row.put("value", currentValue);
                    result.add(row);
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("Error fetching bulk demographic data: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch bulk demographic data: " + e.getMessage()));
        }
    }

    private String getSystemFieldValue(StudentInfo studentInfo, String systemFieldKey) {
        if (systemFieldKey == null) return null;
        switch (systemFieldKey) {
            case "name":
                return studentInfo.getName();
            case "gender":
                return studentInfo.getGender();
            case "schoolBoard":
                return studentInfo.getSchoolBoard();
            case "studentClass":
                return studentInfo.getStudentClass() != null
                        ? String.valueOf(studentInfo.getStudentClass()) : null;
            case "sibling":
                return studentInfo.getSibling() != null
                        ? String.valueOf(studentInfo.getSibling()) : null;
            case "family":
                return studentInfo.getFamily();
            case "phoneNumber":
                return studentInfo.getPhoneNumber();
            case "email":
                return studentInfo.getEmail();
            case "address":
                return studentInfo.getAddress();
            case "schoolRollNumber":
                return studentInfo.getSchoolRollNumber();
            default:
                return null;
        }
    }

    private void updateSystemField(StudentInfo studentInfo, String systemFieldKey, String value) {
        if (systemFieldKey == null || value == null) return;
        switch (systemFieldKey) {
            case "name":
                studentInfo.setName(value);
                break;
            case "gender":
                studentInfo.setGender(value);
                break;
            case "schoolBoard":
                studentInfo.setSchoolBoard(value);
                break;
            case "studentClass":
                if (!value.isEmpty()) {
                    studentInfo.setStudentClass(Integer.parseInt(value));
                }
                break;
            case "sibling":
                if (!value.isEmpty()) {
                    studentInfo.setSibling(Integer.parseInt(value));
                }
                break;
            case "family":
                studentInfo.setFamily(value);
                break;
            case "phoneNumber":
                studentInfo.setPhoneNumber(value);
                break;
            case "email":
                studentInfo.setEmail(value);
                break;
            case "address":
                studentInfo.setAddress(value);
                break;
            case "schoolRollNumber":
                studentInfo.setSchoolRollNumber(value);
                break;
            default:
                break;
        }
    }
}
