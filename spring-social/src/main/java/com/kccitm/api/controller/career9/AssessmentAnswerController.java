package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.transaction.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;
import com.kccitm.api.model.career9.QuestionSection;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.AssessmentSubmissionFailureRepository;
import com.kccitm.api.repository.AssessmentAdminActionRepository;
import com.kccitm.api.model.career9.AssessmentAdminAction;
import com.kccitm.api.model.career9.AssessmentSubmissionFailure;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse.*;
import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.service.AssessmentSessionService;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/assessment-answer")
public class AssessmentAnswerController {
    private static final Logger logger = LoggerFactory.getLogger(AssessmentAnswerController.class);
    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;

    @Autowired
    private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private com.kccitm.api.service.CareerNineRollNumberService rollNumberService;

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    @Autowired
    private com.kccitm.api.service.PartialAnswerFlushService partialAnswerFlushService;

    @Autowired
    private com.kccitm.api.service.AssessmentSubmissionProcessorService submissionProcessorService;

    @Autowired
    private com.kccitm.api.service.AssessmentCompletionService completionService;

    @Autowired
    private AssessmentSubmissionFailureRepository submissionFailureRepository;

    @Autowired
    private AssessmentAdminActionRepository adminActionRepository;

    @GetMapping(value = "/getByStudent/{studentId}", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAssessmentAnswersByStudent(@PathVariable("studentId") Long studentId) {
        UserStudent userStudent = userStudentRepository.findById(studentId).orElse(null);
        return assessmentAnswerRepository.findByUserStudent(userStudent);
    }

    @GetMapping(value = "/getAll", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAllAssessmentAnswers() {
        return assessmentAnswerRepository.findAll();
    }

    @PostMapping(value = "/submit", headers = "Accept=application/json")
    public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
        // 1. Basic Extraction & Validation
        if (submissionData.get("userStudentId") == null || submissionData.get("assessmentId") == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
        Long assessmentId = ((Number) submissionData.get("assessmentId")).longValue();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");
        if (answers == null || answers.isEmpty()) {
            return ResponseEntity.badRequest().body("No answers provided");
        }

        // 2. Excess-payload guards.
        // Note: `answers.length` can legitimately exceed question count for
        // multi-select + ranking + text questions (one entry per option/text).
        // The meaningful check is on DISTINCT questionIds.
        //
        //   distinctQuestionIds > expected          → corrupted payload (unknown questions)
        //   answers.length > expected * 10          → DOS/corruption ceiling
        int expectedQuestionCount = completionService.getTotalQuestions(assessmentId);
        int distinctQuestionIds = 0;
        {
            java.util.Set<Long> seen = new java.util.HashSet<>();
            for (Map<String, Object> a : answers) {
                Object raw = a.get("questionnaireQuestionId");
                if (raw instanceof Number) seen.add(((Number) raw).longValue());
            }
            distinctQuestionIds = seen.size();
        }
        if (expectedQuestionCount > 0) {
            if (distinctQuestionIds > expectedQuestionCount
                    || answers.size() > expectedQuestionCount * 10) {
                logger.error("Rejecting submission: distinctQuestions={} answers={} expected={} for assessment {}",
                        distinctQuestionIds, answers.size(), expectedQuestionCount, assessmentId);
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Submission payload is corrupted (too many questions or entries)",
                        "answersReceived", answers.size(),
                        "distinctQuestions", distinctQuestionIds,
                        "expected", expectedQuestionCount
                ));
            }
        }

        // 3. Idempotency: short-lived in-flight lock (90s auto-expire).
        // If a previous submission just finished, return its cached result.
        if (!assessmentSessionService.acquireSubmissionLock(userStudentId, assessmentId)) {
            Object cachedResult = assessmentSessionService.getSubmissionResult(userStudentId, assessmentId);
            if (cachedResult != null && !"processing".equals(cachedResult)) {
                return ResponseEntity.ok(cachedResult);
            }
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Submission already in progress",
                    "status", "duplicate"
            ));
        }

        try {
            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

            // 4. Find or create mapping (race-safe)
            StudentAssessmentMapping mapping;
            try {
                mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                        .orElseGet(() -> {
                            StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                            newMapping.setUserStudent(userStudent);
                            newMapping.setAssessmentId(assessmentId);
                            return studentAssessmentMappingRepository.save(newMapping);
                        });
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                        .orElseThrow(() -> new ServiceException("Failed to create/find assessment mapping"));
            }

            // 5. SERVER-SIDE status contract (ignore anything client sent):
            //   - status = "completed"     → student has finished (Redis holds the submission)
            //   - persistenceState = "pending" → answers not in MySQL yet
            // The async processor flips persistenceState to "persisted" /
            // "persisted_with_warnings" / "failed" once it runs. Resetting the
            // mapping's persistenceState here ensures a retry after a prior
            // "failed" starts cleanly.
            mapping.setStatus("completed");
            mapping.setPersistenceState("pending");
            studentAssessmentMappingRepository.save(mapping);

            // 6. Save full submission to Redis for async processing
            assessmentSessionService.saveSubmittedAnswers(userStudentId, assessmentId, submissionData);

            // 7. Fire async processing (non-blocking)
            submissionProcessorService.processSubmissionAsync(userStudentId, assessmentId);

            logger.info("Submission accepted: student={} assessment={} answers={}",
                    userStudentId, assessmentId, answers.size());
            return ResponseEntity.ok(Map.of(
                    "status", "accepted",
                    "answersReceived", answers.size()
            ));

        } catch (Exception e) {
            assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);
            throw e;
        }
    }

    /**
     * Save a draft of student's current answer state to Redis.
     * Called periodically (every 30s) by the frontend to back up localStorage.
     * Accepts a JSON blob with userStudentId, assessmentId, and answer state.
     */
    @PostMapping(value = "/draft-save", headers = "Accept=application/json")
    public ResponseEntity<?> saveDraft(@RequestBody Map<String, Object> draftData) {
        Long studentId = ((Number) draftData.get("userStudentId")).longValue();
        Long assessmentId = ((Number) draftData.get("assessmentId")).longValue();

        assessmentSessionService.saveDraft(studentId, assessmentId, draftData);

        Map<String, String> response = new HashMap<>();
        response.put("status", "saved");
        return ResponseEntity.ok(response);
    }

    /**
     * Restore a saved draft for a student+assessment pair.
     * Called by the frontend on page load to recover answers after browser crash.
     * Returns 404 if no draft exists.
     */
    @GetMapping(value = "/draft-restore/{studentId}/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> restoreDraft(@PathVariable Long studentId, @PathVariable Long assessmentId) {
        Object draft = assessmentSessionService.getDraft(studentId, assessmentId);

        if (draft == null) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "no_draft");
            return ResponseEntity.status(404).body(response);
        }
        return ResponseEntity.ok(draft);
    }

    // ============ OFFLINE ASSESSMENT UPLOAD ENDPOINTS ============

    /**
     * Returns question-header-to-options mapping for an assessment's questionnaire.
     * Used by the frontend to build the Excel template and parse uploaded data.
     */
    @GetMapping(value = "/offline-mapping/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getOfflineMapping(@PathVariable Long assessmentId) {
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

            if (assessment.getQuestionnaire() == null) {
                return ResponseEntity.status(400).body("Assessment has no linked questionnaire");
            }

            Long questionnaireId = assessment.getQuestionnaire().getQuestionnaireId();
            String questionnaireName = assessment.getQuestionnaire().getName();

            List<QuestionnaireQuestion> qqList = questionnaireQuestionRepository
                    .findByQuestionnaireIdWithOptions(questionnaireId);

            List<Map<String, Object>> questions = new ArrayList<>();
            for (QuestionnaireQuestion qq : qqList) {
                Map<String, Object> qMap = new HashMap<>();
                qMap.put("questionnaireQuestionId", qq.getQuestionnaireQuestionId());
                qMap.put("excelQuestionHeader", qq.getExcelQuestionHeader());

                // Add section info
                QuestionnaireSection qs = qq.getSection();
                if (qs != null) {
                    qMap.put("questionnaireSectionId", qs.getQuestionnaireSectionId());
                    qMap.put("sectionOrder", qs.getOrder());
                    QuestionSection qSection = qs.getSection();
                    if (qSection != null) {
                        qMap.put("sectionName", qSection.getSectionName());
                    } else {
                        qMap.put("sectionName", null);
                    }
                } else {
                    qMap.put("questionnaireSectionId", null);
                    qMap.put("sectionOrder", null);
                    qMap.put("sectionName", null);
                }

                AssessmentQuestions aq = qq.getQuestion();
                if (aq != null) {
                    qMap.put("questionText", aq.getQuestionText());
                    qMap.put("questionType", aq.getQuestionType());
                    qMap.put("isMQT", aq.getIsMQT() != null ? aq.getIsMQT() : false);

                    // Build options with computed sequence (1-indexed, ordered by optionId)
                    List<Map<String, Object>> optionsList = new ArrayList<>();
                    if (aq.getOptions() != null) {
                        List<AssessmentQuestionOptions> sortedOptions = new ArrayList<>(aq.getOptions());
                        sortedOptions.sort((a, b) -> Long.compare(a.getOptionId(), b.getOptionId()));

                        int seq = 1;
                        for (AssessmentQuestionOptions opt : sortedOptions) {
                            Map<String, Object> oMap = new HashMap<>();
                            oMap.put("optionId", opt.getOptionId());
                            oMap.put("sequence", seq++);
                            oMap.put("optionText", opt.getOptionText());
                            optionsList.add(oMap);
                        }
                    }
                    qMap.put("options", optionsList);
                } else {
                    qMap.put("questionText", null);
                    qMap.put("questionType", null);
                    qMap.put("isMQT", false);
                    qMap.put("options", new ArrayList<>());
                }

                questions.add(qMap);
            }

            // Group questions by section, sorted alphabetically by sectionName
            Map<Long, Map<String, Object>> sectionMap = new LinkedHashMap<>();
            for (Map<String, Object> qMap : questions) {
                Long qsId = (Long) qMap.get("questionnaireSectionId");
                if (qsId == null) continue;
                sectionMap.computeIfAbsent(qsId, k -> {
                    Map<String, Object> s = new LinkedHashMap<>();
                    s.put("questionnaireSectionId", qsId);
                    s.put("sectionName", qMap.get("sectionName"));
                    s.put("sectionOrder", qMap.get("sectionOrder"));
                    s.put("questions", new ArrayList<Map<String, Object>>());
                    return s;
                });
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> sectionQuestions =
                        (List<Map<String, Object>>) sectionMap.get(qsId).get("questions");
                sectionQuestions.add(qMap);
            }
            List<Map<String, Object>> sections = new ArrayList<>(sectionMap.values());
            sections.sort((a, b) -> {
                String nameA = (String) a.get("sectionName");
                String nameB = (String) b.get("sectionName");
                if (nameA == null) return 1;
                if (nameB == null) return -1;
                return nameA.compareTo(nameB);
            });

            Map<String, Object> result = new HashMap<>();
            result.put("assessmentId", assessmentId);
            result.put("assessmentName", assessment.getAssessmentName());
            result.put("questionnaireId", questionnaireId);
            result.put("questionnaireName", questionnaireName);
            result.put("questions", questions);
            result.put("sections", sections);

            return ResponseEntity.ok(result);
    }

    /**
     * Bulk submit offline assessment answers for multiple students.
     * Supports re-upload: deletes old answers before saving new ones.
     */
    @Transactional
    @PostMapping(value = "/bulk-submit", headers = "Accept=application/json")
    public ResponseEntity<?> bulkSubmitAnswers(@RequestBody Map<String, Object> payload) {
        Long assessmentId = ((Number) payload.get("assessmentId")).longValue();

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

            List<Map<String, Object>> students = (List<Map<String, Object>>) payload.get("students");
            int successCount = 0;
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Map<String, Object> studentData : students) {
                Long userStudentId = ((Number) studentData.get("userStudentId")).longValue();

                try {
                    UserStudent userStudent = userStudentRepository.findById(userStudentId)
                            .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

                    // Find or create mapping
                    StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                            .orElseGet(() -> {
                                StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                                newMapping.setUserStudent(userStudent);
                                newMapping.setAssessmentId(assessmentId);
                                return studentAssessmentMappingRepository.save(newMapping);
                            });

                    // NOTE: status flip deferred until after answers are persisted and
                    // stale rows deleted, so completionService can check the true answer count.

                    // SAFE: Collect existing IDs before any writes
                    List<Long> existingAnswerIds = assessmentAnswerRepository
                        .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId)
                        .stream()
                        .map(AssessmentAnswer::getAssessmentAnswerId)
                        .collect(Collectors.toList());

                    List<Long> existingScoreIds = assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
                        .stream()
                        .map(AssessmentRawScore::getAssessmentRawScoreId)
                        .collect(Collectors.toList());

                    // Process and save new answers
                    List<Map<String, Object>> answers = (List<Map<String, Object>>) studentData.get("answers");
                    Map<Long, Integer> qualityTypeScores = new HashMap<>();
                    Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();

                    for (Map<String, Object> ansMap : answers) {
                        Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
                        Long oId = ((Number) ansMap.get("optionId")).longValue();

                        QuestionnaireQuestion question = questionnaireQuestionRepository.findById(qId).orElse(null);
                        AssessmentQuestionOptions option = assessmentQuestionOptionsRepository.findById(oId)
                                .orElse(null);

                        if (question != null && option != null) {
                            AssessmentAnswer ans = new AssessmentAnswer();
                            ans.setUserStudent(userStudent);
                            ans.setAssessment(assessment);
                            ans.setQuestionnaireQuestion(question);
                            ans.setOption(option);

                            Integer rankOrder = ansMap.containsKey("rankOrder")
                                    ? ((Number) ansMap.get("rankOrder")).intValue()
                                    : null;
                            if (rankOrder != null) {
                                ans.setRankOrder(rankOrder);
                            }

                            assessmentAnswerRepository.save(ans);

                            // Accumulate scores (deduplicate by MQT type per option)
                            List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                    .findByOptionId(oId);
                            Map<Long, OptionScoreBasedOnMEasuredQualityTypes> dedupedScores = new java.util.LinkedHashMap<>();
                            for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                dedupedScores.putIfAbsent(s.getMeasuredQualityType().getMeasuredQualityTypeId(), s);
                            }
                            for (OptionScoreBasedOnMEasuredQualityTypes s : dedupedScores.values()) {
                                MeasuredQualityTypes type = s.getMeasuredQualityType();
                                Long typeId = type.getMeasuredQualityTypeId();
                                int effectiveScore = (rankOrder != null) ? s.getScore() * rankOrder : s.getScore();
                                qualityTypeScores.merge(typeId, effectiveScore, Integer::sum);
                                qualityTypeCache.putIfAbsent(typeId, type);
                            }
                        }
                    }

                    // Save new raw scores
                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

                    // Delete old records by specific IDs
                    if (!existingAnswerIds.isEmpty()) {
                        assessmentAnswerRepository.deleteAllById(existingAnswerIds);
                    }
                    if (!existingScoreIds.isEmpty()) {
                        assessmentRawScoreRepository.deleteAllById(existingScoreIds);
                    }

                    // Guarded completion: only flip to "completed" if every question is answered.
                    completionService.markCompletedIfFullyAnswered(mapping);

                    successCount++;

                } catch (Exception e) {
                    Map<String, Object> err = new HashMap<>();
                    err.put("userStudentId", userStudentId);
                    err.put("error", e.getMessage());
                    errors.add(err);
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("studentsProcessed", successCount);
            result.put("errors", errors);
            return ResponseEntity.ok(result);
    }

    // ============ BULK SUBMIT WITH STUDENT AUTO-CREATION ============

    /** Simple wrapper to indicate whether a student was matched or created. */
    private static class ResolveResult {
        final UserStudent userStudent;
        final boolean created;
        ResolveResult(UserStudent userStudent, boolean created) {
            this.userStudent = userStudent;
            this.created = created;
        }
    }

    /**
     * Resolve an existing student or create a new one.
     * Matching tiers: (1) name+DOB+institute, (2) name+phone+institute, (3) name+institute if unique.
     */
    private ResolveResult resolveOrCreateUserStudent(
            String name, Date dob, String phone, Integer instituteId, InstituteDetail institute,
            Integer schoolSectionId) {

        // Tier 1: name + DOB + institute
        if (dob != null) {
            List<StudentInfo> candidates = studentInfoRepository
                    .findByNameIgnoreCaseAndStudentDobAndInstituteId(name, dob, instituteId);
            if (candidates.size() == 1) {
                Optional<UserStudent> us = userStudentRepository.findByStudentInfo(candidates.get(0));
                if (us.isPresent()) return new ResolveResult(us.get(), false);
                return new ResolveResult(userStudentRepository.save(
                        new UserStudent(candidates.get(0).getUser(), candidates.get(0), institute)), false);
            }
        }

        // Tier 2: name + phone + institute
        if (phone != null && !phone.isEmpty()) {
            List<StudentInfo> candidates = studentInfoRepository
                    .findByNameIgnoreCaseAndPhoneNumberAndInstituteId(name, phone, instituteId);
            if (candidates.size() == 1) {
                Optional<UserStudent> us = userStudentRepository.findByStudentInfo(candidates.get(0));
                if (us.isPresent()) return new ResolveResult(us.get(), false);
                return new ResolveResult(userStudentRepository.save(
                        new UserStudent(candidates.get(0).getUser(), candidates.get(0), institute)), false);
            }
        }

        // Tier 3: name + institute (only if unique)
        List<StudentInfo> candidates = studentInfoRepository
                .findByNameIgnoreCaseAndInstituteId(name, instituteId);
        if (candidates.size() == 1) {
            Optional<UserStudent> us = userStudentRepository.findByStudentInfo(candidates.get(0));
            if (us.isPresent()) return new ResolveResult(us.get(), false);
            return new ResolveResult(userStudentRepository.save(
                    new UserStudent(candidates.get(0).getUser(), candidates.get(0), institute)), false);
        }
        if (candidates.size() > 1) {
            throw new BadRequestException("Multiple students matched by name at this institute. Provide DOB or phone to disambiguate.");
        }

        // No match: create new student
        User user = userRepository.save(new User((int) (Math.random() * 9000) + 1000, dob));
        user.setName(name);

        // Generate and set careerNineRollNumber
        String rollNumber = rollNumberService.generateNextRollNumber(instituteId, schoolSectionId);
        if (rollNumber != null) {
            user.setCareerNineRollNumber(rollNumber);
        }
        user = userRepository.save(user);

        StudentInfo si = new StudentInfo();
        si.setName(name);
        si.setStudentDob(dob);
        si.setPhoneNumber(phone);
        si.setInstituteId(instituteId);
        si.setSchoolSectionId(schoolSectionId);
        si.setUser(user);
        si = studentInfoRepository.save(si);

        return new ResolveResult(userStudentRepository.save(new UserStudent(user, si, institute)), true);
    }

    /**
     * Bulk submit offline assessment answers with automatic student matching/creation.
     * For each student row: matches existing student or creates new one, then submits answers.
     * Supports re-upload: deletes old answers before saving new ones.
     */
    @Transactional
    @PostMapping(value = "/bulk-submit-with-students", headers = "Accept=application/json")
    public ResponseEntity<?> bulkSubmitWithStudents(@RequestBody Map<String, Object> payload) {
        Long assessmentId = ((Number) payload.get("assessmentId")).longValue();
        Integer instituteId = ((Number) payload.get("instituteId")).intValue();

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

        InstituteDetail institute = instituteDetailRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute", "id", instituteId));

            List<Map<String, Object>> students = (List<Map<String, Object>>) payload.get("students");
            int successCount = 0;
            int matchedCount = 0;
            int createdCount = 0;
            List<Map<String, Object>> errors = new ArrayList<>();

            for (int i = 0; i < students.size(); i++) {
                Map<String, Object> studentData = students.get(i);
                String studentName = (String) studentData.getOrDefault("name", "");

                try {
                    String name = studentName.trim();
                    if (name.isEmpty()) {
                        throw new BadRequestException("Student name is required");
                    }

                    String dobStr = studentData.get("dob") != null
                            ? String.valueOf(studentData.get("dob")).trim() : "";
                    String phone = studentData.get("phone") != null
                            ? String.valueOf(studentData.get("phone")).trim() : "";

                    Integer schoolSectionId = studentData.get("schoolSectionId") != null
                            ? ((Number) studentData.get("schoolSectionId")).intValue() : null;

                    Date dob = null;
                    if (!dobStr.isEmpty()) {
                        dob = new SimpleDateFormat("dd-MM-yyyy").parse(dobStr);
                    }

                    ResolveResult result = resolveOrCreateUserStudent(name, dob, phone, instituteId, institute, schoolSectionId);
                    UserStudent userStudent = result.userStudent;
                    if (result.created) {
                        createdCount++;
                    } else {
                        matchedCount++;
                    }

                    Long userStudentId = userStudent.getUserStudentId();

                    // Find or create mapping
                    StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                            .orElseGet(() -> {
                                StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                                newMapping.setUserStudent(userStudent);
                                newMapping.setAssessmentId(assessmentId);
                                return studentAssessmentMappingRepository.save(newMapping);
                            });

                    // NOTE: status flip deferred until after answers are persisted and
                    // stale rows deleted, so completionService can check the true answer count.

                    // SAFE: Collect existing IDs before any writes
                    List<Long> existingAnswerIds = assessmentAnswerRepository
                        .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId)
                        .stream()
                        .map(AssessmentAnswer::getAssessmentAnswerId)
                        .collect(Collectors.toList());

                    List<Long> existingScoreIds = assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
                        .stream()
                        .map(AssessmentRawScore::getAssessmentRawScoreId)
                        .collect(Collectors.toList());

                    // Process and save new answers
                    List<Map<String, Object>> answers = (List<Map<String, Object>>) studentData.get("answers");
                    Map<Long, Integer> qualityTypeScores = new HashMap<>();
                    Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();

                    if (answers != null) {
                        for (Map<String, Object> ansMap : answers) {
                            Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
                            Long oId = ((Number) ansMap.get("optionId")).longValue();

                            QuestionnaireQuestion question = questionnaireQuestionRepository.findById(qId)
                                    .orElse(null);
                            AssessmentQuestionOptions option = assessmentQuestionOptionsRepository.findById(oId)
                                    .orElse(null);

                            if (question != null && option != null) {
                                AssessmentAnswer ans = new AssessmentAnswer();
                                ans.setUserStudent(userStudent);
                                ans.setAssessment(assessment);
                                ans.setQuestionnaireQuestion(question);
                                ans.setOption(option);

                                Integer rankOrder = ansMap.containsKey("rankOrder")
                                        ? ((Number) ansMap.get("rankOrder")).intValue()
                                        : null;
                                if (rankOrder != null) {
                                    ans.setRankOrder(rankOrder);
                                }

                                assessmentAnswerRepository.save(ans);

                                // Accumulate scores (deduplicate by MQT type per option)
                                List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                        .findByOptionId(oId);
                                Map<Long, OptionScoreBasedOnMEasuredQualityTypes> dedupedScores = new java.util.LinkedHashMap<>();
                                for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                    dedupedScores.putIfAbsent(s.getMeasuredQualityType().getMeasuredQualityTypeId(), s);
                                }
                                for (OptionScoreBasedOnMEasuredQualityTypes s : dedupedScores.values()) {
                                    MeasuredQualityTypes type = s.getMeasuredQualityType();
                                    Long typeId = type.getMeasuredQualityTypeId();
                                    int effectiveScore = (rankOrder != null) ? s.getScore() * rankOrder : s.getScore();
                                    qualityTypeScores.merge(typeId, effectiveScore, Integer::sum);
                                    qualityTypeCache.putIfAbsent(typeId, type);
                                }
                            }
                        }
                    }

                    // Save new raw scores
                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

                    // Delete old records by specific IDs
                    if (!existingAnswerIds.isEmpty()) {
                        assessmentAnswerRepository.deleteAllById(existingAnswerIds);
                    }
                    if (!existingScoreIds.isEmpty()) {
                        assessmentRawScoreRepository.deleteAllById(existingScoreIds);
                    }

                    // Guarded completion: only flip to "completed" if every question is answered.
                    completionService.markCompletedIfFullyAnswered(mapping);

                    successCount++;

                } catch (Exception e) {
                    Map<String, Object> err = new HashMap<>();
                    err.put("rowIndex", i);
                    err.put("name", studentName);
                    err.put("error", e.getMessage());
                    errors.add(err);
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("studentsProcessed", successCount);
            result.put("errors", errors);

            Map<String, Object> matchSummary = new HashMap<>();
            matchSummary.put("matched", matchedCount);
            matchSummary.put("created", createdCount);
            matchSummary.put("failed", errors.size());
            result.put("matchSummary", matchSummary);

            return ResponseEntity.ok(result);
    }

    // ============ BULK SUBMIT BY ROLL NUMBER ============

    /**
     * Bulk submit offline assessment answers matched by careerNineRollNumber.
     * Students must already exist. Each row has a rollNumber + answers.
     */
    @Transactional
    @PostMapping(value = "/bulk-submit-by-rollnumber", headers = "Accept=application/json")
    public ResponseEntity<?> bulkSubmitByRollNumber(@RequestBody Map<String, Object> payload) {
        Long assessmentId = ((Number) payload.get("assessmentId")).longValue();
        Integer instituteId = ((Number) payload.get("instituteId")).intValue();

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

        InstituteDetail institute = instituteDetailRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute", "id", instituteId));

            List<Map<String, Object>> students = (List<Map<String, Object>>) payload.get("students");
            int successCount = 0;
            int matchedCount = 0;
            List<Map<String, Object>> errors = new ArrayList<>();

            for (int i = 0; i < students.size(); i++) {
                Map<String, Object> studentData = students.get(i);
                String rollNumber = studentData.get("rollNumber") != null
                        ? String.valueOf(studentData.get("rollNumber")).trim() : "";

                try {
                    if (rollNumber.isEmpty()) {
                        throw new BadRequestException("Roll number is required");
                    }

                    // Find user by careerNineRollNumber
                    Optional<User> userOpt = userRepository.findByCareerNineRollNumber(rollNumber);
                    if (!userOpt.isPresent()) {
                        throw new ResourceNotFoundException("User", "rollNumber", rollNumber);
                    }

                    User user = userOpt.get();

                    // Find StudentInfo for this user
                    StudentInfo studentInfo = studentInfoRepository.findByUser(user);
                    if (studentInfo == null) {
                        throw new ResourceNotFoundException("StudentInfo", "rollNumber", rollNumber);
                    }

                    // Find or create UserStudent
                    Optional<UserStudent> userStudentOpt = userStudentRepository.findByStudentInfo(studentInfo);
                    UserStudent userStudent;
                    if (userStudentOpt.isPresent()) {
                        userStudent = userStudentOpt.get();
                    } else {
                        userStudent = userStudentRepository.save(new UserStudent(user, studentInfo, institute));
                    }

                    matchedCount++;
                    Long userStudentId = userStudent.getUserStudentId();

                    // Find or create mapping
                    StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                            .orElseGet(() -> {
                                StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                                newMapping.setUserStudent(userStudent);
                                newMapping.setAssessmentId(assessmentId);
                                return studentAssessmentMappingRepository.save(newMapping);
                            });

                    // NOTE: status flip deferred until after answers are persisted and
                    // stale rows deleted, so completionService can check the true answer count.

                    // SAFE: Collect existing IDs before any writes
                    List<Long> existingAnswerIds = assessmentAnswerRepository
                        .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId)
                        .stream()
                        .map(AssessmentAnswer::getAssessmentAnswerId)
                        .collect(Collectors.toList());

                    List<Long> existingScoreIds = assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId())
                        .stream()
                        .map(AssessmentRawScore::getAssessmentRawScoreId)
                        .collect(Collectors.toList());

                    // Process and save new answers
                    List<Map<String, Object>> answers = (List<Map<String, Object>>) studentData.get("answers");
                    Map<Long, Integer> qualityTypeScores = new HashMap<>();
                    Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();

                    if (answers != null) {
                        for (Map<String, Object> ansMap : answers) {
                            Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
                            Long oId = ((Number) ansMap.get("optionId")).longValue();

                            QuestionnaireQuestion question = questionnaireQuestionRepository.findById(qId)
                                    .orElse(null);
                            AssessmentQuestionOptions option = assessmentQuestionOptionsRepository.findById(oId)
                                    .orElse(null);

                            if (question != null && option != null) {
                                AssessmentAnswer ans = new AssessmentAnswer();
                                ans.setUserStudent(userStudent);
                                ans.setAssessment(assessment);
                                ans.setQuestionnaireQuestion(question);
                                ans.setOption(option);

                                Integer rankOrder = ansMap.containsKey("rankOrder")
                                        ? ((Number) ansMap.get("rankOrder")).intValue()
                                        : null;
                                if (rankOrder != null) {
                                    ans.setRankOrder(rankOrder);
                                }

                                assessmentAnswerRepository.save(ans);

                                // Accumulate scores (deduplicate by MQT type per option)
                                List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                        .findByOptionId(oId);
                                Map<Long, OptionScoreBasedOnMEasuredQualityTypes> dedupedScores = new java.util.LinkedHashMap<>();
                                for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                    dedupedScores.putIfAbsent(s.getMeasuredQualityType().getMeasuredQualityTypeId(), s);
                                }
                                for (OptionScoreBasedOnMEasuredQualityTypes s : dedupedScores.values()) {
                                    MeasuredQualityTypes type = s.getMeasuredQualityType();
                                    Long typeId = type.getMeasuredQualityTypeId();
                                    int effectiveScore = (rankOrder != null) ? s.getScore() * rankOrder : s.getScore();
                                    qualityTypeScores.merge(typeId, effectiveScore, Integer::sum);
                                    qualityTypeCache.putIfAbsent(typeId, type);
                                }
                            }
                        }
                    }

                    // Save new raw scores
                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

                    // Delete old records by specific IDs
                    if (!existingAnswerIds.isEmpty()) {
                        assessmentAnswerRepository.deleteAllById(existingAnswerIds);
                    }
                    if (!existingScoreIds.isEmpty()) {
                        assessmentRawScoreRepository.deleteAllById(existingScoreIds);
                    }

                    // Guarded completion: only flip to "completed" if every question is answered.
                    completionService.markCompletedIfFullyAnswered(mapping);

                    successCount++;

                } catch (Exception e) {
                    Map<String, Object> err = new HashMap<>();
                    err.put("rowIndex", i);
                    err.put("rollNumber", rollNumber);
                    err.put("error", e.getMessage());
                    errors.add(err);
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("studentsProcessed", successCount);
            result.put("errors", errors);

            Map<String, Object> matchSummary = new HashMap<>();
            matchSummary.put("matched", matchedCount);
            matchSummary.put("failed", errors.size());
            result.put("matchSummary", matchSummary);

            return ResponseEntity.ok(result);
    }

    // ============ TEXT RESPONSE MAPPING ENDPOINTS ============

    /**
     * Get all text responses for a given assessment (for admin mapping page).
     */
    @GetMapping(value = "/text-responses/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getTextResponsesByAssessment(@PathVariable Long assessmentId) {
        List<AssessmentAnswer> textAnswers = assessmentAnswerRepository
                .findByAssessment_IdAndTextResponseIsNotNull(assessmentId);

            // Deduplicate: group by questionnaireQuestionId + textResponse
            // Key: "questionnaireQuestionId|textResponse"
            Map<String, Map<String, Object>> uniqueMap = new java.util.LinkedHashMap<>();

            for (AssessmentAnswer answer : textAnswers) {
                Long qqId = answer.getQuestionnaireQuestion() != null
                        ? answer.getQuestionnaireQuestion().getQuestionnaireQuestionId() : 0L;
                String text = answer.getTextResponse();
                String key = qqId + "|" + text;

                if (uniqueMap.containsKey(key)) {
                    // Add this answer ID to the existing group
                    Map<String, Object> existing = uniqueMap.get(key);
                    ((List<Long>) existing.get("assessmentAnswerIds")).add(answer.getAssessmentAnswerId());
                    existing.put("count", ((int) existing.get("count")) + 1);
                    // Use the first answer's mapped option if any has one
                    if (existing.get("mappedOption") == null && answer.getMappedOption() != null) {
                        Map<String, Object> mapped = new HashMap<>();
                        mapped.put("optionId", answer.getMappedOption().getOptionId());
                        mapped.put("optionText", answer.getMappedOption().getOptionText());
                        existing.put("mappedOption", mapped);
                    }
                    continue;
                }

                Map<String, Object> item = new HashMap<>();
                // Use first answer's ID as the primary, but also include all IDs
                item.put("assessmentAnswerId", answer.getAssessmentAnswerId());
                List<Long> answerIds = new ArrayList<>();
                answerIds.add(answer.getAssessmentAnswerId());
                item.put("assessmentAnswerIds", answerIds);
                item.put("textResponse", text);
                item.put("count", 1);

                // Student info (from first occurrence)
                if (answer.getUserStudent() != null) {
                    Map<String, Object> student = new HashMap<>();
                    student.put("userStudentId", answer.getUserStudent().getUserStudentId());
                    student.put("userId", answer.getUserStudent().getUserId());
                    item.put("student", student);
                }

                // Question info with options (for mapping dropdown)
                if (answer.getQuestionnaireQuestion() != null && answer.getQuestionnaireQuestion().getQuestion() != null) {
                    AssessmentQuestions aq = answer.getQuestionnaireQuestion().getQuestion();
                    Map<String, Object> questionInfo = new HashMap<>();
                    questionInfo.put("questionId", aq.getQuestionId());
                    questionInfo.put("questionText", aq.getQuestionText());
                    questionInfo.put("questionnaireQuestionId", qqId);

                    List<Map<String, Object>> optionsList = new ArrayList<>();
                    if (aq.getOptions() != null) {
                        for (AssessmentQuestionOptions opt : aq.getOptions()) {
                            Map<String, Object> optMap = new HashMap<>();
                            optMap.put("optionId", opt.getOptionId());
                            optMap.put("optionText", opt.getOptionText());
                            optionsList.add(optMap);
                        }
                    }
                    questionInfo.put("options", optionsList);
                    item.put("question", questionInfo);
                }

                // Current mapped option (if any)
                if (answer.getMappedOption() != null) {
                    Map<String, Object> mapped = new HashMap<>();
                    mapped.put("optionId", answer.getMappedOption().getOptionId());
                    mapped.put("optionText", answer.getMappedOption().getOptionText());
                    item.put("mappedOption", mapped);
                }

                uniqueMap.put(key, item);
            }

            return ResponseEntity.ok(new ArrayList<>(uniqueMap.values()));
    }

    /**
     * Map a text response to an existing option.
     */
    @PutMapping(value = "/map-text-response", headers = "Accept=application/json")
    public ResponseEntity<?> mapTextResponse(@RequestBody Map<String, Object> requestData) {
        Long assessmentAnswerId = ((Number) requestData.get("assessmentAnswerId")).longValue();
        Long optionId = ((Number) requestData.get("optionId")).longValue();

        AssessmentAnswer answer = assessmentAnswerRepository.findById(assessmentAnswerId)
                .orElseThrow(() -> new ResourceNotFoundException("AssessmentAnswer", "id", assessmentAnswerId));

        AssessmentQuestionOptions option = assessmentQuestionOptionsRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("AssessmentQuestionOptions", "id", optionId));

            // Apply mapping to ALL answers with the same question + textResponse
            String textResponse = answer.getTextResponse();
            Long qqId = answer.getQuestionnaireQuestion() != null
                    ? answer.getQuestionnaireQuestion().getQuestionnaireQuestionId() : null;

            int mappedCount = 1;
            answer.setMappedOption(option);
            assessmentAnswerRepository.save(answer);

            if (textResponse != null && qqId != null) {
                // Find all other answers with same question and text
                List<AssessmentAnswer> allTextAnswers = assessmentAnswerRepository
                        .findByAssessment_IdAndTextResponseIsNotNull(answer.getAssessment().getId());
                for (AssessmentAnswer other : allTextAnswers) {
                    if (other.getAssessmentAnswerId().equals(assessmentAnswerId)) continue;
                    if (other.getQuestionnaireQuestion() != null
                            && qqId.equals(other.getQuestionnaireQuestion().getQuestionnaireQuestionId())
                            && textResponse.equals(other.getTextResponse())) {
                        other.setMappedOption(option);
                        assessmentAnswerRepository.save(other);
                        mappedCount++;
                    }
                }
            }

            return ResponseEntity.ok(Map.of("status", "success", "assessmentAnswerId", assessmentAnswerId,
                    "mappedOptionId", optionId, "totalMapped", mappedCount));
    }

    /**
     * Recalculate scores for all students in an assessment.
     * Processes both standard option-based answers and mapped text responses.
     */
    @Transactional
    @PostMapping(value = "/recalculate-scores/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> recalculateScores(@PathVariable Long assessmentId) {
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

            // Get all mappings for this assessment
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findAllByAssessmentId(assessmentId);

            int studentsProcessed = 0;

            for (StudentAssessmentMapping mapping : mappings) {
                Long userStudentId = mapping.getUserStudent().getUserStudentId();

                // Get all answers for this student + assessment
                List<AssessmentAnswer> allAnswers = assessmentAnswerRepository
                        .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);

                // Deduplicate answers by question + option to handle re-submissions
                Map<String, AssessmentAnswer> uniqueAnswerMap = new java.util.LinkedHashMap<>();
                for (AssessmentAnswer a : allAnswers) {
                    Long qqId = a.getQuestionnaireQuestion() != null
                            ? a.getQuestionnaireQuestion().getQuestionnaireQuestionId() : 0L;
                    Long optId = a.getOption() != null ? a.getOption().getOptionId()
                            : (a.getMappedOption() != null ? a.getMappedOption().getOptionId() : 0L);
                    String key = qqId + "_" + optId;
                    uniqueAnswerMap.putIfAbsent(key, a);
                }
                List<AssessmentAnswer> answers = new ArrayList<>(uniqueAnswerMap.values());

                Map<Long, Integer> qualityTypeScores = new HashMap<>();
                Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();

                for (AssessmentAnswer answer : answers) {
                    // Score from standard option-based answers
                    AssessmentQuestionOptions scoringOption = null;
                    if (answer.getOption() != null) {
                        scoringOption = answer.getOption();
                    } else if (answer.getMappedOption() != null) {
                        // Score from mapped text responses
                        scoringOption = answer.getMappedOption();
                    }

                    if (scoringOption != null) {
                        Integer rankOrder = answer.getRankOrder();
                        List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                .findByOptionId(scoringOption.getOptionId());
                        Map<Long, OptionScoreBasedOnMEasuredQualityTypes> dedupedScores = new java.util.LinkedHashMap<>();
                        for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                            dedupedScores.putIfAbsent(s.getMeasuredQualityType().getMeasuredQualityTypeId(), s);
                        }
                        for (OptionScoreBasedOnMEasuredQualityTypes s : dedupedScores.values()) {
                            MeasuredQualityTypes type = s.getMeasuredQualityType();
                            Long typeId = type.getMeasuredQualityTypeId();
                            int effectiveScore = (rankOrder != null) ? s.getScore() * rankOrder : s.getScore();
                            qualityTypeScores.merge(typeId, effectiveScore, Integer::sum);
                            qualityTypeCache.putIfAbsent(typeId, type);
                        }
                    }
                }

                // Delete old raw scores and save new ones
                assessmentRawScoreRepository
                        .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                    MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                    AssessmentRawScore ars = new AssessmentRawScore();
                    ars.setStudentAssessmentMapping(mapping);
                    ars.setMeasuredQualityType(mqt);
                    ars.setMeasuredQuality(mqt.getMeasuredQuality());
                    ars.setRawScore(entry.getValue());
                    assessmentRawScoreRepository.save(ars);
                }

                studentsProcessed++;
            }

            return ResponseEntity.ok(Map.of("status", "success", "studentsProcessed", studentsProcessed));
    }

    /**
     * Recalculate raw scores for ALL students across ALL assessments.
     * Uses the corrected ranking logic: mqtScore * rankOrder for ranked answers.
     */
    @Transactional
    @PostMapping(value = "/recalculate-all-scores", headers = "Accept=application/json")
    public ResponseEntity<?> recalculateAllScores() {
        List<StudentAssessmentMapping> allMappings = studentAssessmentMappingRepository.findAll();
            int studentsProcessed = 0;
            int errors = 0;

            for (StudentAssessmentMapping mapping : allMappings) {
                try {
                    Long userStudentId = mapping.getUserStudent().getUserStudentId();
                    Long assessmentId = mapping.getAssessmentId();

                    List<AssessmentAnswer> allAnswers = assessmentAnswerRepository
                            .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);

                    // Deduplicate answers by question + option to handle re-submissions
                    Map<String, AssessmentAnswer> uniqueAnswerMap = new java.util.LinkedHashMap<>();
                    for (AssessmentAnswer a : allAnswers) {
                        Long qqId = a.getQuestionnaireQuestion() != null
                                ? a.getQuestionnaireQuestion().getQuestionnaireQuestionId() : 0L;
                        Long optId = a.getOption() != null ? a.getOption().getOptionId()
                                : (a.getMappedOption() != null ? a.getMappedOption().getOptionId() : 0L);
                        String key = qqId + "_" + optId;
                        uniqueAnswerMap.putIfAbsent(key, a);
                    }
                    List<AssessmentAnswer> answers = new ArrayList<>(uniqueAnswerMap.values());

                    Map<Long, Integer> qualityTypeScores = new HashMap<>();
                    Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();

                    for (AssessmentAnswer answer : answers) {
                        AssessmentQuestionOptions scoringOption = null;
                        if (answer.getOption() != null) {
                            scoringOption = answer.getOption();
                        } else if (answer.getMappedOption() != null) {
                            scoringOption = answer.getMappedOption();
                        }

                        if (scoringOption != null) {
                            Integer rankOrder = answer.getRankOrder();
                            List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                    .findByOptionId(scoringOption.getOptionId());
                            Map<Long, OptionScoreBasedOnMEasuredQualityTypes> dedupedScores = new java.util.LinkedHashMap<>();
                            for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                dedupedScores.putIfAbsent(s.getMeasuredQualityType().getMeasuredQualityTypeId(), s);
                            }
                            for (OptionScoreBasedOnMEasuredQualityTypes s : dedupedScores.values()) {
                                MeasuredQualityTypes type = s.getMeasuredQualityType();
                                Long typeId = type.getMeasuredQualityTypeId();
                                int baseScore = s.getScore() != null ? s.getScore() : 0;
                                int effectiveScore = (rankOrder != null) ? baseScore * rankOrder : baseScore;
                                qualityTypeScores.merge(typeId, effectiveScore, Integer::sum);
                                qualityTypeCache.putIfAbsent(typeId, type);
                            }
                        }
                    }

                    // Delete old raw scores and save new ones
                    assessmentRawScoreRepository
                            .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

                    studentsProcessed++;
                } catch (Exception e) {
                    errors++;
                }
            }

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "totalMappings", allMappings.size(),
                    "studentsProcessed", studentsProcessed,
                    "errors", errors));
    }

    /**
     * Comprehensive endpoint to fetch all assessment data for a student dashboard
     *
     * Returns:
     * - Student basic information
     * - All assessments taken by the student
     * - All answers with selected options and their MQT scores
     * - Aggregated raw scores by MQT for each assessment
     *
     * Request body should contain:
     * {
     *   "userStudentId": 123
     * }
     *
     * @param requestData - JSON containing userStudentId
     * @return StudentDashboardResponse with complete assessment data
     */
    @Transactional
    @PostMapping(value = "/dashboard", headers = "Accept=application/json")
    public ResponseEntity<?> getStudentDashboard(@RequestBody Map<String, Object> requestData) {
        // 1. Extract and validate userStudentId from request body
        if (!requestData.containsKey("userStudentId")) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "Missing required field",
                "message", "userStudentId is required in request body"
            ));
        }

        Long userStudentId = ((Number) requestData.get("userStudentId")).longValue();

        // 2. Fetch and validate student
        UserStudent userStudent = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

            // 3. Build student basic info
            StudentBasicInfo studentInfo = new StudentBasicInfo();
            studentInfo.setUserStudentId(userStudent.getUserStudentId());
            studentInfo.setUserId(userStudent.getUserId());

            if (userStudent.getInstitute() != null) {
                studentInfo.setInstituteName(userStudent.getInstitute().getInstituteName());
                studentInfo.setInstituteCode(userStudent.getInstitute().getInstituteCode());
            }

            // 4. Fetch all assessments for this student
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findByUserStudentUserStudentId(userStudentId);

            List<AssessmentData> assessmentDataList = new ArrayList<>();

            // 5. Process each assessment
            for (StudentAssessmentMapping mapping : mappings) {
                AssessmentData assessmentData = new AssessmentData();

                // 5.1 Set assessment basic info
                Long assessmentId = mapping.getAssessmentId();
                AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);

                if (assessment == null) {
                    continue; // Skip if assessment not found
                }

                assessmentData.setAssessmentId(assessmentId);
                assessmentData.setAssessmentName(assessment.getAssessmentName());
                assessmentData.setStatus(mapping.getStatus());
                assessmentData.setIsActive(assessment.getIsActive());
                assessmentData.setStartDate(assessment.getStarDate());
                assessmentData.setEndDate(assessment.getEndDate());
                assessmentData.setStudentAssessmentMappingId(mapping.getStudentAssessmentId());

                // 5.1.1 Set questionnaire type (true = bet-assessment, false/null = general)
                if (assessment.getQuestionnaire() != null) {
                    assessmentData.setQuestionnaireType(assessment.getQuestionnaire().getType());
                }

                // 5.2 Fetch all answers for this assessment using optimized query
                ArrayList<AssessmentAnswer> answers = assessmentAnswerRepository
                        .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

                List<AnswerDetail> answerDetails = new ArrayList<>();

                for (AssessmentAnswer answer : answers) {
                    AnswerDetail answerDetail = new AnswerDetail();
                    answerDetail.setAssessmentAnswerId(answer.getAssessmentAnswerId());

                    if (answer.getQuestionnaireQuestion() != null) {
                        answerDetail.setQuestionnaireQuestionId(
                                answer.getQuestionnaireQuestion().getQuestionnaireQuestionId());
                    }

                    answerDetail.setRankOrder(answer.getRankOrder());

                    // 5.2.1 Include text response if present
                    if (answer.getTextResponse() != null) {
                        answerDetail.setTextResponse(answer.getTextResponse());
                    }

                    // 5.3 Build option data with MQT scores (from direct option or mapped option)
                    AssessmentQuestionOptions effectiveOption = answer.getOption() != null
                            ? answer.getOption()
                            : answer.getMappedOption();
                    if (effectiveOption != null) {
                        OptionData optionData = new OptionData();
                        optionData.setOptionId(effectiveOption.getOptionId());
                        optionData.setOptionText(effectiveOption.getOptionText());
                        optionData.setOptionDescription(effectiveOption.getOptionDescription());
                        optionData.setIsCorrect(effectiveOption.isCorrect());

                        // 5.4 Fetch MQT scores for this option
                        List<OptionScoreBasedOnMEasuredQualityTypes> optionScores = effectiveOption.getOptionScores();
                        List<MQTScore> mqtScores = new ArrayList<>();

                        if (optionScores != null) {
                            for (OptionScoreBasedOnMEasuredQualityTypes optionScore : optionScores) {
                                MQTScore mqtScore = new MQTScore();
                                mqtScore.setScoreId(optionScore.getScoreId());
                                mqtScore.setScore(optionScore.getScore());

                                // Build MQT data
                                if (optionScore.getMeasuredQualityType() != null) {
                                    MeasuredQualityTypes mqt = optionScore.getMeasuredQualityType();
                                    MQTData mqtData = new MQTData();
                                    mqtData.setMeasuredQualityTypeId(mqt.getMeasuredQualityTypeId());
                                    mqtData.setName(mqt.getMeasuredQualityTypeName());
                                    mqtData.setDescription(mqt.getMeasuredQualityTypeDescription());
                                    mqtData.setDisplayName(mqt.getMeasuredQualityTypeDisplayName());

                                    // Build MQ data (parent quality)
                                    if (mqt.getMeasuredQuality() != null) {
                                        MeasuredQualities mq = mqt.getMeasuredQuality();
                                        MQData mqData = new MQData();
                                        mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                                        mqData.setName(mq.getMeasuredQualityName());
                                        mqData.setDescription(mq.getMeasuredQualityDescription());
                                        mqData.setDisplayName(mq.getQualityDisplayName());

                                        mqtData.setMeasuredQuality(mqData);
                                    }

                                    mqtScore.setMeasuredQualityType(mqtData);
                                }

                                mqtScores.add(mqtScore);
                            }
                        }

                        optionData.setMqtScores(mqtScores);
                        answerDetail.setSelectedOption(optionData);
                    }

                    answerDetails.add(answerDetail);
                }

                assessmentData.setAnswers(answerDetails);

                // 5.5 Fetch raw scores for this assessment
                List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                List<RawScoreData> rawScoreDataList = new ArrayList<>();

                for (AssessmentRawScore rawScore : rawScores) {
                    RawScoreData rawScoreData = new RawScoreData();
                    rawScoreData.setAssessmentRawScoreId(rawScore.getAssessmentRawScoreId());
                    rawScoreData.setRawScore(rawScore.getRawScore());

                    // Build MQT data for raw score
                    if (rawScore.getMeasuredQualityType() != null) {
                        MeasuredQualityTypes mqt = rawScore.getMeasuredQualityType();
                        MQTData mqtData = new MQTData();
                        mqtData.setMeasuredQualityTypeId(mqt.getMeasuredQualityTypeId());
                        mqtData.setName(mqt.getMeasuredQualityTypeName());
                        mqtData.setDescription(mqt.getMeasuredQualityTypeDescription());
                        mqtData.setDisplayName(mqt.getMeasuredQualityTypeDisplayName());

                        // Build MQ data
                        if (mqt.getMeasuredQuality() != null) {
                            MeasuredQualities mq = mqt.getMeasuredQuality();
                            MQData mqData = new MQData();
                            mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                            mqData.setName(mq.getMeasuredQualityName());
                            mqData.setDescription(mq.getMeasuredQualityDescription());
                            mqData.setDisplayName(mq.getQualityDisplayName());

                            mqtData.setMeasuredQuality(mqData);
                        }

                        rawScoreData.setMeasuredQualityType(mqtData);
                    }

                    // Build MQ data for raw score (direct reference)
                    if (rawScore.getMeasuredQuality() != null) {
                        MeasuredQualities mq = rawScore.getMeasuredQuality();
                        MQData mqData = new MQData();
                        mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                        mqData.setName(mq.getMeasuredQualityName());
                        mqData.setDescription(mq.getMeasuredQualityDescription());
                        mqData.setDisplayName(mq.getQualityDisplayName());

                        rawScoreData.setMeasuredQuality(mqData);
                    }

                    rawScoreDataList.add(rawScoreData);
                }

                assessmentData.setRawScores(rawScoreDataList);
                assessmentDataList.add(assessmentData);
            }

            // 6. Build and return final response
            StudentDashboardResponse response = new StudentDashboardResponse();
            response.setStudentInfo(studentInfo);
            response.setAssessments(assessmentDataList);

            return ResponseEntity.ok(response);
    }

    /**
     * Lightweight partial save of student answers to DB on section change.
     * Uses delete-and-replace strategy: deletes all existing answers for this
     * student+assessment, then inserts all current answers.
     * Does NOT calculate scores or change assessment status.
     * Frontend calls this fire-and-forget on every section transition.
     */
    @Transactional
    /**
     * Buffer partial answers in Redis. Called on every section transition.
     * Redis-only by design: MySQL is only written by the final /submit pipeline,
     * so there is exactly one MySQL writer (the async processor). This
     * eliminates the prior save-partial vs submit race.
     *
     * On Redis failure: returns 503. The student's localStorage remains the
     * source of truth; the only consequence is that admin live-tracking loses
     * visibility of in-progress state until Redis recovers.
     */
    @PostMapping(value = "/save-partial", headers = "Accept=application/json")
    public ResponseEntity<?> savePartialAnswers(@RequestBody Map<String, Object> submissionData) {
        if (submissionData.get("userStudentId") == null || submissionData.get("assessmentId") == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
        Long assessmentId = ((Number) submissionData.get("assessmentId")).longValue();

        UserStudent userStudent = userStudentRepository.findById(userStudentId).orElse(null);
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (userStudent == null || assessment == null) {
            return ResponseEntity.badRequest().body("Invalid userStudentId or assessmentId");
        }

        // Ensure mapping exists (find or create), do NOT change status.
        try {
            studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                    .orElseGet(() -> {
                        StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                        newMapping.setUserStudent(userStudent);
                        newMapping.setAssessmentId(assessmentId);
                        return studentAssessmentMappingRepository.save(newMapping);
                    });
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Race condition — mapping was created by another thread, that's fine
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");
        if (answers == null || answers.isEmpty()) {
            return ResponseEntity.ok(Map.of("saved", 0, "status", "no_answers"));
        }

        try {
            assessmentSessionService.savePartialAnswers(userStudentId, assessmentId, answers);
            return ResponseEntity.ok(Map.of(
                    "status", "saved",
                    "saved", answers.size(),
                    "storage", "redis"
            ));
        } catch (Exception redisEx) {
            logger.warn("Redis save-partial failed for student={} assessment={}",
                    userStudentId, assessmentId, redisEx);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "error",
                    "error", "partial buffer unavailable",
                    "message", "Keep answering; localStorage still has your work. Your final submit will persist everything."
            ));
        }
    }

    /**
     * Dashboard endpoint: list all Redis-buffered partial answers.
     * Returns lightweight metadata (no full answer payloads).
     * Optionally filter by assessmentId.
     */
    @GetMapping(value = "/redis-partials")
    public ResponseEntity<?> getRedisPartials(
            @RequestParam(value = "assessmentId", required = false) Long assessmentId) {
        List<Map<String, Object>> entries = assessmentSessionService.getAllPartialAnswerEntries(assessmentId);

        // Enrich with student names
        for (Map<String, Object> entry : entries) {
            Long studentId = ((Number) entry.get("userStudentId")).longValue();
            UserStudent student = userStudentRepository.findById(studentId).orElse(null);
            if (student != null) {
                entry.put("studentName", student.getStudentInfo().getName() + " " + student.getStudentInfo().getFamily());
                entry.put("username",
                        student.getStudentInfo() != null
                                && student.getStudentInfo().getUser() != null
                                && student.getStudentInfo().getUser().getUsername() != null
                                ? student.getStudentInfo().getUser().getUsername()
                                : "");
            } else {
                entry.put("studentName", "Unknown");
                entry.put("username", "");
            }
        }

        return ResponseEntity.ok(entries);
    }

    /**
     * Dashboard endpoint: view the raw Redis JSON for a student's partial answers.
     */
    @GetMapping(value = "/redis-partial-detail")
    public ResponseEntity<?> getRedisPartialDetail(
            @RequestParam("userStudentId") Long userStudentId,
            @RequestParam("assessmentId") Long assessmentId) {
        Map<String, Object> data = assessmentSessionService.getPartialAnswers(userStudentId, assessmentId);
        if (data == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(data);
    }

    /**
     * Dashboard endpoint: admin-triggered submit from Redis partial answers.
     * Reads partial answers from Redis and runs them through the async submission pipeline.
     */
    @SuppressWarnings("unchecked")
    @PostMapping(value = "/submit-from-redis")
    public ResponseEntity<?> submitFromRedis(@RequestBody Map<String, Object> requestData) {
        if (requestData.get("userStudentId") == null || requestData.get("assessmentId") == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Long userStudentId = ((Number) requestData.get("userStudentId")).longValue();
        Long assessmentId = ((Number) requestData.get("assessmentId")).longValue();

        // Read partial answers from Redis
        Map<String, Object> partial = assessmentSessionService.getPartialAnswers(userStudentId, assessmentId);
        if (partial == null || partial.get("answers") == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No partial answers found in Redis");
        }

        List<Map<String, Object>> answers = (List<Map<String, Object>>) partial.get("answers");
        if (answers.isEmpty()) {
            return ResponseEntity.badRequest().body("Partial answers are empty");
        }

        // Acquire submission lock (idempotency)
        if (!assessmentSessionService.acquireSubmissionLock(userStudentId, assessmentId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Submission already in progress or completed",
                    "status", "duplicate"
            ));
        }

        try {
            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));

            // Find/create mapping (race-safe)
            StudentAssessmentMapping mapping;
            try {
                mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                        .orElseGet(() -> {
                            StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                            newMapping.setUserStudent(userStudent);
                            newMapping.setAssessmentId(assessmentId);
                            return studentAssessmentMappingRepository.save(newMapping);
                        });
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                        .orElseThrow(() -> new ServiceException("Failed to create/find assessment mapping"));
            }

            // Admin is finalizing this student's partial as a submission.
            // Apply the same server-side contract as /submit:
            //   status = "completed", persistenceState = "pending"
            mapping.setStatus("completed");
            mapping.setPersistenceState("pending");
            studentAssessmentMappingRepository.save(mapping);

            // Build submission payload and save to Redis for async processing
            Map<String, Object> submissionData = new HashMap<>();
            submissionData.put("userStudentId", userStudentId);
            submissionData.put("assessmentId", assessmentId);
            submissionData.put("answers", answers);

            assessmentSessionService.saveSubmittedAnswers(userStudentId, assessmentId, submissionData);
            submissionProcessorService.processSubmissionAsync(userStudentId, assessmentId);

            logger.info("Admin submit-from-redis accepted for student={} assessment={}", userStudentId, assessmentId);
            return ResponseEntity.ok(Map.of("status", "accepted"));

        } catch (Exception e) {
            assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);
            throw e;
        }
    }

    /**
     * Dashboard endpoint: flush buffered partial answers from Redis to MySQL.
     * Accepts {userStudentId, assessmentId} for a single student,
     * or just {assessmentId} to flush all students for that assessment.
     */
    @Transactional
    @PostMapping(value = "/flush-partial-to-db")
    public ResponseEntity<?> flushPartialToDb(@RequestBody Map<String, Object> requestData) {
        if (requestData.get("assessmentId") == null) {
            return ResponseEntity.badRequest().body("assessmentId is required");
        }
        Long assessmentId = ((Number) requestData.get("assessmentId")).longValue();
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (assessment == null) {
            return ResponseEntity.badRequest().body("Invalid assessmentId");
        }

        // Determine which students to flush and flush via service
        int totalFlushed = 0;
        if (requestData.get("userStudentId") != null) {
            Long studentId = ((Number) requestData.get("userStudentId")).longValue();
            if (partialAnswerFlushService.flushOneStudent(studentId, assessmentId)) {
                totalFlushed++;
            }
        } else {
            List<Map<String, Object>> allEntries = assessmentSessionService.getAllPartialAnswerEntries(assessmentId);
            for (Map<String, Object> meta : allEntries) {
                Long studentId = ((Number) meta.get("userStudentId")).longValue();
                if (partialAnswerFlushService.flushOneStudent(studentId, assessmentId)) {
                    totalFlushed++;
                }
            }
        }

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "flushed", totalFlushed
        ));
    }

    /**
     * GET /assessment-answer/score-debug/{userStudentId}/{assessmentId}
     *
     * Returns a detailed per-answer breakdown of questions, selected options,
     * their MQT/MQ scores, and the totals — useful for backtracing score issues.
     */
    @GetMapping(value = "/score-debug/{userStudentId}/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> scoreDebug(@PathVariable Long userStudentId, @PathVariable Long assessmentId) {
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (!usOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "UserStudent not found"));
        }
        Optional<AssessmentTable> atOpt = assessmentTableRepository.findById(assessmentId);
        if (!atOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Assessment not found"));
        }

        List<AssessmentAnswer> answers = assessmentAnswerRepository
                .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);

        // Per-answer detail rows
        List<Map<String, Object>> rows = new ArrayList<>();
        // Accumulate totals per MQT
        Map<Long, Map<String, Object>> mqtTotals = new LinkedHashMap<>();

        for (AssessmentAnswer ans : answers) {
            AssessmentQuestionOptions opt = ans.getOption();
            if (opt == null) continue;

            // Get question text
            String questionText = "";
            Long questionId = null;
            Long qqId = null;
            String sectionName = "";
            if (ans.getQuestionnaireQuestion() != null) {
                QuestionnaireQuestion qq = ans.getQuestionnaireQuestion();
                qqId = qq.getQuestionnaireQuestionId();
                if (qq.getQuestion() != null) {
                    questionText = qq.getQuestion().getQuestionText();
                    questionId = qq.getQuestion().getQuestionId();
                    if (qq.getQuestion().getSection() != null) {
                        sectionName = qq.getQuestion().getSection().getSectionName();
                    }
                }
            }

            // Get option scores (MQT breakdown)
            List<OptionScoreBasedOnMEasuredQualityTypes> optionScores =
                    optionScoreRepository.findByOptionId(opt.getOptionId());

            if (optionScores.isEmpty()) {
                // Still include the answer row even with no MQT scores
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("qqId", qqId);
                row.put("questionId", questionId);
                row.put("questionText", questionText);
                row.put("sectionName", sectionName);
                row.put("optionId", opt.getOptionId());
                row.put("optionText", opt.getOptionText());
                row.put("rankOrder", ans.getRankOrder());
                row.put("textResponse", ans.getTextResponse());
                row.put("mqtId", null);
                row.put("mqtName", null);
                row.put("mqId", null);
                row.put("mqName", null);
                row.put("score", 0);
                rows.add(row);
            } else {
                for (OptionScoreBasedOnMEasuredQualityTypes os : optionScores) {
                    MeasuredQualityTypes mqt = os.getMeasuredQualityType();
                    if (mqt == null) continue;

                    MeasuredQualities mq = mqt.getMeasuredQuality();
                    int score = os.getScore() != null ? os.getScore() : 0;

                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("qqId", qqId);
                    row.put("questionId", questionId);
                    row.put("questionText", questionText);
                    row.put("sectionName", sectionName);
                    row.put("optionId", opt.getOptionId());
                    row.put("optionText", opt.getOptionText());
                    row.put("rankOrder", ans.getRankOrder());
                    row.put("textResponse", ans.getTextResponse());
                    row.put("mqtId", mqt.getMeasuredQualityTypeId());
                    row.put("mqtName", mqt.getMeasuredQualityTypeName());
                    row.put("mqId", mq != null ? mq.getMeasuredQualityId() : null);
                    row.put("mqName", mq != null ? mq.getMeasuredQualityName() : null);
                    row.put("score", score);
                    rows.add(row);

                    // Accumulate MQT totals
                    Long mqtId = mqt.getMeasuredQualityTypeId();
                    Map<String, Object> tot = mqtTotals.computeIfAbsent(mqtId, k -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("mqtId", mqtId);
                        m.put("mqtName", mqt.getMeasuredQualityTypeName());
                        m.put("mqId", mq != null ? mq.getMeasuredQualityId() : null);
                        m.put("mqName", mq != null ? mq.getMeasuredQualityName() : null);
                        m.put("calculatedTotal", 0);
                        return m;
                    });
                    tot.put("calculatedTotal", (int) tot.get("calculatedTotal") + score);
                }
            }
        }

        // Get stored raw scores for comparison
        Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        List<Map<String, Object>> storedScores = new ArrayList<>();
        if (samOpt.isPresent()) {
            List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                    .findByStudentAssessmentMappingStudentAssessmentId(samOpt.get().getStudentAssessmentId());
            for (AssessmentRawScore rs : rawScores) {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("mqtId", rs.getMeasuredQualityType() != null ? rs.getMeasuredQualityType().getMeasuredQualityTypeId() : null);
                s.put("mqtName", rs.getMeasuredQualityType() != null ? rs.getMeasuredQualityType().getMeasuredQualityTypeName() : null);
                s.put("mqId", rs.getMeasuredQuality() != null ? rs.getMeasuredQuality().getMeasuredQualityId() : null);
                s.put("mqName", rs.getMeasuredQuality() != null ? rs.getMeasuredQuality().getMeasuredQualityName() : null);
                s.put("storedRawScore", rs.getRawScore());
                storedScores.add(s);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userStudentId", userStudentId);
        result.put("assessmentId", assessmentId);
        result.put("studentName", usOpt.get().getStudentInfo() != null ? usOpt.get().getStudentInfo().getName() : null);
        result.put("assessmentName", atOpt.get().getAssessmentName());
        result.put("totalAnswers", answers.size());
        result.put("answerDetails", rows);
        result.put("calculatedTotals", new ArrayList<>(mqtTotals.values()));
        result.put("storedRawScores", storedScores);
        return ResponseEntity.ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PENDING PERSISTENCE — admin diagnostics for submitted-but-not-persisted
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Lists all submissions that may need admin attention for an assessment.
     * Covers three buckets:
     *
     *   (a) status=completed + persistenceState IN (pending|failed|persisted_with_warnings|null)
     *   (b) status=completed + persistenceState=persisted BUT dbCount &lt; expected
     *       (shouldn't happen in new code but catches legacy ghost completions)
     *   (c) status=ongoing + Redis has submitted: payload
     *       (student got as far as submit but something blocked it — admin
     *        can retry from Redis on their behalf)
     *
     * Diagnostics:
     *   awaiting_processor           Redis ✓, DB 0/N              → Retry Now
     *   partial_inflight             Redis ✓, DB &lt;N               → Retry Now
     *   duplicate_cleanup_needed     Redis ✓, DB =N                → Clean Up Redis
     *   excess_pending               Redis (&gt;N), DB 0/N            → Inspect → Retry
     *   excess_already_persisted     Redis (&gt;N), DB =N             → Clean Up Redis
     *   excess_partial_db            Redis (&gt;N), DB &lt;N             → Inspect → Reset
     *   reconcile_only               Redis ✗, DB =N                → Mark as Persisted
     *   ghost_partial                Redis ✗, DB &lt;N (and &gt;0)       → Reset
     *   ghost_empty                  Redis ✗, DB 0                 → Reset
     *   persisted_with_warnings      persistenceState warnings, DB complete → Retry or dismiss
     *   persisted_incomplete         DB &lt;N but flagged persisted   → Retry (if Redis) or Reset
     *   stuck_ongoing                status=ongoing + Redis submitted present → Finalize from Redis
     */
    @GetMapping(value = "/pending-persistence")
    public ResponseEntity<?> getPendingPersistence(
            @RequestParam(value = "assessmentId", required = false) Long assessmentId) {

        if (assessmentId == null) {
            return ResponseEntity.badRequest().body("assessmentId is required");
        }

        List<StudentAssessmentMapping> completedRows =
                studentAssessmentMappingRepository.findCompletedForAssessment(assessmentId);
        List<StudentAssessmentMapping> ongoingRows =
                studentAssessmentMappingRepository.findOngoingForAssessment(assessmentId);

        List<Map<String, Object>> out = new ArrayList<>();
        int expected = completionService.getTotalQuestions(assessmentId);

        // ── (a)/(b) completed rows ────────────────────────────────────────
        for (StudentAssessmentMapping m : completedRows) {
            Long studentId = m.getUserStudent() != null
                    ? m.getUserStudent().getUserStudentId() : null;
            Long aId = m.getAssessmentId();
            if (studentId == null || aId == null) continue;

            int dbCount = completionService.getAnsweredCount(studentId, aId);
            boolean redisPresent = assessmentSessionService.hasSubmittedAnswers(studentId, aId);

            // Filter out truly-done rows: persistenceState=persisted AND DB is
            // complete. Redis may still contain the archived payload — that's
            // fine, it's just a backup, doesn't need admin attention.
            boolean isFullyResolved =
                    "persisted".equals(m.getPersistenceState())
                            && (expected == 0 || dbCount >= expected);
            if (isFullyResolved) continue;

            Integer redisRawCount = null;
            Integer redisDistinctQuestionCount = null;
            Integer duplicatesDeduped = null;
            Integer skippedUnknown = null;
            String submitArchivedAt = null;
            if (redisPresent) {
                Map<String, Object> submitted = assessmentSessionService.getSubmittedAnswers(studentId, aId);
                if (submitted != null) {
                    Object ansObj = submitted.get("answers");
                    if (ansObj instanceof List) {
                        List<?> list = (List<?>) ansObj;
                        redisRawCount = list.size();
                        java.util.Set<Long> distinct = new java.util.HashSet<>();
                        for (Object a : list) {
                            if (a instanceof Map) {
                                Object q = ((Map<?, ?>) a).get("questionnaireQuestionId");
                                if (q instanceof Number) distinct.add(((Number) q).longValue());
                            }
                        }
                        redisDistinctQuestionCount = distinct.size();
                    }
                    Object dup = submitted.get("duplicatesDeduped");
                    if (dup instanceof Number) duplicatesDeduped = ((Number) dup).intValue();
                    Object skip = submitted.get("skippedUnknown");
                    if (skip instanceof Number) skippedUnknown = ((Number) skip).intValue();
                    Object ts = submitted.get("archivedAt");
                    if (ts instanceof String) submitArchivedAt = (String) ts;
                }
            }

            String diagnostic = classifyDiagnosticForCompleted(
                    m.getPersistenceState(),
                    redisPresent, redisDistinctQuestionCount,
                    dbCount, expected);
            String action = recommendedAction(diagnostic);
            // Override: persisted_incomplete can't be retried without Redis —
            // fall back to reset so the student can retake.
            if ("persisted_incomplete".equals(diagnostic) && !redisPresent) {
                action = "reset_assessment";
            }

            // Enrich with student info
            UserStudent us = m.getUserStudent();
            String studentName = null;
            String username = null;
            if (us != null && us.getStudentInfo() != null) {
                studentName = us.getStudentInfo().getName();
                if (us.getStudentInfo().getFamily() != null) {
                    studentName += " " + us.getStudentInfo().getFamily();
                }
                if (us.getStudentInfo().getUser() != null) {
                    username = us.getStudentInfo().getUser().getUsername();
                }
            }

            // Failure context (if any)
            Optional<AssessmentSubmissionFailure> failureOpt =
                    submissionFailureRepository.findByUserStudentIdAndAssessmentId(studentId, aId);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userStudentId", studentId);
            row.put("assessmentId", aId);
            row.put("studentName", studentName);
            row.put("username", username);
            row.put("status", m.getStatus());
            row.put("persistenceState", m.getPersistenceState());
            row.put("expectedCount", expected);
            row.put("dbAnswerCount", dbCount);
            row.put("redisPresent", redisPresent);
            row.put("redisAnswerCount", redisRawCount);
            row.put("redisDistinctQuestionCount", redisDistinctQuestionCount);
            row.put("duplicatesDeduped", duplicatesDeduped);
            row.put("skippedUnknown", skippedUnknown);
            row.put("submitArchivedAt", submitArchivedAt);
            row.put("diagnostic", diagnostic);
            row.put("recommendedAction", action);
            failureOpt.ifPresent(f -> {
                Map<String, Object> fmap = new LinkedHashMap<>();
                fmap.put("attemptCount", f.getAttemptCount());
                fmap.put("firstFailedAt", f.getFirstFailedAt());
                fmap.put("lastAttemptAt", f.getLastAttemptAt());
                fmap.put("nextRetryAt", f.getNextRetryAt());
                fmap.put("lastErrorClass", f.getLastErrorClass());
                fmap.put("lastErrorKind", f.getLastErrorKind());
                fmap.put("consecutiveNonTransientCount", f.getConsecutiveNonTransientCount());
                row.put("failure", fmap);
            });

            out.add(row);
        }

        // ── (c) stuck-ongoing rows ───────────────────────────────────────
        for (StudentAssessmentMapping m : ongoingRows) {
            Long studentId = m.getUserStudent() != null
                    ? m.getUserStudent().getUserStudentId() : null;
            Long aId = m.getAssessmentId();
            if (studentId == null || aId == null) continue;

            boolean redisSubmittedPresent = assessmentSessionService.hasSubmittedAnswers(studentId, aId);
            if (!redisSubmittedPresent) continue;   // no submit attempt — nothing stuck

            int dbCount = completionService.getAnsweredCount(studentId, aId);

            Integer redisRawCount = null;
            Integer redisDistinctQuestionCount = null;
            Map<String, Object> submitted = assessmentSessionService.getSubmittedAnswers(studentId, aId);
            if (submitted != null) {
                Object ansObj = submitted.get("answers");
                if (ansObj instanceof List) {
                    List<?> list = (List<?>) ansObj;
                    redisRawCount = list.size();
                    java.util.Set<Long> distinct = new java.util.HashSet<>();
                    for (Object a : list) {
                        if (a instanceof Map) {
                            Object q = ((Map<?, ?>) a).get("questionnaireQuestionId");
                            if (q instanceof Number) distinct.add(((Number) q).longValue());
                        }
                    }
                    redisDistinctQuestionCount = distinct.size();
                }
            }

            UserStudent us = m.getUserStudent();
            String studentName = null;
            String username = null;
            if (us != null && us.getStudentInfo() != null) {
                studentName = us.getStudentInfo().getName();
                if (us.getStudentInfo().getFamily() != null) {
                    studentName += " " + us.getStudentInfo().getFamily();
                }
                if (us.getStudentInfo().getUser() != null) {
                    username = us.getStudentInfo().getUser().getUsername();
                }
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userStudentId", studentId);
            row.put("assessmentId", aId);
            row.put("studentName", studentName);
            row.put("username", username);
            row.put("status", m.getStatus());
            row.put("persistenceState", m.getPersistenceState());
            row.put("expectedCount", expected);
            row.put("dbAnswerCount", dbCount);
            row.put("redisPresent", true);
            row.put("redisAnswerCount", redisRawCount);
            row.put("redisDistinctQuestionCount", redisDistinctQuestionCount);
            row.put("diagnostic", "stuck_ongoing");
            row.put("recommendedAction", "retry_now");
            out.add(row);
        }

        return ResponseEntity.ok(out);
    }

    /**
     * Classify a completed mapping's state. Considers persistenceState along
     * with Redis/DB counts so we can catch:
     *   - persisted_with_warnings: dedupe/unknown happened, mostly fine
     *   - persisted_incomplete: flagged persisted but DB &lt; expected (bug or legacy)
     */
    private static String classifyDiagnosticForCompleted(
            String persistenceState,
            boolean redisPresent,
            Integer redisDistinctQuestionCount,
            int dbCount,
            int expected) {
        boolean expectedKnown = expected > 0;
        boolean dbFull = expectedKnown && dbCount >= expected;
        boolean dbPartial = dbCount > 0 && (!expectedKnown || dbCount < expected);
        boolean dbEmpty = dbCount == 0;

        // Explicit handling for already-processed states with DB mismatches.
        if ("persisted".equals(persistenceState) && !dbFull && expectedKnown) {
            return "persisted_incomplete";
        }
        if ("persisted_with_warnings".equals(persistenceState)) {
            return dbFull ? "persisted_with_warnings" : "persisted_incomplete";
        }

        if (redisPresent) {
            boolean excess = redisDistinctQuestionCount != null
                    && expectedKnown
                    && redisDistinctQuestionCount > expected;
            if (excess) {
                if (dbFull) return "excess_already_persisted";
                if (dbEmpty) return "excess_pending";
                return "excess_partial_db";
            }
            if (dbFull) return "duplicate_cleanup_needed";
            if (dbEmpty) return "awaiting_processor";
            return "partial_inflight";
        }
        // Redis absent
        if (dbFull) return "reconcile_only";
        if (dbPartial) return "ghost_partial";
        return "ghost_empty";
    }

    private static String recommendedAction(String diagnostic) {
        switch (diagnostic) {
            case "awaiting_processor":
            case "partial_inflight":
            case "excess_pending":
            case "stuck_ongoing":
            case "persisted_incomplete":
                return "retry_now";
            case "duplicate_cleanup_needed":
            case "excess_already_persisted":
                return "cleanup_redis";
            case "excess_partial_db":
            case "ghost_partial":
            case "ghost_empty":
                return "reset_assessment";
            case "reconcile_only":
            case "persisted_with_warnings":
                return "reconcile";
            default:
                return "inspect";
        }
    }

    /**
     * Admin action: mark a mapping's persistenceState as "persisted" when the
     * DB already has the full answer set. Zero-destructive — used for the
     * reconcile_only diagnostic.
     */
    @PostMapping(value = "/reconcile")
    @javax.transaction.Transactional
    public ResponseEntity<?> reconcilePersisted(@RequestBody Map<String, Object> request) {
        Long userStudentId = asLong(request.get("userStudentId"));
        Long assessmentId = asLong(request.get("assessmentId"));
        if (userStudentId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Long adminUserId = asLong(request.get("adminUserId"));
        String reason = (String) request.get("reason");

        StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "StudentAssessmentMapping", "student/assessment",
                        userStudentId + "/" + assessmentId));

        // Safety check: don't mark persisted if DB doesn't actually have the data.
        // Exception: if the row is already `persisted_with_warnings`, admin is
        // explicitly acknowledging that some answers were skipped by the
        // processor (unknown question/option) — allow the flip.
        int expected = completionService.getTotalQuestions(assessmentId);
        int dbCount = completionService.getAnsweredCount(userStudentId, assessmentId);
        boolean isAcknowledgingWarnings =
                "persisted_with_warnings".equals(mapping.getPersistenceState());
        if (expected > 0 && dbCount < expected && !isAcknowledgingWarnings) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Cannot reconcile: DB has " + dbCount + " of " + expected + " answers",
                    "dbAnswerCount", dbCount,
                    "expectedCount", expected
            ));
        }

        String beforeState = String.format(
                "{\"status\":\"%s\",\"persistenceState\":\"%s\"}",
                mapping.getStatus(), mapping.getPersistenceState());

        mapping.setPersistenceState("persisted");
        studentAssessmentMappingRepository.save(mapping);

        // Resolve any failure row
        submissionFailureRepository.findByUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .ifPresent(row -> {
                    row.setResolved(true);
                    row.setResolvedAt(java.time.Instant.now());
                    row.setNextRetryAt(null);
                    submissionFailureRepository.save(row);
                });

        writeAudit("reconcile_persisted", userStudentId, assessmentId, adminUserId, reason,
                beforeState,
                String.format("{\"status\":\"%s\",\"persistenceState\":\"persisted\"}", mapping.getStatus()));

        return ResponseEntity.ok(Map.of("status", "reconciled"));
    }

    /**
     * Admin action: delete the Redis submitted: and partial: keys when the DB
     * already has the full answer set. Used for duplicate_cleanup_needed and
     * excess_already_persisted diagnostics. Also marks persistenceState=persisted.
     */
    @PostMapping(value = "/cleanup-redis")
    @javax.transaction.Transactional
    public ResponseEntity<?> cleanupRedis(@RequestBody Map<String, Object> request) {
        Long userStudentId = asLong(request.get("userStudentId"));
        Long assessmentId = asLong(request.get("assessmentId"));
        if (userStudentId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Long adminUserId = asLong(request.get("adminUserId"));
        String reason = (String) request.get("reason");

        StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "StudentAssessmentMapping", "student/assessment",
                        userStudentId + "/" + assessmentId));

        // Safety check — only allow cleanup when DB has the data
        int expected = completionService.getTotalQuestions(assessmentId);
        int dbCount = completionService.getAnsweredCount(userStudentId, assessmentId);
        if (expected > 0 && dbCount < expected) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Cannot cleanup: DB has " + dbCount + " of " + expected + " answers. Use reset instead.",
                    "dbAnswerCount", dbCount,
                    "expectedCount", expected
            ));
        }

        String beforeState = String.format(
                "{\"status\":\"%s\",\"persistenceState\":\"%s\"}",
                mapping.getStatus(), mapping.getPersistenceState());

        assessmentSessionService.deleteSubmittedAnswers(userStudentId, assessmentId);
        assessmentSessionService.deletePartialAnswers(userStudentId, assessmentId);
        assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);

        mapping.setPersistenceState("persisted");
        studentAssessmentMappingRepository.save(mapping);

        submissionFailureRepository.findByUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .ifPresent(row -> {
                    row.setResolved(true);
                    row.setResolvedAt(java.time.Instant.now());
                    row.setNextRetryAt(null);
                    submissionFailureRepository.save(row);
                });

        writeAudit("cleanup_redis", userStudentId, assessmentId, adminUserId, reason,
                beforeState,
                String.format("{\"status\":\"%s\",\"persistenceState\":\"persisted\"}", mapping.getStatus()));

        return ResponseEntity.ok(Map.of("status", "cleaned"));
    }

    /**
     * Admin action: force an immediate retry attempt, bypassing backoff.
     *
     * Also acts as the "finalize stuck-ongoing" path: if a student is stuck at
     * status=ongoing with a submitted: payload in Redis (their submit was
     * blocked for some reason), admin can use this to push them through. We
     * flip status=completed + persistenceState=pending to match what /submit
     * would have done, then dispatch the processor.
     */
    @PostMapping(value = "/retry-now")
    @javax.transaction.Transactional
    public ResponseEntity<?> retryNow(@RequestBody Map<String, Object> request) {
        Long userStudentId = asLong(request.get("userStudentId"));
        Long assessmentId = asLong(request.get("assessmentId"));
        if (userStudentId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Long adminUserId = asLong(request.get("adminUserId"));
        String reason = (String) request.get("reason");

        // Require that Redis actually holds the submitted: payload
        if (!assessmentSessionService.hasSubmittedAnswers(userStudentId, assessmentId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "No submitted: payload in Redis for this student/assessment",
                    "hint", "Use reset if this is a ghost row"
            ));
        }

        // Ensure mapping is in the right state for the processor. This is
        // idempotent for already-completed rows and rescues stuck-ongoing ones.
        StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElse(null);
        if (mapping != null) {
            mapping.setStatus("completed");
            mapping.setPersistenceState("pending");
            studentAssessmentMappingRepository.save(mapping);
        }

        // Clear any stale in-flight lock so dispatch isn't rejected by it
        assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);

        writeAudit("retry_now", userStudentId, assessmentId, adminUserId, reason, null, null);

        // Fire — processor handles its own lock + failure tracking
        submissionProcessorService.processSubmissionAsync(userStudentId, assessmentId);

        return ResponseEntity.accepted().body(Map.of("status", "dispatched"));
    }

    /**
     * Admin inspection: return the raw Redis submitted: payload for a
     * (student, assessment) pair. The payload is preserved for 7 days after
     * submit so admin can inspect what the student actually sent, including
     * any answers the processor had to skip (unknown optionId, unknown
     * questionId). Lets admin reconcile without forcing the student to retake.
     */
    @GetMapping(value = "/submitted-detail")
    public ResponseEntity<?> getSubmittedDetail(
            @RequestParam("userStudentId") Long userStudentId,
            @RequestParam("assessmentId") Long assessmentId) {
        Map<String, Object> data = assessmentSessionService.getSubmittedAnswers(userStudentId, assessmentId);
        if (data == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(data);
    }

    /**
     * View the full failure history and diagnostic context for a single row.
     * Used by the admin UI "View Errors" modal.
     */
    @GetMapping(value = "/submission-failure-detail")
    public ResponseEntity<?> getSubmissionFailureDetail(
            @RequestParam("userStudentId") Long userStudentId,
            @RequestParam("assessmentId") Long assessmentId) {
        Optional<AssessmentSubmissionFailure> failureOpt =
                submissionFailureRepository.findByUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        if (failureOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentSubmissionFailure f = failureOpt.get();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userStudentId", userStudentId);
        result.put("assessmentId", assessmentId);
        result.put("firstFailedAt", f.getFirstFailedAt());
        result.put("lastAttemptAt", f.getLastAttemptAt());
        result.put("nextRetryAt", f.getNextRetryAt());
        result.put("attemptCount", f.getAttemptCount());
        result.put("consecutiveNonTransientCount", f.getConsecutiveNonTransientCount());
        result.put("lastErrorClass", f.getLastErrorClass());
        result.put("lastErrorMessage", f.getLastErrorMessage());
        result.put("lastErrorKind", f.getLastErrorKind());
        result.put("resolved", f.getResolved());
        result.put("resolvedAt", f.getResolvedAt());
        return ResponseEntity.ok(result);
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private static Long asLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (NumberFormatException e) { return null; }
    }

    private void writeAudit(String actionType, Long userStudentId, Long assessmentId,
                            Long adminUserId, String reason,
                            String beforeStateJson, String afterStateJson) {
        try {
            AssessmentAdminAction audit = new AssessmentAdminAction();
            audit.setActionType(actionType);
            audit.setUserStudentId(userStudentId);
            audit.setAssessmentId(assessmentId);
            audit.setAdminUserId(adminUserId);
            audit.setActionAt(java.time.Instant.now());
            audit.setReason(reason);
            audit.setBeforeStateJson(beforeStateJson);
            audit.setAfterStateJson(afterStateJson);
            adminActionRepository.save(audit);
        } catch (Exception e) {
            logger.warn("Audit write failed for action={} student={} assessment={}",
                    actionType, userStudentId, assessmentId, e);
        }
    }
}
