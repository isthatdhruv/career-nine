package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.transaction.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse.*;
import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

@RestController
@RequestMapping("/assessment-answer")
public class AssessmentAnswerController {
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

    @GetMapping(value = "/getByStudent/{studentId}", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAssessmentAnswersByStudent(@PathVariable("studentId") Long studentId) {
        UserStudent userStudent = userStudentRepository.findById(studentId).orElse(null);
        return assessmentAnswerRepository.findByUserStudent(userStudent);
    }

    @GetMapping(value = "/getAll", headers = "Accept=application/json")
    public List<AssessmentAnswer> getAllAssessmentAnswers() {
        return assessmentAnswerRepository.findAll();
    }

    @Transactional
    @PostMapping(value = "/submit", headers = "Accept=application/json")
    public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
        try {
            // 1. Basic Extraction & Validation
            Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
            Long assessmentId = ((Number) submissionData.get("assessmentId")).longValue();

            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElseThrow(() -> new RuntimeException("UserStudent not found"));

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            // 2. Extract status if provided
            String status = submissionData.containsKey("status")
                    ? (String) submissionData.get("status")
                    : null;

            // 3. Manage Mapping with race condition fix
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
                // Race condition: another thread created the mapping between our find and save
                mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                        .orElseThrow(() -> new RuntimeException("Failed to create/find assessment mapping"));
            }

            // Update status if provided
            if (status != null) {
                mapping.setStatus(status);
                studentAssessmentMappingRepository.save(mapping);
            }

            List<Map<String, Object>> answers = (List<Map<String, Object>>) submissionData.get("answers");

            // 4. Pre-fetch all needed entities in bulk
            // Collect all questionnaireQuestion IDs and option IDs
            List<Long> questionIds = new ArrayList<>();
            List<Long> optionIds = new ArrayList<>();
            for (Map<String, Object> ansMap : answers) {
                questionIds.add(((Number) ansMap.get("questionnaireQuestionId")).longValue());
                if (ansMap.containsKey("optionId")) {
                    optionIds.add(((Number) ansMap.get("optionId")).longValue());
                }
            }

            // Bulk fetch questions
            Map<Long, QuestionnaireQuestion> questionCache = new HashMap<>();
            if (!questionIds.isEmpty()) {
                questionnaireQuestionRepository.findAllByIdIn(questionIds)
                        .forEach(qq -> questionCache.put(qq.getQuestionnaireQuestionId(), qq));
            }

            // Bulk fetch options
            Map<Long, AssessmentQuestionOptions> optionCache = new HashMap<>();
            if (!optionIds.isEmpty()) {
                assessmentQuestionOptionsRepository.findAllById(optionIds)
                        .forEach(opt -> optionCache.put(opt.getOptionId(), opt));
            }

            // Bulk fetch all option scores for the selected options
            Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId = new HashMap<>();
            if (!optionIds.isEmpty()) {
                List<OptionScoreBasedOnMEasuredQualityTypes> allScores = optionScoreRepository.findByOptionIdIn(optionIds);
                for (OptionScoreBasedOnMEasuredQualityTypes s : allScores) {
                    scoresByOptionId
                            .computeIfAbsent(s.getQuestion_option().getOptionId(), k -> new ArrayList<>())
                            .add(s);
                }
            }

            // 5. Process Answers in batch
            Map<Long, Integer> qualityTypeScores = new HashMap<>();
            Map<Long, MeasuredQualityTypes> qualityTypeCache = new HashMap<>();
            List<AssessmentAnswer> answersToSave = new ArrayList<>();

            for (Map<String, Object> ansMap : answers) {
                Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
                QuestionnaireQuestion question = questionCache.get(qId);

                // Check if this is a text-type answer
                String textResponse = ansMap.containsKey("textResponse")
                        ? (String) ansMap.get("textResponse")
                        : null;

                if (textResponse != null && question != null) {
                    // Check if this exact text was previously mapped for the same question
                    var previousMapping = assessmentAnswerRepository
                            .findFirstByQuestionnaireQuestion_QuestionnaireQuestionIdAndTextResponseAndMappedOptionIsNotNull(
                                    qId, textResponse);
                    if (previousMapping.isPresent()) {
                        AssessmentQuestionOptions mappedOpt = previousMapping.get().getMappedOption();
                        AssessmentAnswer ans = new AssessmentAnswer();
                        ans.setUserStudent(userStudent);
                        ans.setAssessment(assessment);
                        ans.setQuestionnaireQuestion(question);
                        ans.setOption(mappedOpt);
                        answersToSave.add(ans);

                        // Accumulate scores from the mapped option
                        List<OptionScoreBasedOnMEasuredQualityTypes> scores = scoresByOptionId
                                .getOrDefault(mappedOpt.getOptionId(), java.util.Collections.emptyList());
                        for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                            MeasuredQualityTypes type = s.getMeasuredQualityType();
                            Long typeId = type.getMeasuredQualityTypeId();
                            qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                            qualityTypeCache.putIfAbsent(typeId, type);
                        }
                    } else {
                        AssessmentAnswer ans = new AssessmentAnswer();
                        ans.setUserStudent(userStudent);
                        ans.setAssessment(assessment);
                        ans.setQuestionnaireQuestion(question);
                        ans.setTextResponse(textResponse);
                        answersToSave.add(ans);
                    }
                } else if (ansMap.containsKey("optionId")) {
                    Long oId = ((Number) ansMap.get("optionId")).longValue();
                    Integer rankOrder = ansMap.containsKey("rankOrder")
                            ? ((Number) ansMap.get("rankOrder")).intValue()
                            : null;

                    AssessmentQuestionOptions option = optionCache.get(oId);

                    if (question != null && option != null) {
                        AssessmentAnswer ans = new AssessmentAnswer();
                        ans.setUserStudent(userStudent);
                        ans.setAssessment(assessment);
                        ans.setQuestionnaireQuestion(question);
                        ans.setOption(option);

                        if (rankOrder != null) {
                            ans.setRankOrder(rankOrder);
                        }

                        answersToSave.add(ans);

                        // Accumulate Scores from bulk-fetched data
                        List<OptionScoreBasedOnMEasuredQualityTypes> scores = scoresByOptionId
                                .getOrDefault(oId, java.util.Collections.emptyList());
                        for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                            MeasuredQualityTypes type = s.getMeasuredQualityType();
                            Long typeId = type.getMeasuredQualityTypeId();
                            qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                            qualityTypeCache.putIfAbsent(typeId, type);
                        }
                    }
                }
            }

            // 6. Batch save all answers
            assessmentAnswerRepository.saveAll(answersToSave);

            // 7. Update Raw Scores (Delete old, Batch save new)
            assessmentRawScoreRepository
                    .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

            List<AssessmentRawScore> rawScoresToSave = new ArrayList<>();
            for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());

                AssessmentRawScore ars = new AssessmentRawScore();
                ars.setStudentAssessmentMapping(mapping);
                ars.setMeasuredQualityType(mqt);
                ars.setMeasuredQuality(mqt.getMeasuredQuality());
                ars.setRawScore(entry.getValue());

                rawScoresToSave.add(ars);
            }
            assessmentRawScoreRepository.saveAll(rawScoresToSave);

            return ResponseEntity.ok(Map.of("status", "success", "scoresSaved", rawScoresToSave.size()));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    // ============ OFFLINE ASSESSMENT UPLOAD ENDPOINTS ============

    /**
     * Returns question-header-to-options mapping for an assessment's questionnaire.
     * Used by the frontend to build the Excel template and parse uploaded data.
     */
    @GetMapping(value = "/offline-mapping/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getOfflineMapping(@PathVariable Long assessmentId) {
        try {
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

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
            result.put("questionnaireName", questionnaireName);
            result.put("questions", questions);
            result.put("sections", sections);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    /**
     * Bulk submit offline assessment answers for multiple students.
     * Supports re-upload: deletes old answers before saving new ones.
     */
    @Transactional
    @PostMapping(value = "/bulk-submit", headers = "Accept=application/json")
    public ResponseEntity<?> bulkSubmitAnswers(@RequestBody Map<String, Object> payload) {
        try {
            Long assessmentId = ((Number) payload.get("assessmentId")).longValue();

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            List<Map<String, Object>> students = (List<Map<String, Object>>) payload.get("students");
            int successCount = 0;
            List<Map<String, Object>> errors = new ArrayList<>();

            for (Map<String, Object> studentData : students) {
                Long userStudentId = ((Number) studentData.get("userStudentId")).longValue();

                try {
                    UserStudent userStudent = userStudentRepository.findById(userStudentId)
                            .orElseThrow(() -> new RuntimeException("UserStudent not found: " + userStudentId));

                    // Find or create mapping
                    StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                            .orElseGet(() -> {
                                StudentAssessmentMapping newMapping = new StudentAssessmentMapping();
                                newMapping.setUserStudent(userStudent);
                                newMapping.setAssessmentId(assessmentId);
                                return studentAssessmentMappingRepository.save(newMapping);
                            });

                    mapping.setStatus("completed");
                    studentAssessmentMappingRepository.save(mapping);

                    // Delete old answers for re-upload support
                    assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(
                            userStudentId, assessmentId);

                    // Delete old raw scores
                    assessmentRawScoreRepository
                            .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                    // Process answers
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
                            assessmentAnswerRepository.save(ans);

                            // Accumulate scores
                            List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                    .findByOptionId(oId);
                            for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                MeasuredQualityTypes type = s.getMeasuredQualityType();
                                Long typeId = type.getMeasuredQualityTypeId();
                                qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                                qualityTypeCache.putIfAbsent(typeId, type);
                            }
                        }
                    }

                    // Save raw scores
                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

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

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
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
            throw new RuntimeException("Multiple students matched by name at this institute. Provide DOB or phone to disambiguate.");
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
        try {
            Long assessmentId = ((Number) payload.get("assessmentId")).longValue();
            Integer instituteId = ((Number) payload.get("instituteId")).intValue();

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            InstituteDetail institute = instituteDetailRepository.findById(instituteId)
                    .orElseThrow(() -> new RuntimeException("Institute not found"));

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
                        throw new RuntimeException("Student name is required");
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

                    mapping.setStatus("completed");
                    studentAssessmentMappingRepository.save(mapping);

                    // Delete old answers for re-upload support
                    assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(
                            userStudentId, assessmentId);

                    // Delete old raw scores
                    assessmentRawScoreRepository
                            .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                    // Process answers
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
                                assessmentAnswerRepository.save(ans);

                                // Accumulate scores
                                List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                        .findByOptionId(oId);
                                for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                    MeasuredQualityTypes type = s.getMeasuredQualityType();
                                    Long typeId = type.getMeasuredQualityTypeId();
                                    qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                                    qualityTypeCache.putIfAbsent(typeId, type);
                                }
                            }
                        }
                    }

                    // Save raw scores
                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

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

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    // ============ BULK SUBMIT BY ROLL NUMBER ============

    /**
     * Bulk submit offline assessment answers matched by careerNineRollNumber.
     * Students must already exist. Each row has a rollNumber + answers.
     */
    @Transactional
    @PostMapping(value = "/bulk-submit-by-rollnumber", headers = "Accept=application/json")
    public ResponseEntity<?> bulkSubmitByRollNumber(@RequestBody Map<String, Object> payload) {
        try {
            Long assessmentId = ((Number) payload.get("assessmentId")).longValue();
            Integer instituteId = ((Number) payload.get("instituteId")).intValue();

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            InstituteDetail institute = instituteDetailRepository.findById(instituteId)
                    .orElseThrow(() -> new RuntimeException("Institute not found"));

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
                        throw new RuntimeException("Roll number is required");
                    }

                    // Find user by careerNineRollNumber
                    Optional<User> userOpt = userRepository.findByCareerNineRollNumber(rollNumber);
                    if (!userOpt.isPresent()) {
                        throw new RuntimeException("No student found with roll number: " + rollNumber);
                    }

                    User user = userOpt.get();

                    // Find StudentInfo for this user
                    StudentInfo studentInfo = studentInfoRepository.findByUser(user);
                    if (studentInfo == null) {
                        throw new RuntimeException("No student info found for roll number: " + rollNumber);
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

                    mapping.setStatus("completed");
                    studentAssessmentMappingRepository.save(mapping);

                    // Delete old answers for re-upload support
                    assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(
                            userStudentId, assessmentId);

                    // Delete old raw scores
                    assessmentRawScoreRepository
                            .deleteByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                    // Process answers
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
                                assessmentAnswerRepository.save(ans);

                                // Accumulate scores
                                List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                        .findByOptionId(oId);
                                for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                                    MeasuredQualityTypes type = s.getMeasuredQualityType();
                                    Long typeId = type.getMeasuredQualityTypeId();
                                    qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
                                    qualityTypeCache.putIfAbsent(typeId, type);
                                }
                            }
                        }
                    }

                    // Save raw scores
                    for (Map.Entry<Long, Integer> entry : qualityTypeScores.entrySet()) {
                        MeasuredQualityTypes mqt = qualityTypeCache.get(entry.getKey());
                        AssessmentRawScore ars = new AssessmentRawScore();
                        ars.setStudentAssessmentMapping(mapping);
                        ars.setMeasuredQualityType(mqt);
                        ars.setMeasuredQuality(mqt.getMeasuredQuality());
                        ars.setRawScore(entry.getValue());
                        assessmentRawScoreRepository.save(ars);
                    }

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

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    // ============ TEXT RESPONSE MAPPING ENDPOINTS ============

    /**
     * Get all text responses for a given assessment (for admin mapping page).
     */
    @GetMapping(value = "/text-responses/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getTextResponsesByAssessment(@PathVariable Long assessmentId) {
        try {
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
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    /**
     * Map a text response to an existing option.
     */
    @PutMapping(value = "/map-text-response", headers = "Accept=application/json")
    public ResponseEntity<?> mapTextResponse(@RequestBody Map<String, Object> requestData) {
        try {
            Long assessmentAnswerId = ((Number) requestData.get("assessmentAnswerId")).longValue();
            Long optionId = ((Number) requestData.get("optionId")).longValue();

            AssessmentAnswer answer = assessmentAnswerRepository.findById(assessmentAnswerId)
                    .orElseThrow(() -> new RuntimeException("AssessmentAnswer not found"));

            AssessmentQuestionOptions option = assessmentQuestionOptionsRepository.findById(optionId)
                    .orElseThrow(() -> new RuntimeException("Option not found"));

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
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    /**
     * Recalculate scores for all students in an assessment.
     * Processes both standard option-based answers and mapped text responses.
     */
    @Transactional
    @PostMapping(value = "/recalculate-scores/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> recalculateScores(@PathVariable Long assessmentId) {
        try {
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            // Get all mappings for this assessment
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findAllByAssessmentId(assessmentId);

            int studentsProcessed = 0;

            for (StudentAssessmentMapping mapping : mappings) {
                Long userStudentId = mapping.getUserStudent().getUserStudentId();

                // Get all answers for this student + assessment
                List<AssessmentAnswer> answers = assessmentAnswerRepository
                        .findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);

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
                        List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository
                                .findByOptionId(scoringOption.getOptionId());
                        for (OptionScoreBasedOnMEasuredQualityTypes s : scores) {
                            MeasuredQualityTypes type = s.getMeasuredQualityType();
                            Long typeId = type.getMeasuredQualityTypeId();
                            qualityTypeScores.merge(typeId, s.getScore(), Integer::sum);
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
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
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
    @PostMapping(value = "/dashboard", headers = "Accept=application/json")
    public ResponseEntity<?> getStudentDashboard(@RequestBody Map<String, Object> requestData) {
        try {
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
                    .orElseThrow(() -> new RuntimeException("UserStudent not found with ID: " + userStudentId));

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

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch student dashboard data",
                "message", e.getMessage()
            ));
        }
    }
}
