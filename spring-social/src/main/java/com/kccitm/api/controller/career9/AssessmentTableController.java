package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireRepository;

@RestController
@RequestMapping("/assessments")
public class AssessmentTableController {

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private QuestionnaireRepository questionnaireRepository;

    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;

    @GetMapping("/getAll")
    // @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<AssessmentTable>> getAllAssessments() {
        List<AssessmentTable> assessments = assessmentTableRepository.findAll();
        return ResponseEntity.ok(assessments);
    }

    @GetMapping("/get/list")
    public List<AssessmentTable> getAllAssessment() {
        // return assessmentTableRepository.findAssessmentList();
        return assessmentTableRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<HashMap<String, Object>> getAssessmentById(@PathVariable Long id) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findById(id);
        HashMap<String, Object> response = new HashMap<>();
        if (assessment.isPresent()) {
            response.put("isActive", assessment.get().getIsActive());
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{assessmentId}/student/{userStudentId}")
    public ResponseEntity<HashMap<String, Object>> getAssessmentStatusForStudent(
            @PathVariable Long assessmentId, @PathVariable Long userStudentId) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findById(assessmentId);
        Optional<StudentAssessmentMapping> studentAssessmentMapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        HashMap<String, Object> response = new HashMap<>();

        if (assessment.isPresent()) {
            response.put("isActive", assessment.get().getIsActive());
        } else {
            response.put("isActive", false);
        }

        if (studentAssessmentMapping.isPresent()) {
            response.put("studentStatus", studentAssessmentMapping.get().getStatus());
        } else {
            response.put("studentStatus", null);
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/student/{userStudentId}")
    public ResponseEntity<List<HashMap<String, Object>>> getAssessmentsForStudent(
            @PathVariable Long userStudentId) {
        // Get all assessment mappings for this student
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findByUserStudentUserStudentId(userStudentId);

        java.util.ArrayList<HashMap<String, Object>> result = new java.util.ArrayList<>();

        for (StudentAssessmentMapping mapping : mappings) {
            HashMap<String, Object> assessmentInfo = new HashMap<>();
            assessmentInfo.put("assessmentId", mapping.getAssessmentId());
            assessmentInfo.put("status", mapping.getStatus());

            // Get assessment name
            Optional<AssessmentTable> assessment = assessmentTableRepository.findById(mapping.getAssessmentId());
            if (assessment.isPresent()) {
                assessmentInfo.put("assessmentName", assessment.get().getAssessmentName());
                // Add questionnaire type (true = bet-assessment, false/null = general)
                if (assessment.get().getQuestionnaire() != null) {
                    assessmentInfo.put("questionnaireType", assessment.get().getQuestionnaire().getType());
                } else {
                    assessmentInfo.put("questionnaireType", null);
                }
            } else {
                assessmentInfo.put("assessmentName", "Unknown Assessment");
                assessmentInfo.put("questionnaireType", null);
            }

            result.add(assessmentInfo);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/getby/{id}")
    public List<Questionnaire> getQuestionnaireById(@PathVariable Long id) {

        Long questionnaireId = assessmentTableRepository.findById(id).get().getQuestionnaire().getQuestionnaireId();

        return questionnaireRepository.findAllByQuestionnaireId(questionnaireId);
    }

    @GetMapping("/getById/{id}")
    public ResponseEntity<AssessmentTable> getAssessmentDetailsById(@PathVariable Long id) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findById(id);
        return assessment.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/create")
    public ResponseEntity<AssessmentTable> createAssessment(@RequestBody java.util.Map<String, Object> requestBody) {
        AssessmentTable assessment = new AssessmentTable();

        // Set basic fields from request body
        if (requestBody.get("AssessmentName") != null) {
            assessment.setAssessmentName((String) requestBody.get("AssessmentName"));
        }
        if (requestBody.get("starDate") != null) {
            assessment.setStarDate((String) requestBody.get("starDate"));
        }
        if (requestBody.get("endDate") != null) {
            assessment.setEndDate((String) requestBody.get("endDate"));
        }
        if (requestBody.get("isActive") != null) {
            assessment.setIsActive((Boolean) requestBody.get("isActive"));
        }
        if (requestBody.get("modeofAssessment") != null) {
            assessment.setModeofAssessment((Boolean) requestBody.get("modeofAssessment"));
        }

        // Timer visibility flag
        if (requestBody.get("showTimer") != null) {
            assessment.setShowTimer((Boolean) requestBody.get("showTimer"));
        }

        // Handle questionnaire - fetch existing entity by ID
        if (requestBody.get("questionnaire") != null) {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> questionnaireData = (java.util.Map<String, Object>) requestBody
                    .get("questionnaire");
            Long questionnaireId = null;

            // Check for questionnaireId field
            if (questionnaireData.get("questionnaireId") != null) {
                questionnaireId = ((Number) questionnaireData.get("questionnaireId")).longValue();
            } else if (questionnaireData.get("id") != null) {
                questionnaireId = ((Number) questionnaireData.get("id")).longValue();
            }

            if (questionnaireId != null) {
                Optional<Questionnaire> existingQuestionnaire = questionnaireRepository.findById(questionnaireId);
                if (existingQuestionnaire.isPresent()) {
                    assessment.setQuestionnaire(existingQuestionnaire.get());
                } else {
                    return ResponseEntity.badRequest().build();
                }
            }
        }

        AssessmentTable savedAssessment = assessmentTableRepository.save(assessment);
        return ResponseEntity.ok(savedAssessment);
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<AssessmentTable> updateAssessment(@PathVariable Long id,
            @RequestBody AssessmentTable assessment) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessment.setId(id);
        assessment.setAssessmentName(assessment.getAssessmentName());
        AssessmentTable updatedAssessment = assessmentTableRepository.save(assessment);
        return ResponseEntity.ok(updatedAssessment);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssessment(@PathVariable Long id) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessmentTableRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/get/list-summary")
    public List<AssessmentTableRepository.AssessmentSummary> getAssessmentSummaryList() {
        return assessmentTableRepository.findAssessmentSummaryList();
    }

    @GetMapping("/get/list-ids")
    public HashMap<Long, String> getAllAssessmentIds() {
        HashMap<Long, String> assessmentIdandName = new HashMap<>();
        assessmentTableRepository.findAll()
                .forEach(assessment -> assessmentIdandName.put(assessment.getId(), assessment.getAssessmentName()));
        return assessmentIdandName;
    }

    // Lock an assessment
    @PutMapping("/{id}/lock")
    public ResponseEntity<AssessmentTable> lockAssessment(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentTable assessment = assessmentOpt.get();
        assessment.setIsLocked(true);
        return ResponseEntity.ok(assessmentTableRepository.save(assessment));
    }

    // Unlock an assessment
    @PutMapping("/{id}/unlock")
    public ResponseEntity<AssessmentTable> unlockAssessment(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentTable assessment = assessmentOpt.get();
        assessment.setIsLocked(false);
        return ResponseEntity.ok(assessmentTableRepository.save(assessment));
    }

    // Check if an assessment is locked by questionnaire ID
    @GetMapping("/is-locked-by-questionnaire/{questionnaireId}")
    public ResponseEntity<HashMap<String, Object>> isLockedByQuestionnaire(
            @PathVariable Long questionnaireId) {
        HashMap<String, Object> response = new HashMap<>();
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository
                .findByQuestionnaireQuestionnaireId(questionnaireId);
        if (assessmentOpt.isPresent()) {
            response.put("isLocked", Boolean.TRUE.equals(assessmentOpt.get().getIsLocked()));
            response.put("assessmentId", assessmentOpt.get().getId());
            response.put("assessmentName", assessmentOpt.get().getAssessmentName());
        } else {
            response.put("isLocked", false);
        }
        return ResponseEntity.ok(response);
    }

    // Check if an assessment is locked by question ID (traverses question -> section -> questionnaire -> assessment)
    @GetMapping("/is-locked-by-question/{questionId}")
    public ResponseEntity<HashMap<String, Object>> isLockedByQuestion(
            @PathVariable Long questionId) {
        HashMap<String, Object> response = new HashMap<>();
        Optional<AssessmentQuestions> questionOpt = assessmentQuestionRepository.findById(questionId);
        if (questionOpt.isEmpty() || questionOpt.get().getSection() == null) {
            response.put("isLocked", false);
            return ResponseEntity.ok(response);
        }
        Long sectionId = questionOpt.get().getSection().getSectionId();
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findByQuestionSectionId(sectionId);
        if (assessmentOpt.isPresent()) {
            response.put("isLocked", Boolean.TRUE.equals(assessmentOpt.get().getIsLocked()));
            response.put("assessmentId", assessmentOpt.get().getId());
            response.put("assessmentName", assessmentOpt.get().getAssessmentName());
        } else {
            response.put("isLocked", false);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/startAssessment")
    public ResponseEntity<HashMap<String, Object>> startAssessment(
            @RequestBody java.util.Map<String, Long> request) {
        Long userStudentId = request.get("userStudentId");
        Long assessmentId = request.get("assessmentId");

        HashMap<String, Object> response = new HashMap<>();

        if (userStudentId == null || assessmentId == null) {
            response.put("success", false);
            response.put("error", "userStudentId and assessmentId are required");
            return ResponseEntity.badRequest().body(response);
        }

        Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        if (mappingOpt.isEmpty()) {
            response.put("success", false);
            response.put("error", "No assessment mapping found");
            return ResponseEntity.status(404).body(response);
        }

        StudentAssessmentMapping mapping = mappingOpt.get();

        // Only update if not completed
        if (!"completed".equals(mapping.getStatus())) {
            mapping.setStatus("ongoing");
            studentAssessmentMappingRepository.save(mapping);
        }

        response.put("success", true);
        response.put("status", mapping.getStatus());
        return ResponseEntity.ok(response);
    }

}
