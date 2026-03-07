package com.kccitm.api.controller.career9;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
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

    private static final Logger logger = LoggerFactory.getLogger(AssessmentTableController.class);

    /** Directory where locked assessment JSON snapshots are stored */
    private static final String LOCKED_CACHE_DIR = "assessment-cache";

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private QuestionnaireRepository questionnaireRepository;

    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // ─── Locked assessment JSON snapshot helpers ───

    private Path getLockedCacheDir() {
        Path dir = Paths.get(LOCKED_CACHE_DIR);
        if (!Files.exists(dir)) {
            try {
                Files.createDirectories(dir);
            } catch (IOException e) {
                logger.error("Failed to create assessment cache directory: {}", dir, e);
            }
        }
        return dir;
    }

    private Path getSnapshotPath(Long assessmentId) {
        return getLockedCacheDir().resolve(assessmentId + ".json");
    }

    /**
     * Generate and write a JSON snapshot for a locked assessment.
     * Contains both the questionnaire data and the assessment config.
     */
    private void generateLockedSnapshot(AssessmentTable assessment) {
        try {
            HashMap<String, Object> bundle = new HashMap<>();
            bundle.put("assessmentId", assessment.getId());
            bundle.put("isLocked", true);
            bundle.put("config", assessment);

            if (assessment.getQuestionnaire() != null) {
                Long questionnaireId = assessment.getQuestionnaire().getQuestionnaireId();
                List<Questionnaire> questionnaireData = questionnaireRepository
                        .findAllByQuestionnaireId(questionnaireId);
                bundle.put("questionnaire", questionnaireData);
            } else {
                bundle.put("questionnaire", java.util.Collections.emptyList());
            }

            Path snapshotPath = getSnapshotPath(assessment.getId());
            objectMapper.writeValue(snapshotPath.toFile(), bundle);
            logger.info("Generated locked snapshot for assessment #{} at {}", assessment.getId(), snapshotPath);
        } catch (IOException e) {
            logger.error("Failed to write locked snapshot for assessment #{}", assessment.getId(), e);
        }
    }

    /**
     * Delete the JSON snapshot for an assessment (called on unlock).
     */
    private void deleteLockedSnapshot(Long assessmentId) {
        try {
            Path snapshotPath = getSnapshotPath(assessmentId);
            if (Files.deleteIfExists(snapshotPath)) {
                logger.info("Deleted locked snapshot for assessment #{}", assessmentId);
            }
        } catch (IOException e) {
            logger.error("Failed to delete locked snapshot for assessment #{}", assessmentId, e);
        }
    }

    /**
     * Read the cached snapshot and extract a specific key as raw JSON string.
     * Returns null if the snapshot doesn't exist or can't be read.
     */
    @SuppressWarnings("unchecked")
    private HashMap<String, Object> readLockedSnapshot(Long assessmentId) {
        Path snapshotPath = getSnapshotPath(assessmentId);
        if (!Files.exists(snapshotPath)) {
            return null;
        }
        try {
            return objectMapper.readValue(snapshotPath.toFile(), HashMap.class);
        } catch (IOException e) {
            logger.error("Failed to read locked snapshot for assessment #{}", assessmentId, e);
            return null;
        }
    }

    // ─── Endpoints ───

    @GetMapping("/getAll")
    public ResponseEntity<List<AssessmentTable>> getAllAssessments() {
        List<AssessmentTable> assessments = assessmentTableRepository.findAll();
        return ResponseEntity.ok(assessments);
    }

    @GetMapping("/get/list")
    public List<AssessmentTable> getAllAssessment() {
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
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findByUserStudentUserStudentId(userStudentId);

        if (mappings.isEmpty()) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }

        // Batch fetch all assessments in one query
        List<Long> assessmentIds = mappings.stream()
                .map(StudentAssessmentMapping::getAssessmentId)
                .collect(java.util.stream.Collectors.toList());
        java.util.Map<Long, AssessmentTable> assessmentMap = new HashMap<>();
        assessmentTableRepository.findAllByIdInWithQuestionnaire(assessmentIds)
                .forEach(a -> assessmentMap.put(a.getId(), a));

        java.util.ArrayList<HashMap<String, Object>> result = new java.util.ArrayList<>();

        for (StudentAssessmentMapping mapping : mappings) {
            HashMap<String, Object> assessmentInfo = new HashMap<>();
            assessmentInfo.put("assessmentId", mapping.getAssessmentId());
            assessmentInfo.put("status", mapping.getStatus());

            AssessmentTable assessment = assessmentMap.get(mapping.getAssessmentId());
            if (assessment != null) {
                assessmentInfo.put("assessmentName", assessment.getAssessmentName());
                if (assessment.getQuestionnaire() != null) {
                    assessmentInfo.put("questionnaireType", assessment.getQuestionnaire().getType());
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

    /**
     * Get questionnaire data for an assessment.
     * If the assessment is locked and a snapshot exists, serves from the cached JSON file
     * instead of querying the database. Cached in Caffeine for 10 minutes.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @Cacheable(value = "questionnaireQuestions", key = "#id")
    @GetMapping("/getby/{id}")
    public ResponseEntity<?> getQuestionnaireById(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AssessmentTable assessment = assessmentOpt.get();

        // If locked, try serving from cached snapshot
        if (Boolean.TRUE.equals(assessment.getIsLocked())) {
            HashMap<String, Object> snapshot = readLockedSnapshot(id);
            if (snapshot != null && snapshot.containsKey("questionnaire")) {
                logger.debug("Serving questionnaire for assessment #{} from locked snapshot", id);
                return ResponseEntity.ok(snapshot.get("questionnaire"));
            }
        }

        // Fall back to DB query
        if (assessment.getQuestionnaire() == null) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
        Long questionnaireId = assessment.getQuestionnaire().getQuestionnaireId();
        return ResponseEntity.ok(questionnaireRepository.findAllByQuestionnaireId(questionnaireId));
    }

    /**
     * Get assessment config/details by ID.
     * If the assessment is locked and a snapshot exists, serves from the cached JSON file
     * instead of querying the database.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @Cacheable(value = "assessmentDetails", key = "#id")
    @GetMapping("/getById/{id}")
    public ResponseEntity<?> getAssessmentDetailsById(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AssessmentTable assessment = assessmentOpt.get();

        // If locked, try serving from cached snapshot
        if (Boolean.TRUE.equals(assessment.getIsLocked())) {
            HashMap<String, Object> snapshot = readLockedSnapshot(id);
            if (snapshot != null && snapshot.containsKey("config")) {
                logger.debug("Serving config for assessment #{} from locked snapshot", id);
                return ResponseEntity.ok(snapshot.get("config"));
            }
        }

        // Fall back to DB query
        return ResponseEntity.ok(assessment);
    }

    @Caching(evict = { @CacheEvict(value = "assessmentDetails", allEntries = true), @CacheEvict(value = "questionnaireQuestions", allEntries = true) })
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

    @Caching(evict = { @CacheEvict(value = "assessmentDetails", allEntries = true), @CacheEvict(value = "questionnaireQuestions", allEntries = true) })
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

    @Caching(evict = { @CacheEvict(value = "assessmentDetails", allEntries = true), @CacheEvict(value = "questionnaireQuestions", allEntries = true) })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssessment(@PathVariable Long id) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessmentTableRepository.deleteById(id);
        deleteLockedSnapshot(id);
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

    // Lock an assessment — generates a JSON snapshot of the full assessment data
    @Caching(evict = { @CacheEvict(value = "assessmentDetails", allEntries = true), @CacheEvict(value = "questionnaireQuestions", allEntries = true) })
    @PutMapping("/{id}/lock")
    public ResponseEntity<AssessmentTable> lockAssessment(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentTable assessment = assessmentOpt.get();
        assessment.setIsLocked(true);
        AssessmentTable saved = assessmentTableRepository.save(assessment);

        // Generate the JSON snapshot with all questionnaire data
        generateLockedSnapshot(saved);

        return ResponseEntity.ok(saved);
    }

    // Unlock an assessment — deletes the JSON snapshot
    @Caching(evict = { @CacheEvict(value = "assessmentDetails", allEntries = true), @CacheEvict(value = "questionnaireQuestions", allEntries = true) })
    @PutMapping("/{id}/unlock")
    public ResponseEntity<AssessmentTable> unlockAssessment(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentTable assessment = assessmentOpt.get();
        assessment.setIsLocked(false);
        AssessmentTable saved = assessmentTableRepository.save(assessment);

        // Delete the cached snapshot
        deleteLockedSnapshot(id);

        return ResponseEntity.ok(saved);
    }

    // Check if an assessment is locked by questionnaire ID
    @GetMapping("/is-locked-by-questionnaire/{questionnaireId}")
    public ResponseEntity<HashMap<String, Object>> isLockedByQuestionnaire(
            @PathVariable Long questionnaireId) {
        HashMap<String, Object> response = new HashMap<>();
        List<AssessmentTable> assessments = assessmentTableRepository
                .findByQuestionnaireQuestionnaireId(questionnaireId);
        // If any linked assessment is locked, treat as locked
        AssessmentTable lockedAssessment = assessments.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsLocked()))
                .findFirst().orElse(null);
        if (lockedAssessment != null) {
            response.put("isLocked", true);
            response.put("assessmentId", lockedAssessment.getId());
            response.put("assessmentName", lockedAssessment.getAssessmentName());
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
        List<AssessmentTable> assessments = assessmentTableRepository.findByQuestionSectionId(sectionId);
        AssessmentTable lockedAssessment = assessments.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsLocked()))
                .findFirst().orElse(null);
        if (lockedAssessment != null) {
            response.put("isLocked", true);
            response.put("assessmentId", lockedAssessment.getId());
            response.put("assessmentName", lockedAssessment.getAssessmentName());
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

    /**
     * Public prefetch endpoint - returns assessment data for a student before auth.
     * Called when student types their ID on login page to pre-load assessment data.
     * Uses batch query to avoid N+1 problem.
     */
    @GetMapping("/prefetch/{userStudentId}")
    public ResponseEntity<?> prefetchAssessmentData(@PathVariable Long userStudentId) {
        try {
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findByUserStudentUserStudentId(userStudentId);

            if (mappings.isEmpty()) {
                return ResponseEntity.ok(java.util.Collections.emptyList());
            }

            // Batch fetch all assessments in one query instead of N+1
            List<Long> assessmentIds = mappings.stream()
                    .map(StudentAssessmentMapping::getAssessmentId)
                    .collect(java.util.stream.Collectors.toList());
            java.util.Map<Long, AssessmentTable> assessmentMap = new HashMap<>();
            assessmentTableRepository.findAllByIdInWithQuestionnaire(assessmentIds)
                    .forEach(a -> assessmentMap.put(a.getId(), a));

            java.util.ArrayList<HashMap<String, Object>> result = new java.util.ArrayList<>();

            for (StudentAssessmentMapping mapping : mappings) {
                HashMap<String, Object> assessmentInfo = new HashMap<>();
                assessmentInfo.put("assessmentId", mapping.getAssessmentId());
                assessmentInfo.put("status", mapping.getStatus());

                AssessmentTable assessment = assessmentMap.get(mapping.getAssessmentId());
                if (assessment != null) {
                    assessmentInfo.put("assessmentName", assessment.getAssessmentName());
                    assessmentInfo.put("isActive", assessment.getIsActive());
                    assessmentInfo.put("showTimer", assessment.getShowTimer());
                    assessmentInfo.put("isLocked", assessment.getIsLocked());

                    if (assessment.getQuestionnaire() != null) {
                        assessmentInfo.put("questionnaireType", assessment.getQuestionnaire().getType());
                        assessmentInfo.put("questionnaireId", assessment.getQuestionnaire().getQuestionnaireId());
                    }
                }

                result.add(assessmentInfo);
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error prefetching assessment data for student {}", userStudentId, e);
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
    }

    /**
     * Export a locked assessment's full data bundle (questionnaire + config) as JSON.
     */
    @GetMapping("/{id}/export")
    public ResponseEntity<?> exportAssessmentBundle(@PathVariable Long id) {
        Optional<AssessmentTable> assessmentOpt = assessmentTableRepository.findById(id);
        if (assessmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AssessmentTable assessment = assessmentOpt.get();

        if (!Boolean.TRUE.equals(assessment.getIsLocked())) {
            HashMap<String, Object> error = new HashMap<>();
            error.put("error", "Assessment is not locked. Only locked assessments can be exported.");
            return ResponseEntity.badRequest().body(error);
        }

        // Try reading from the cached snapshot first
        HashMap<String, Object> snapshot = readLockedSnapshot(id);
        if (snapshot != null) {
            return ResponseEntity.ok(snapshot);
        }

        // Snapshot missing — regenerate it
        generateLockedSnapshot(assessment);
        snapshot = readLockedSnapshot(id);
        if (snapshot != null) {
            return ResponseEntity.ok(snapshot);
        }

        // Fallback: build in-memory
        HashMap<String, Object> bundle = new HashMap<>();
        bundle.put("assessmentId", assessment.getId());
        bundle.put("isLocked", true);
        bundle.put("config", assessment);

        if (assessment.getQuestionnaire() != null) {
            Long questionnaireId = assessment.getQuestionnaire().getQuestionnaireId();
            List<Questionnaire> questionnaireData = questionnaireRepository.findAllByQuestionnaireId(questionnaireId);
            bundle.put("questionnaire", questionnaireData);
        } else {
            bundle.put("questionnaire", java.util.Collections.emptyList());
        }

        return ResponseEntity.ok(bundle);
    }

}
