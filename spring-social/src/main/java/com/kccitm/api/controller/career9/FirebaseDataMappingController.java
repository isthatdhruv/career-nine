package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.FirebaseDataMapping;
import com.kccitm.api.model.career9.school.FirebaseQuestionMapping;
import com.kccitm.api.model.career9.school.FirebaseStudentExtraData;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.School.FirebaseDataMappingRepository;
import com.kccitm.api.repository.Career9.School.FirebaseQuestionMappingRepository;
import com.kccitm.api.repository.Career9.School.FirebaseStudentExtraDataRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.FirebaseService;
import com.kccitm.api.service.FirebaseStudentDeletionService;

@RestController
@RequestMapping("/firebase-mapping")
public class FirebaseDataMappingController {

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private FirebaseDataMappingRepository firebaseDataMappingRepository;

    @Autowired
    private FirebaseStudentExtraDataRepository firebaseStudentExtraDataRepository;

    @Autowired
    private FirebaseService firebaseService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;

    @Autowired
    private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private FirebaseQuestionMappingRepository firebaseQuestionMappingRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.BetReportDataRepository betReportDataRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.NavigatorReportDataRepository navigatorReportDataRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.GeneralAssessmentResultRepository generalAssessmentResultRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.StudentDemographicResponseRepository studentDemographicResponseRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository assessmentProctoringQuestionLogRepository;

    @Autowired
    private com.kccitm.api.repository.StudentContactAssignmentRepository studentContactAssignmentRepository;

    @Autowired
    private FirebaseStudentDeletionService firebaseStudentDeletionService;

    @GetMapping("/getAll")
    public List<FirebaseDataMapping> getAll() {
        return firebaseDataMappingRepository.findAll();
    }

    @GetMapping("/getByType/{type}")
    public List<FirebaseDataMapping> getByType(@PathVariable("type") String type) {
        return firebaseDataMappingRepository.findByFirebaseType(type.toUpperCase());
    }

    @GetMapping("/getByParent/{parentId}")
    public List<FirebaseDataMapping> getByParent(@PathVariable("parentId") Long parentId) {
        return firebaseDataMappingRepository.findByParentMappingId(parentId);
    }

    @GetMapping("/students-by-institute/{instituteCode}")
    public ResponseEntity<?> getStudentsByInstitute(@PathVariable("instituteCode") Integer instituteCode) {
        List<UserStudent> students = userStudentRepository.findByInstituteInstituteCode(instituteCode);
        List<Map<String, Object>> result = new ArrayList<>();
        for (UserStudent us : students) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("userStudentId", us.getUserStudentId());
            map.put("name", us.getStudentInfo() != null ? us.getStudentInfo().getName() : "");
            map.put("email", us.getStudentInfo() != null ? us.getStudentInfo().getEmail() : "");
            map.put("phone", us.getStudentInfo() != null ? us.getStudentInfo().getPhoneNumber() : "");
            map.put("grade", us.getStudentInfo() != null ? us.getStudentInfo().getStudentClass() : "");

            // Find firebase docId from STUDENT mapping
            List<FirebaseDataMapping> studentMappings = firebaseDataMappingRepository.findByFirebaseType("STUDENT");
            String firebaseDocId = null;
            for (FirebaseDataMapping m : studentMappings) {
                if (m.getNewEntityId() != null && m.getNewEntityId().equals(Long.valueOf(us.getUserStudentId()))) {
                    firebaseDocId = m.getFirebaseId();
                    break;
                }
            }
            map.put("firebaseDocId", firebaseDocId);

            // Find assessment mappings for this student
            List<StudentAssessmentMapping> samList = studentAssessmentMappingRepository.findByUserStudentUserStudentId(us.getUserStudentId());
            List<Map<String, Object>> assessmentMappings = new ArrayList<>();
            for (StudentAssessmentMapping sam : samList) {
                Map<String, Object> amMap = new LinkedHashMap<>();
                amMap.put("assessmentId", sam.getAssessmentId());
                amMap.put("status", sam.getStatus());
                assessmentMappings.add(amMap);
            }
            map.put("assessmentMappings", assessmentMappings);

            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @Transactional
    @PostMapping("/import-mapped-answers")
    public ResponseEntity<?> importMappedAnswers(@RequestBody Map<String, Object> payload) {
        Long userStudentId = getLong(payload, "userStudentId");
            Long assessmentId = getLong(payload, "assessmentId");

            if (userStudentId == null || assessmentId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "userStudentId and assessmentId are required"));
            }

            Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
            if (!usOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "UserStudent not found: " + userStudentId));
            }
            UserStudent userStudent = usOpt.get();

            Optional<AssessmentTable> atOpt = assessmentTableRepository.findById(assessmentId);
            if (!atOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Assessment not found: " + assessmentId));
            }
            AssessmentTable assessment = atOpt.get();

            // Find or create StudentAssessmentMapping
            Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
            StudentAssessmentMapping sam;
            if (samOpt.isPresent()) {
                sam = samOpt.get();
            } else {
                sam = new StudentAssessmentMapping();
                sam.setUserStudent(userStudent);
                sam.setAssessmentId(assessmentId);
                sam.setStatus("ongoing");
                sam = studentAssessmentMappingRepository.save(sam);
            }

            // Delete existing answers and raw scores for this student + assessment
            assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);
            assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(sam.getStudentAssessmentId());

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> answers = (List<Map<String, Object>>) payload.get("answers");
            if (answers == null || answers.isEmpty()) {
                sam.setStatus("ongoing");
                studentAssessmentMappingRepository.save(sam);
                return ResponseEntity.ok(Map.of("saved", 0, "scoresCalculated", 0, "status", "ongoing", "message", "No answers to save, status set to ongoing"));
            }

            // Get questionnaire ID scoped to this assessment
            final Long questionnaireId = (assessment.getQuestionnaire() != null)
                    ? assessment.getQuestionnaire().getQuestionnaireId() : null;

            // Pre-load all referenced options and QQ mappings in bulk to avoid N+1 queries
            Set<Long> allOptionIds = new LinkedHashSet<>();
            Set<Long> allQuestionIds = new LinkedHashSet<>();
            for (Map<String, Object> ans : answers) {
                Long optionId = getLong(ans, "optionId");
                Long questionId = getLong(ans, "questionId");
                if (optionId != null) allOptionIds.add(optionId);
                if (questionId != null) allQuestionIds.add(questionId);
            }

            // Bulk load options
            Map<Long, AssessmentQuestionOptions> optionCache = new LinkedHashMap<>();
            if (!allOptionIds.isEmpty()) {
                assessmentQuestionOptionsRepository.findAllById(allOptionIds)
                    .forEach(o -> optionCache.put(o.getOptionId(), o));
            }

            // Bulk load QQ mappings for this questionnaire
            Map<Long, QuestionnaireQuestion> qqCache = new LinkedHashMap<>();
            if (questionnaireId != null && !allQuestionIds.isEmpty()) {
                for (Long qId : allQuestionIds) {
                    List<QuestionnaireQuestion> qqList = questionnaireQuestionRepository.findByQuestionIdAndQuestionnaireId(qId, questionnaireId);
                    if (!qqList.isEmpty()) qqCache.put(qId, qqList.get(0));
                }
            }
            // Also cache QQ by parent question ID from options
            for (AssessmentQuestionOptions opt : optionCache.values()) {
                if (opt.getQuestion() != null) {
                    Long parentQId = opt.getQuestion().getQuestionId();
                    if (!qqCache.containsKey(parentQId) && questionnaireId != null) {
                        List<QuestionnaireQuestion> qqList = questionnaireQuestionRepository.findByQuestionIdAndQuestionnaireId(parentQId, questionnaireId);
                        if (!qqList.isEmpty()) qqCache.put(parentQId, qqList.get(0));
                    }
                }
            }

            // Bulk load option scores
            Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoreCache = new LinkedHashMap<>();
            if (!allOptionIds.isEmpty()) {
                for (Long optId : allOptionIds) {
                    scoreCache.put(optId, optionScoreRepository.findByOptionId(optId));
                }
            }

            // Accumulate scores per MeasuredQualityType
            Map<Long, Integer> scoreAccumulator = new LinkedHashMap<>();
            Map<Long, MeasuredQualityTypes> mqtCache = new LinkedHashMap<>();

            List<AssessmentAnswer> answerBatch = new ArrayList<>(answers.size());
            Set<Long> uniqueQuestionsAnswered = new LinkedHashSet<>();

            for (Map<String, Object> ans : answers) {
                Long optionId = getLong(ans, "optionId");
                Long questionId = getLong(ans, "questionId");
                String textResponse = (String) ans.get("textResponse");

                AssessmentAnswer answer = new AssessmentAnswer();
                answer.setUserStudent(userStudent);
                answer.setAssessment(assessment);
                answer.setTextResponse(textResponse);

                if (optionId != null) {
                    AssessmentQuestionOptions opt = optionCache.get(optionId);
                    if (opt != null) {
                        answer.setOption(opt);

                        // Set QQ from cache
                        QuestionnaireQuestion qq = (questionId != null) ? qqCache.get(questionId) : null;
                        if (qq == null && opt.getQuestion() != null) {
                            qq = qqCache.get(opt.getQuestion().getQuestionId());
                        }
                        if (qq != null) answer.setQuestionnaireQuestion(qq);

                        // Accumulate scores from cache
                        List<OptionScoreBasedOnMEasuredQualityTypes> optionScores = scoreCache.getOrDefault(optionId, new ArrayList<>());
                        for (OptionScoreBasedOnMEasuredQualityTypes os : optionScores) {
                            if (os.getMeasuredQualityType() != null && os.getScore() != null) {
                                Long mqtId = os.getMeasuredQualityType().getMeasuredQualityTypeId();
                                scoreAccumulator.merge(mqtId, os.getScore(), Integer::sum);
                                mqtCache.putIfAbsent(mqtId, os.getMeasuredQualityType());
                            }
                        }
                    }
                } else if (questionId != null) {
                    QuestionnaireQuestion qq = qqCache.get(questionId);
                    if (qq != null) answer.setQuestionnaireQuestion(qq);
                }

                answerBatch.add(answer);
                if (questionId != null) {
                    uniqueQuestionsAnswered.add(questionId);
                }
            }

            // Batch save all answers
            assessmentAnswerRepository.saveAll(answerBatch);
            int saved = answerBatch.size();

            // Batch save accumulated raw scores
            List<AssessmentRawScore> scoreBatch = new ArrayList<>();
            for (Map.Entry<Long, Integer> entry : scoreAccumulator.entrySet()) {
                Long mqtId = entry.getKey();
                Integer totalScore = entry.getValue();
                MeasuredQualityTypes mqt = mqtCache.get(mqtId);

                if (mqt != null) {
                    AssessmentRawScore rawScore = new AssessmentRawScore();
                    rawScore.setStudentAssessmentMapping(sam);
                    rawScore.setMeasuredQualityType(mqt);
                    rawScore.setMeasuredQuality(mqt.getMeasuredQuality());
                    rawScore.setRawScore(totalScore);
                    scoreBatch.add(rawScore);
                }
            }
            if (!scoreBatch.isEmpty()) {
                assessmentRawScoreRepository.saveAll(scoreBatch);
            }
            int scoresCalculated = scoreBatch.size();

            // Determine completeness
            String status = "ongoing";
            int questionsAnswered = uniqueQuestionsAnswered.size();
            Long totalMappedFromPayload = getLong(payload, "totalMappedQuestions");
            int totalMappedQuestions = (totalMappedFromPayload != null)
                    ? totalMappedFromPayload.intValue()
                    : uniqueQuestionsAnswered.size();

            if (totalMappedQuestions > 0 && questionsAnswered >= totalMappedQuestions) {
                status = "completed";
            }

            sam.setStatus(status);
            studentAssessmentMappingRepository.save(sam);

            return ResponseEntity.ok(Map.of(
                "saved", saved,
                "questionsAnswered", questionsAnswered,
                "scoresCalculated", scoresCalculated,
                "totalMappedQuestions", totalMappedQuestions,
                "status", status,
                "message", questionsAnswered >= totalMappedQuestions
                    ? "Answers imported and scores calculated successfully"
                    : "Partial answers imported (" + questionsAnswered + "/" + totalMappedQuestions + " questions), status set to ongoing"
            ));
    }

    @Transactional
    @PostMapping("/force-complete-status")
    public ResponseEntity<?> forceCompleteStatus(@RequestBody List<Map<String, Object>> payload) {
        int updated = 0;
        for (Map<String, Object> item : payload) {
            Long userStudentId = getLong(item, "userStudentId");
            Long assessmentId = getLong(item, "assessmentId");
            if (userStudentId == null || assessmentId == null) continue;

            Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
            if (samOpt.isPresent()) {
                StudentAssessmentMapping sam = samOpt.get();
                sam.setStatus("completed");
                studentAssessmentMappingRepository.save(sam);
                updated++;
            }
        }
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteMapping(@PathVariable("id") Long id) {
        Optional<FirebaseDataMapping> opt = firebaseDataMappingRepository.findById(id);
        if (!opt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        // Delete child mappings (sessions, grades, sections that reference this as parent)
        List<FirebaseDataMapping> children = firebaseDataMappingRepository.findByParentMappingId(id);
        if (!children.isEmpty()) {
            // Also delete grandchildren (children of children)
            for (FirebaseDataMapping child : children) {
                List<FirebaseDataMapping> grandchildren = firebaseDataMappingRepository.findByParentMappingId(child.getId());
                if (!grandchildren.isEmpty()) {
                    firebaseDataMappingRepository.deleteAll(grandchildren);
                }
            }
            firebaseDataMappingRepository.deleteAll(children);
        }
        firebaseDataMappingRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/deleteByFirebaseNameAndType")
    public ResponseEntity<?> deleteByFirebaseNameAndType(
            @RequestParam("firebaseName") String firebaseName,
            @RequestParam("type") String type) {
        List<FirebaseDataMapping> all = firebaseDataMappingRepository.findByFirebaseType(type.toUpperCase());
        List<FirebaseDataMapping> matching = new java.util.ArrayList<>();
        for (FirebaseDataMapping m : all) {
            if (m.getFirebaseName() != null && m.getFirebaseName().equalsIgnoreCase(firebaseName)) {
                matching.add(m);
            }
            if (m.getFirebaseId() != null && m.getFirebaseId().equalsIgnoreCase(firebaseName)) {
                matching.add(m);
            }
        }
        // Delete children of each matching mapping
        for (FirebaseDataMapping m : matching) {
            List<FirebaseDataMapping> children = firebaseDataMappingRepository.findByParentMappingId(m.getId());
            for (FirebaseDataMapping child : children) {
                List<FirebaseDataMapping> grandchildren = firebaseDataMappingRepository.findByParentMappingId(child.getId());
                if (!grandchildren.isEmpty()) {
                    firebaseDataMappingRepository.deleteAll(grandchildren);
                }
            }
            if (!children.isEmpty()) {
                firebaseDataMappingRepository.deleteAll(children);
            }
        }
        firebaseDataMappingRepository.deleteAll(matching);
        return ResponseEntity.ok().body(matching.size() + " mapping(s) deleted");
    }

    @PostMapping("/save")
    public ResponseEntity<FirebaseDataMapping> save(@RequestBody FirebaseDataMapping mapping) {
        // Normalize firebaseType to uppercase
        if (mapping.getFirebaseType() != null) {
            mapping.setFirebaseType(mapping.getFirebaseType().toUpperCase());
        }
        FirebaseDataMapping saved = firebaseDataMappingRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/save-batch")
    public ResponseEntity<List<FirebaseDataMapping>> saveBatch(@RequestBody List<FirebaseDataMapping> mappings) {
        for (FirebaseDataMapping m : mappings) {
            if (m.getFirebaseType() != null) {
                m.setFirebaseType(m.getFirebaseType().toUpperCase());
            }
        }
        List<FirebaseDataMapping> saved = firebaseDataMappingRepository.saveAll(mappings);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/check/{firebaseId}/{type}")
    public ResponseEntity<FirebaseDataMapping> checkMapping(
            @PathVariable("firebaseId") String firebaseId,
            @PathVariable("type") String type) {
        Optional<FirebaseDataMapping> existing =
            firebaseDataMappingRepository.findByFirebaseIdAndFirebaseType(firebaseId, type.toUpperCase());
        return existing.map(ResponseEntity::ok)
                       .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Fetches all student documents from Firestore "Users" collection,
     * extracts unique school/session/grade/section values, and returns
     * a grouped hierarchy ready for the mapping wizard.
     *
     * Each student document has an "educational" map with fields:
     *   school (String), studentClass (String), session (String, optional), section (String, optional)
     *
     * Returns structure:
     * [
     *   {
     *     "id": "Harvest public school",   // used as firebaseId
     *     "name": "Harvest public school",
     *     "sessions": [
     *       {
     *         "id": "2024-25",
     *         "year": "2024-25",
     *         "grades": [
     *           {
     *             "id": "Harvest public school__2024-25__10",
     *             "name": "10",
     *             "sections": [
     *               { "id": "Harvest public school__2024-25__10__A", "name": "A" }
     *             ]
     *           }
     *         ]
     *       }
     *     ]
     *   }
     * ]
     */
    @GetMapping("/fetch-school-data")
    public ResponseEntity<?> fetchSchoolData(@RequestParam(value = "tenant", required = false) String tenant) {
        try {
            // Collection is "users" (lowercase) — confirmed from Firebase console
            List<Map<String, Object>> users = firebaseService.getAllDocuments("users");
            if (users.isEmpty()) {
                // Fallback: try capitalized
                users = firebaseService.getAllDocuments("Users");
            }

            // Filter by tenant if provided
            if (tenant != null && !tenant.trim().isEmpty()) {
                String tenantLower = tenant.trim().toLowerCase();
                users.removeIf(user -> {
                    Object t = user.get("tenant");
                    return t == null || !t.toString().trim().toLowerCase().equals(tenantLower);
                });
            }

            // school -> session -> grade -> sections
            // Keys are normalized to lowercase for case-insensitive grouping
            // Display names preserve the first-seen casing
            Map<String, Map<String, Map<String, Set<String>>>> grouped = new LinkedHashMap<>();
            // Track first-seen display names for each normalized key
            Map<String, String> displayNames = new LinkedHashMap<>();

            for (Map<String, Object> user : users) {
                Object eduObj = user.get("educational");
                if (!(eduObj instanceof Map)) continue;

                @SuppressWarnings("unchecked")
                Map<String, Object> edu = (Map<String, Object>) eduObj;

                String school = getString(edu, "school");
                if (school == null || school.trim().isEmpty()) continue;
                school = school.trim();
                String schoolKey = school.toLowerCase();
                displayNames.putIfAbsent(schoolKey, school);

                // Derive academic session from createdAt timestamp
                // Indian academic year: Apr-Dec → "year-(year+1)", Jan-Mar → "(year-1)-year"
                String session = deriveAcademicSession(user.get("createdAt"));
                String sessionKey = session.toLowerCase();
                displayNames.putIfAbsent(schoolKey + "__" + sessionKey, session);

                String grade = getString(edu, "studentClass");
                if (grade == null || grade.trim().isEmpty()) grade = "Unknown Class";
                else grade = grade.trim();
                String gradeKey = grade.toLowerCase();
                displayNames.putIfAbsent(schoolKey + "__" + sessionKey + "__" + gradeKey, grade);

                String section = getString(edu, "section");
                if (section == null || section.trim().isEmpty()) section = "Unknown Section";
                else section = section.trim();
                String sectionKey = section.toLowerCase();
                displayNames.putIfAbsent(schoolKey + "__" + sessionKey + "__" + gradeKey + "__" + sectionKey, section);

                grouped
                    .computeIfAbsent(schoolKey, k -> new LinkedHashMap<>())
                    .computeIfAbsent(sessionKey, k -> new LinkedHashMap<>())
                    .computeIfAbsent(gradeKey, k -> new LinkedHashSet<>())
                    .add(sectionKey);
            }

            // Convert to list structure expected by frontend wizard
            // Keys are lowercase; display names come from displayNames map
            List<Map<String, Object>> result = new ArrayList<>();
            for (Map.Entry<String, Map<String, Map<String, Set<String>>>> schoolEntry : grouped.entrySet()) {
                String schoolKey = schoolEntry.getKey();
                String schoolName = displayNames.getOrDefault(schoolKey, schoolKey);
                List<Map<String, Object>> sessionList = new ArrayList<>();

                for (Map.Entry<String, Map<String, Set<String>>> sessionEntry : schoolEntry.getValue().entrySet()) {
                    String sessionKey = sessionEntry.getKey();
                    String sessionYear = displayNames.getOrDefault(schoolKey + "__" + sessionKey, sessionKey);
                    List<Map<String, Object>> gradeList = new ArrayList<>();

                    for (Map.Entry<String, Set<String>> gradeEntry : sessionEntry.getValue().entrySet()) {
                        String gradeKey = gradeEntry.getKey();
                        String gradeName = displayNames.getOrDefault(schoolKey + "__" + sessionKey + "__" + gradeKey, gradeKey);
                        List<Map<String, Object>> sectionList = new ArrayList<>();

                        for (String sectionKey : gradeEntry.getValue()) {
                            String sectionName = displayNames.getOrDefault(schoolKey + "__" + sessionKey + "__" + gradeKey + "__" + sectionKey, sectionKey);
                            Map<String, Object> sectionMap = new LinkedHashMap<>();
                            sectionMap.put("id", schoolKey + "__" + sessionKey + "__" + gradeKey + "__" + sectionKey);
                            sectionMap.put("name", sectionName);
                            sectionList.add(sectionMap);
                        }

                        Map<String, Object> gradeMap = new LinkedHashMap<>();
                        gradeMap.put("id", schoolKey + "__" + sessionKey + "__" + gradeKey);
                        gradeMap.put("name", gradeName);
                        gradeMap.put("sections", sectionList);
                        gradeList.add(gradeMap);
                    }

                    Map<String, Object> sessionMap = new LinkedHashMap<>();
                    sessionMap.put("id", schoolKey + "__" + sessionKey);
                    sessionMap.put("year", sessionYear);
                    sessionMap.put("grades", gradeList);
                    sessionList.add(sessionMap);
                }

                Map<String, Object> schoolMap = new LinkedHashMap<>();
                schoolMap.put("id", schoolKey);
                schoolMap.put("name", schoolName);
                schoolMap.put("sessions", sessionList);
                result.add(schoolMap);
            }

            // Wrap with metadata for debugging
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("rawUserCount", users.size());
            response.put("schools", result);
            return ResponseEntity.ok(response);

        } catch (ExecutionException | InterruptedException | TimeoutException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to fetch data from Firebase: " + e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Firebase is not initialized. Please check server configuration.");
        }
    }

    // ========================== DELETE FIREBASE-IMPORTED STUDENTS ==========================

    /**
     * DELETE /firebase-mapping/delete-firebase-students/{instituteCode}
     *
     * Deletes all students imported from Firebase for a given institute.
     * Cleans up all related data: answers, scores, mappings, reports, etc.
     */
    @DeleteMapping("/delete-firebase-students/{instituteCode}")
    @Transactional
    public ResponseEntity<?> deleteFirebaseStudents(
            @PathVariable Integer instituteCode,
            @RequestParam(value = "forceAll", defaultValue = "false") boolean forceAll) {
        try {
            // 1. Get all UserStudents for this institute
            List<UserStudent> allStudents = userStudentRepository.findByInstituteInstituteCode(instituteCode);
            if (allStudents.isEmpty()) {
                return ResponseEntity.ok(Map.of("deleted", 0, "message", "No students found for this institute"));
            }

            // 2. Filter to Firebase-imported students OR all students if forceAll
            List<UserStudent> targetStudents;
            if (forceAll) {
                // Delete ALL students for this institute (handles orphans from failed previous deletes)
                targetStudents = allStudents;
            } else {
                targetStudents = new ArrayList<>();
                for (UserStudent us : allStudents) {
                    Optional<FirebaseDataMapping> mapping = firebaseDataMappingRepository
                            .findByNewEntityIdAndFirebaseType(us.getUserStudentId(), "STUDENT");
                    if (mapping.isPresent()) {
                        targetStudents.add(us);
                    }
                }
            }

            if (targetStudents.isEmpty()) {
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("deleted", 0);
                resp.put("remainingStudents", allStudents.size());
                resp.put("message", allStudents.isEmpty()
                        ? "No students found for this institute"
                        : "No Firebase-imported students found, but " + allStudents.size() + " students still exist in this institute.");
                return ResponseEntity.ok(resp);
            }

            // 3. Collect all IDs for bulk operations
            List<Long> userStudentIds = new ArrayList<>();
            List<Long> userIds = new ArrayList<>();
            List<Integer> studentInfoIds = new ArrayList<>();

            for (UserStudent us : targetStudents) {
                userStudentIds.add(us.getUserStudentId());
                if (us.getUserId() != null) userIds.add(us.getUserId());
                if (us.getStudentInfo() != null) studentInfoIds.add(us.getStudentInfo().getId());
            }

            // 4. Get all StudentAssessmentMapping IDs for these students (needed for raw scores)
            List<Long> samIds = entityManager.createQuery(
                    "SELECT sam.studentAssessmentId FROM StudentAssessmentMapping sam WHERE sam.userStudent.userStudentId IN :ids", Long.class)
                    .setParameter("ids", userStudentIds)
                    .getResultList();

            // 5. Disable FK checks, bulk delete all related tables, re-enable FK checks.
            //    This handles known tables AND legacy/orphan tables (e.g. generated_report)
            //    that may have FK constraints to user_student but no JPA entity.
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();

            try {
                // Child tables referencing user_student_id
                entityManager.createNativeQuery("DELETE FROM bet_report_data WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM navigator_report_data WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM general_assessment_result WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM generated_report WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();

                // Assessment raw scores (FK to student_assessment_mapping)
                if (!samIds.isEmpty()) {
                    entityManager.createNativeQuery("DELETE FROM assessment_raw_score WHERE student_assessment_id IN :ids")
                            .setParameter("ids", samIds).executeUpdate();
                }

                entityManager.createNativeQuery("DELETE FROM assessment_answer WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM student_assessment_mapping WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM assessment_proctoring_question_log WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM student_demographic_response WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM student_contact_assignment WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM firebase_student_extra_data WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();

                // Firebase mapping
                entityManager.createNativeQuery("DELETE FROM firebase_data_mapping WHERE new_entity_id IN :ids AND firebase_type = 'STUDENT'")
                        .setParameter("ids", userStudentIds).executeUpdate();

                // Core records
                entityManager.createNativeQuery("DELETE FROM user_student WHERE user_student_id IN :ids")
                        .setParameter("ids", userStudentIds).executeUpdate();
                if (!studentInfoIds.isEmpty()) {
                    entityManager.createNativeQuery("DELETE FROM student_info WHERE id IN :ids")
                            .setParameter("ids", studentInfoIds).executeUpdate();
                }
                if (!userIds.isEmpty()) {
                    entityManager.createNativeQuery("DELETE FROM student_user WHERE id IN :ids")
                            .setParameter("ids", userIds).executeUpdate();
                }
            } finally {
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("deleted", targetStudents.size());
            response.put("total", targetStudents.size());
            response.put("errors", new ArrayList<>());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete students: " + e.getMessage()));
        }
    }

    // ========================== PHASE 2-4: STUDENT DATA IMPORT ==========================

    /**
     * Fetches ALL user documents from Firestore with full data (personal, educational,
     * assessment responses, scores, etc.) for the student import wizard.
     */
    @GetMapping("/fetch-user-data")
    public ResponseEntity<?> fetchUserData(@RequestParam(value = "tenant", required = false) String tenant) {
        try {
            List<Map<String, Object>> users = firebaseService.getAllDocuments("users");
            if (users.isEmpty()) {
                users = firebaseService.getAllDocuments("Users");
            }

            // Filter by tenant if provided
            if (tenant != null && !tenant.trim().isEmpty()) {
                String tenantLower = tenant.trim().toLowerCase();
                users.removeIf(user -> {
                    Object t = user.get("tenant");
                    return t == null || !t.toString().trim().toLowerCase().equals(tenantLower);
                });
            }

            List<Map<String, Object>> result = new ArrayList<>();
            for (Map<String, Object> user : users) {
                Map<String, Object> userMap = new LinkedHashMap<>();

                // Document ID (set by FirebaseService.getAllDocuments as "id")
                userMap.put("docId", user.get("id"));

                // Personal data
                Object personalObj = user.get("personal");
                if (personalObj instanceof Map) {
                    userMap.put("personal", personalObj);
                }

                // Educational data
                Object eduObj = user.get("educational");
                if (eduObj instanceof Map) {
                    userMap.put("educational", eduObj);
                }

                // Assessment scores
                userMap.put("abilityScores", user.get("abilityScores"));
                userMap.put("multipleIntelligenceScores", user.get("multipleIntelligenceScores"));
                userMap.put("personalityScores", user.get("personalityScores"));

                // Detailed responses
                userMap.put("abilityDetailedResponses", user.get("abilityDetailedResponses"));
                userMap.put("multipleIntelligenceResponses", user.get("multipleIntelligenceResponses"));
                userMap.put("personalityDetailedResponses", user.get("personalityDetailedResponses"));

                // Additional data
                userMap.put("careerAspirations", user.get("careerAspirations"));
                userMap.put("subjectsOfInterest", user.get("subjectsOfInterest"));
                userMap.put("values", user.get("values"));

                // Metadata
                userMap.put("createdAt", user.get("createdAt"));
                userMap.put("tenant", user.get("tenant"));

                result.add(userMap);
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("totalUsers", result.size());
            response.put("users", result);
            return ResponseEntity.ok(response);

        } catch (ExecutionException | InterruptedException | TimeoutException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to fetch user data from Firebase: " + e.getMessage());
        }
    }

    /**
     * Extracts unique questions from Firebase user responses across all users.
     * Groups them by assessment type (ability, MI, personality).
     */
    @GetMapping("/fetch-unique-questions")
    public ResponseEntity<?> fetchUniqueQuestions(@RequestParam(value = "tenant", required = false) String tenant) {
        try {
            List<Map<String, Object>> users = firebaseService.getAllDocuments("users");
            if (users.isEmpty()) {
                users = firebaseService.getAllDocuments("Users");
            }

            // Filter by tenant if provided
            if (tenant != null && !tenant.trim().isEmpty()) {
                String tenantLower = tenant.trim().toLowerCase();
                users.removeIf(user -> {
                    Object t = user.get("tenant");
                    return t == null || !t.toString().trim().toLowerCase().equals(tenantLower);
                });
            }

            Set<String> abilityQuestions = new LinkedHashSet<>();
            Set<String> miQuestions = new LinkedHashSet<>();
            Set<String> personalityQuestions = new LinkedHashSet<>();

            for (Map<String, Object> user : users) {
                // Ability questions
                Object abilityObj = user.get("abilityDetailedResponses");
                if (abilityObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> responses = (List<Map<String, Object>>) abilityObj;
                    for (Map<String, Object> resp : responses) {
                        String q = getString(resp, "question");
                        if (q != null && !q.trim().isEmpty()) abilityQuestions.add(q.trim());
                    }
                }

                // MI questions
                Object miObj = user.get("multipleIntelligenceResponses");
                if (miObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> responses = (List<Map<String, Object>>) miObj;
                    for (Map<String, Object> resp : responses) {
                        String q = getString(resp, "question");
                        if (q != null && !q.trim().isEmpty()) miQuestions.add(q.trim());
                    }
                }

                // Personality questions
                Object persObj = user.get("personalityDetailedResponses");
                if (persObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> responses = (List<Map<String, Object>>) persObj;
                    for (Map<String, Object> resp : responses) {
                        String q = getString(resp, "question");
                        if (q != null && !q.trim().isEmpty()) personalityQuestions.add(q.trim());
                    }
                }
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("abilityQuestions", new ArrayList<>(abilityQuestions));
            response.put("miQuestions", new ArrayList<>(miQuestions));
            response.put("personalityQuestions", new ArrayList<>(personalityQuestions));
            response.put("totalAbility", abilityQuestions.size());
            response.put("totalMI", miQuestions.size());
            response.put("totalPersonality", personalityQuestions.size());
            return ResponseEntity.ok(response);

        } catch (ExecutionException | InterruptedException | TimeoutException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to fetch questions from Firebase: " + e.getMessage());
        }
    }

    /**
     * GET /firebase-mapping/detect-unmapped-questions/{assessmentId}
     *
     * Compares ALL unique firebase questions (from Firestore) against existing
     * mappings for the given assessment. Returns questions that exist in Firebase
     * user data but have no mapping in this assessment.
     */
    @GetMapping("/detect-unmapped-questions/{assessmentId}")
    public ResponseEntity<?> detectUnmappedQuestions(
            @PathVariable Long assessmentId,
            @RequestParam(value = "tenant", required = false) String tenant) {
        try {
            // 1. Get all existing mappings for this assessment
            List<FirebaseQuestionMapping> existingMappings =
                    firebaseQuestionMappingRepository.findByAssessmentId(assessmentId);
            Set<String> mappedQuestions = new LinkedHashSet<>();
            for (FirebaseQuestionMapping m : existingMappings) {
                if (m.getFirebaseQuestion() != null) {
                    mappedQuestions.add(m.getFirebaseQuestion().trim());
                }
            }

            // 2. Fetch all unique firebase questions from Firestore
            List<Map<String, Object>> users = firebaseService.getAllDocuments("users");
            if (users.isEmpty()) users = firebaseService.getAllDocuments("Users");

            if (tenant != null && !tenant.trim().isEmpty()) {
                String tenantLower = tenant.trim().toLowerCase();
                users.removeIf(user -> {
                    Object t = user.get("tenant");
                    return t == null || !t.toString().trim().toLowerCase().equals(tenantLower);
                });
            }

            // 3. Collect all firebase questions with category + answer options + student count + navigator breakdown
            // Key: category::question
            Map<String, Map<String, Object>> allFirebaseQuestions = new LinkedHashMap<>();

            for (Map<String, Object> user : users) {
                // Determine navigator type based on student class
                String studentClass = null;
                Object eduObj = user.get("educational");
                if (eduObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> edu = (Map<String, Object>) eduObj;
                    studentClass = getString(edu, "studentClass");
                }
                String navigator = classToNavigator(studentClass);

                processFirebaseResponses(user, "abilityDetailedResponses", "ability", allFirebaseQuestions, navigator);
                processFirebaseResponses(user, "multipleIntelligenceResponses", "multipleintelligence", allFirebaseQuestions, navigator);
                processFirebaseResponses(user, "personalityDetailedResponses", "personality", allFirebaseQuestions, navigator);

                // String array categories: stored as flat arrays of selected values, not question-answer pairs.
                // Each is treated as a single question with multiple answer options.
                processFirebaseStringArray(user, "careerAspirations", "careeraspirations", "Career Aspirations", allFirebaseQuestions, navigator);
                processFirebaseStringArray(user, "subjectsOfInterest", "subjectofinterest", "Subject of Interest", allFirebaseQuestions, navigator);
                processFirebaseStringArray(user, "values", "values", "Values", allFirebaseQuestions, navigator);
            }

            // 4. Filter to unmapped only
            List<Map<String, Object>> unmapped = new ArrayList<>();
            for (Map.Entry<String, Map<String, Object>> entry : allFirebaseQuestions.entrySet()) {
                String question = (String) entry.getValue().get("question");
                if (!mappedQuestions.contains(question)) {
                    unmapped.add(entry.getValue());
                }
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("assessmentId", assessmentId);
            response.put("totalFirebaseQuestions", allFirebaseQuestions.size());
            response.put("totalMapped", mappedQuestions.size());
            response.put("totalUnmapped", unmapped.size());
            response.put("unmappedQuestions", unmapped);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to detect unmapped questions: " + e.getMessage()));
        }
    }

    /**
     * Determine navigator type from student class.
     * Career Navigator: 11-12, Insight Navigator: 6-8, Subject Navigator: 9-10
     */
    private String classToNavigator(String studentClass) {
        if (studentClass == null || studentClass.trim().isEmpty()) return "unknown";
        try {
            int cls = Integer.parseInt(studentClass.trim());
            if (cls >= 11) return "career";
            if (cls >= 9) return "subject";
            if (cls >= 6) return "insight";
            return "unknown";
        } catch (NumberFormatException e) {
            return "unknown";
        }
    }

    @SuppressWarnings("unchecked")
    private void processFirebaseResponses(Map<String, Object> user, String field, String category,
            Map<String, Map<String, Object>> allQuestions, String navigator) {
        Object obj = user.get(field);
        if (!(obj instanceof List)) return;
        List<Map<String, Object>> responses = (List<Map<String, Object>>) obj;
        for (Map<String, Object> resp : responses) {
            String qRaw = getString(resp, "question");
            if (qRaw == null || qRaw.trim().isEmpty()) continue;
            final String q = qRaw.trim();
            String key = category + "::" + q;
            String answer = getString(resp, "selectedOption");
            if (answer == null) answer = getString(resp, "answer");
            if (answer == null) answer = getString(resp, "selectedAnswer");

            Map<String, Object> qInfo = allQuestions.computeIfAbsent(key, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("question", q);
                m.put("category", category);
                m.put("answers", new LinkedHashSet<String>());
                m.put("studentCount", 0);
                m.put("insightCount", 0);
                m.put("subjectCount", 0);
                m.put("careerCount", 0);
                return m;
            });
            if (answer != null && !answer.trim().isEmpty()) {
                ((Set<String>) qInfo.get("answers")).add(answer.trim());
            }
            qInfo.put("studentCount", ((int) qInfo.get("studentCount")) + 1);
            if ("insight".equals(navigator)) {
                qInfo.put("insightCount", ((int) qInfo.get("insightCount")) + 1);
            } else if ("subject".equals(navigator)) {
                qInfo.put("subjectCount", ((int) qInfo.get("subjectCount")) + 1);
            } else if ("career".equals(navigator)) {
                qInfo.put("careerCount", ((int) qInfo.get("careerCount")) + 1);
            }
        }
    }

    /**
     * Process string array Firebase fields (careerAspirations, subjectsOfInterest, values).
     * These are stored as flat string arrays — treated as a single question with each value as an answer option.
     */
    @SuppressWarnings("unchecked")
    private void processFirebaseStringArray(Map<String, Object> user, String field, String category,
            String questionLabel, Map<String, Map<String, Object>> allQuestions, String navigator) {
        Object obj = user.get(field);
        if (!(obj instanceof List)) return;
        List<?> items = (List<?>) obj;
        if (items.isEmpty()) return;

        String key = category + "::" + questionLabel;
        Map<String, Object> qInfo = allQuestions.computeIfAbsent(key, k -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("question", questionLabel);
            m.put("category", category);
            m.put("answers", new LinkedHashSet<String>());
            m.put("studentCount", 0);
            m.put("insightCount", 0);
            m.put("subjectCount", 0);
            m.put("careerCount", 0);
            return m;
        });

        for (Object item : items) {
            if (item != null) {
                String val = item.toString().trim();
                if (!val.isEmpty()) {
                    ((Set<String>) qInfo.get("answers")).add(val);
                }
            }
        }
        qInfo.put("studentCount", ((int) qInfo.get("studentCount")) + 1);
        if ("insight".equals(navigator)) {
            qInfo.put("insightCount", ((int) qInfo.get("insightCount")) + 1);
        } else if ("subject".equals(navigator)) {
            qInfo.put("subjectCount", ((int) qInfo.get("subjectCount")) + 1);
        } else if ("career".equals(navigator)) {
            qInfo.put("careerCount", ((int) qInfo.get("careerCount")) + 1);
        }
    }

    /**
     * Bulk import students from Firebase data.
     * Creates User + StudentInfo + UserStudent for each student.
     * Saves FirebaseDataMapping with type=STUDENT.
     *
     * Request body: { "students": [ { "firebaseDocId", "name", "email", "dob", "gender",
     *   "phone", "instituteCode", "schoolSectionId", "studentClass" } ] }
     */
    @Transactional // Issue 2: entire import is atomic — partial imports can't leave orphan data
    @PostMapping("/import-students")
    public ResponseEntity<?> importStudents(@RequestBody Map<String, Object> payload) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> students = (List<Map<String, Object>>) payload.get("students");
            if (students == null || students.isEmpty()) {
                return ResponseEntity.badRequest().body("No students provided");
            }

            List<Map<String, Object>> results = new ArrayList<>();
            int created = 0;
            int skipped = 0;

            for (Map<String, Object> student : students) {
                String firebaseDocId = getString(student, "firebaseDocId");
                String name = getString(student, "name");
                String email = getString(student, "email");
                String dobStr = getString(student, "dob");
                String gender = getString(student, "gender");
                String phone = getString(student, "phone");
                Integer instituteCode = getInteger(student, "instituteCode");
                Integer schoolSectionId = getInteger(student, "schoolSectionId");
                Integer studentClass = getInteger(student, "studentClass");

                Map<String, Object> resultMap = new LinkedHashMap<>();
                resultMap.put("firebaseDocId", firebaseDocId);
                resultMap.put("name", name);

                // Check if already mapped — update existing records instead of skipping
                if (firebaseDocId != null) {
                    Optional<FirebaseDataMapping> existing =
                        firebaseDataMappingRepository.findByFirebaseIdAndFirebaseType(firebaseDocId, "STUDENT");
                    if (existing.isPresent()) {
                        Long existingUserStudentId = existing.get().getNewEntityId();
                        try {
                            Optional<UserStudent> usOpt = userStudentRepository.findById(existingUserStudentId);
                            if (usOpt.isPresent()) {
                                UserStudent us = usOpt.get();

                                // Update User
                                User existingUser = us.getUserId() != null ? userRepository.findById(us.getUserId()).orElse(null) : null;
                                if (existingUser != null) {
                                    if (name != null) existingUser.setName(name);
                                    if (email != null) existingUser.setEmail(email);
                                    if (phone != null) existingUser.setPhone(phone);
                                    if (dobStr != null && !dobStr.trim().isEmpty()) {
                                        existingUser.setDobDate(parseDob(dobStr.trim()));
                                    }
                                    userRepository.save(existingUser);
                                }

                                // Update StudentInfo
                                StudentInfo existingSi = us.getStudentInfo();
                                if (existingSi != null) {
                                    if (name != null) existingSi.setName(name);
                                    if (email != null) existingSi.setEmail(email);
                                    if (phone != null) existingSi.setPhoneNumber(phone);
                                    if (gender != null) existingSi.setGender(gender);
                                    if (instituteCode != null) existingSi.setInstituteId(instituteCode);
                                    if (studentClass != null) existingSi.setStudentClass(studentClass);
                                    if (schoolSectionId != null) existingSi.setSchoolSectionId(schoolSectionId);
                                    studentInfoRepository.save(existingSi);
                                }

                                // Update institute if changed
                                if (instituteCode != null) {
                                    Optional<InstituteDetail> newInstOpt = instituteDetailRepository.findById(instituteCode);
                                    if (newInstOpt.isPresent() && (us.getInstitute() == null ||
                                            us.getInstitute().getInstituteCode() != instituteCode)) {
                                        us.setInstitute(newInstOpt.get());
                                        userStudentRepository.save(us);
                                    }
                                }

                                // Issue 5: Use managed entity reference instead of detached ID-only proxy
                                Long assessmentId = getLong(student, "assessmentId");
                                if (assessmentId != null && assessmentId > 0) {
                                    Optional<StudentAssessmentMapping> existingSam = studentAssessmentMappingRepository
                                            .findFirstByUserStudentUserStudentIdAndAssessmentId(
                                                    us.getUserStudentId(), assessmentId);
                                    if (!existingSam.isPresent()) {
                                        StudentAssessmentMapping sam = new StudentAssessmentMapping();
                                        sam.setUserStudent(us);
                                        sam.setAssessmentId(assessmentId);
                                        sam.setStatus("ongoing");
                                        studentAssessmentMappingRepository.save(sam);
                                    }
                                }

                                // Update mapping name
                                existing.get().setNewEntityName(name);
                                firebaseDataMappingRepository.save(existing.get());

                                resultMap.put("status", "updated");
                                resultMap.put("reason", "Existing record updated");
                                resultMap.put("userStudentId", existingUserStudentId);
                                results.add(resultMap);
                                created++;
                                continue;
                            }
                        } catch (Exception ex) {
                            // Fall through to create new if update fails
                        }

                        resultMap.put("status", "updated");
                        resultMap.put("reason", "Mapping exists");
                        resultMap.put("userStudentId", existingUserStudentId);
                        results.add(resultMap);
                        created++;
                        continue;
                    }
                }

                // Get institute
                if (instituteCode == null) {
                    resultMap.put("status", "error");
                    resultMap.put("reason", "No institute code provided");
                    results.add(resultMap);
                    skipped++;
                    continue;
                }

                Optional<InstituteDetail> instituteOpt = instituteDetailRepository.findById(instituteCode);
                if (!instituteOpt.isPresent()) {
                    resultMap.put("status", "error");
                    resultMap.put("reason", "Institute not found: " + instituteCode);
                    results.add(resultMap);
                    skipped++;
                    continue;
                }

                // Issue 4: Create User -> StudentInfo -> UserStudent atomically
                // (all within the same @Transactional — if any fails, all roll back)

                // 1. Create User
                User user = new User();
                user.setName(name);
                user.setEmail(email);
                user.setPhone(phone);
                user.setProvider(AuthProvider.custom_student);
                user.setIsActive(true);
                if (dobStr != null && !dobStr.trim().isEmpty()) {
                    user.setDobDate(parseDob(dobStr.trim()));
                }
                user = userRepository.save(user);

                // 2. Create StudentInfo
                StudentInfo studentInfo = new StudentInfo();
                studentInfo.setName(name);
                studentInfo.setEmail(email);
                studentInfo.setPhoneNumber(phone);
                studentInfo.setGender(gender);
                studentInfo.setStudentDob(user.getDobDate());
                studentInfo.setInstituteId(instituteCode);
                if (schoolSectionId != null) {
                    studentInfo.setSchoolSectionId(schoolSectionId);
                }
                if (studentClass != null) {
                    studentInfo.setStudentClass(studentClass);
                }
                studentInfo.setUser(user);
                studentInfo = studentInfoRepository.save(studentInfo);

                // 3. Create UserStudent
                UserStudent userStudent = new UserStudent(user, studentInfo, instituteOpt.get());
                userStudent = userStudentRepository.save(userStudent);

                // Issue 5: Use the managed UserStudent entity directly
                Long assessmentId = getLong(student, "assessmentId");
                if (assessmentId != null && assessmentId > 0) {
                    Optional<StudentAssessmentMapping> existingSam = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(
                                    userStudent.getUserStudentId(), assessmentId);
                    if (!existingSam.isPresent()) {
                        StudentAssessmentMapping sam = new StudentAssessmentMapping();
                        sam.setUserStudent(userStudent);
                        sam.setAssessmentId(assessmentId);
                        sam.setStatus("ongoing");
                        studentAssessmentMappingRepository.save(sam);
                    }
                }

                // Issue 1: ALWAYS create FirebaseDataMapping — use userStudentId as fallback ID
                // so the delete method can always find and clean up these students
                FirebaseDataMapping mapping = new FirebaseDataMapping();
                mapping.setFirebaseId(firebaseDocId != null ? firebaseDocId : "auto_" + userStudent.getUserStudentId());
                mapping.setFirebaseName(name);
                mapping.setFirebaseType("STUDENT");
                mapping.setNewEntityId(userStudent.getUserStudentId());
                mapping.setNewEntityName(name);
                firebaseDataMappingRepository.save(mapping);

                resultMap.put("status", "created");
                resultMap.put("userId", user.getId());
                resultMap.put("studentInfoId", studentInfo.getId());
                resultMap.put("userStudentId", userStudent.getUserStudentId());
                results.add(resultMap);
                created++;
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("created", created);
            response.put("skipped", skipped);
            response.put("total", students.size());
            response.put("results", results);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to import students: " + e.getMessage());
        }
    }

    /**
     * Import assessment raw scores for students.
     *
     * Request body: {
     *   "scores": [
     *     {
     *       "userStudentId": 123,
     *       "assessmentId": 1,
     *       "scoreMap": { "measuredQualityTypeId1": score1, "measuredQualityTypeId2": score2 }
     *     }
     *   ]
     * }
     */
    @PostMapping("/import-scores")
    public ResponseEntity<?> importScores(@RequestBody Map<String, Object> payload) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> scores = (List<Map<String, Object>>) payload.get("scores");
            if (scores == null || scores.isEmpty()) {
                return ResponseEntity.badRequest().body("No scores provided");
            }

            int totalScores = 0;
            int totalMappings = 0;

            for (Map<String, Object> scoreEntry : scores) {
                Long userStudentId = getLong(scoreEntry, "userStudentId");
                Long assessmentId = getLong(scoreEntry, "assessmentId");

                if (userStudentId == null || assessmentId == null) continue;

                // Find or create StudentAssessmentMapping (use managed entity, not detached ID proxy)
                Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
                StudentAssessmentMapping mapping;

                if (!mappingOpt.isPresent()) {
                    Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
                    if (!usOpt.isPresent()) continue;
                    mapping = new StudentAssessmentMapping();
                    mapping.setUserStudent(usOpt.get());
                    mapping.setAssessmentId(assessmentId);
                    mapping.setStatus("completed");
                    mapping = studentAssessmentMappingRepository.save(mapping);
                    totalMappings++;
                } else {
                    mapping = mappingOpt.get();
                    mapping.setStatus("completed");
                    studentAssessmentMappingRepository.save(mapping);
                }

                // Process score map
                @SuppressWarnings("unchecked")
                Map<String, Object> scoreMap = (Map<String, Object>) scoreEntry.get("scoreMap");
                if (scoreMap == null) continue;

                for (Map.Entry<String, Object> entry : scoreMap.entrySet()) {
                    Long mqtId;
                    try {
                        mqtId = Long.parseLong(entry.getKey());
                    } catch (NumberFormatException e) {
                        continue;
                    }
                    Integer score;
                    try {
                        score = Integer.parseInt(entry.getValue().toString());
                    } catch (NumberFormatException e) {
                        continue;
                    }

                    Optional<MeasuredQualityTypes> mqtOpt = measuredQualityTypesRepository.findById(mqtId);
                    if (!mqtOpt.isPresent()) continue;

                    MeasuredQualityTypes mqt = mqtOpt.get();
                    MeasuredQualities mq = mqt.getMeasuredQuality();

                    AssessmentRawScore rawScore = new AssessmentRawScore();
                    rawScore.setStudentAssessmentMapping(mapping);
                    rawScore.setMeasuredQualityType(mqt);
                    rawScore.setMeasuredQuality(mq);
                    rawScore.setRawScore(score);
                    assessmentRawScoreRepository.save(rawScore);
                    totalScores++;
                }
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("mappingsCreated", totalMappings);
            response.put("scoresImported", totalScores);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to import scores: " + e.getMessage());
        }
    }

    /**
     * Import extra data (career aspirations, subjects of interest, values).
     *
     * Request body: {
     *   "data": [
     *     { "userStudentId": 123, "firebaseDocId": "abc", "dataType": "CAREER_ASPIRATION", "dataValue": "Doctor" }
     *   ]
     * }
     */
    @PostMapping("/import-extra-data")
    public ResponseEntity<?> importExtraData(@RequestBody Map<String, Object> payload) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> dataList = (List<Map<String, Object>>) payload.get("data");
            if (dataList == null || dataList.isEmpty()) {
                return ResponseEntity.badRequest().body("No data provided");
            }

            List<FirebaseStudentExtraData> toSave = new ArrayList<>();
            for (Map<String, Object> item : dataList) {
                FirebaseStudentExtraData extra = new FirebaseStudentExtraData();
                extra.setUserStudentId(getLong(item, "userStudentId"));
                extra.setDataType(getString(item, "dataType"));
                extra.setDataValue(getString(item, "dataValue"));
                extra.setFirebaseDocId(getString(item, "firebaseDocId"));
                toSave.add(extra);
            }

            List<FirebaseStudentExtraData> saved = firebaseStudentExtraDataRepository.saveAll(toSave);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("imported", saved.size());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to import extra data: " + e.getMessage());
        }
    }

    // ========================== HELPER METHODS ==========================

    /**
     * Derives Indian academic session year from a Firestore Timestamp or Date object.
     * Indian academic year: April–December → "year-(year+1)", January–March → "(year-1)-year"
     * e.g. Feb 2026 → "2025-26", Aug 2025 → "2025-26"
     */
    private String deriveAcademicSession(Object createdAt) {
        try {
            ZonedDateTime dt = null;
            if (createdAt instanceof com.google.cloud.Timestamp) {
                com.google.cloud.Timestamp ts = (com.google.cloud.Timestamp) createdAt;
                dt = Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos())
                        .atZone(ZoneId.of("Asia/Kolkata"));
            } else if (createdAt instanceof java.util.Date) {
                dt = ((java.util.Date) createdAt).toInstant().atZone(ZoneId.of("Asia/Kolkata"));
            }
            if (dt != null) {
                int month = dt.getMonthValue(); // 1=Jan … 12=Dec
                int year = dt.getYear();
                if (month <= 3) {
                    // Jan–Mar: academic year started previous year
                    return (year - 1) + "-" + String.valueOf(year).substring(2);
                } else {
                    // Apr–Dec: academic year started this year
                    return year + "-" + String.valueOf(year + 1).substring(2);
                }
            }
        } catch (Exception ignored) {}
        return "Unknown Session";
    }

    /**
     * Parses a DOB string trying multiple formats: dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd, MM/dd/yyyy.
     * Returns null if none match.
     */
    private Date parseDob(String dobStr) {
        if (dobStr == null || dobStr.trim().isEmpty()) return null;
        String s = dobStr.trim();
        String[] formats = { "dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "MM/dd/yyyy" };
        for (String fmt : formats) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat(fmt);
                sdf.setLenient(false);
                return sdf.parse(s);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private Integer getInteger(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(val.toString()); } catch (NumberFormatException e) { return null; }
    }

    private Long getLong(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).longValue();
        try { return Long.parseLong(val.toString()); } catch (NumberFormatException e) { return null; }
    }

    // ========================== Question Mapping Persistence ==========================

    @GetMapping("/question-mappings/{assessmentId}")
    public ResponseEntity<?> getQuestionMappings(@PathVariable("assessmentId") Long assessmentId) {
        List<FirebaseQuestionMapping> mappings = firebaseQuestionMappingRepository.findByAssessmentId(assessmentId);
        return ResponseEntity.ok(mappings);
    }

    @PostMapping("/save-question-mappings")
    @Transactional
    public ResponseEntity<?> saveQuestionMappings(@RequestBody Map<String, Object> payload) {
        try {
            Long assessmentId = getLong(payload, "assessmentId");
            if (assessmentId == null) {
                return ResponseEntity.badRequest().body("assessmentId is required");
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> mappingsList = (List<Map<String, Object>>) payload.get("mappings");
            if (mappingsList == null || mappingsList.isEmpty()) {
                return ResponseEntity.badRequest().body("No mappings provided");
            }

            // Delete existing mappings for this assessment
            firebaseQuestionMappingRepository.deleteByAssessmentId(assessmentId);
            firebaseQuestionMappingRepository.flush();

            // Batch insert all mappings at once
            List<FirebaseQuestionMapping> batch = new ArrayList<>(mappingsList.size());
            for (Map<String, Object> m : mappingsList) {
                FirebaseQuestionMapping mapping = new FirebaseQuestionMapping();
                mapping.setAssessmentId(assessmentId);
                mapping.setFirebaseQuestion(getString(m, "firebaseQuestion"));
                mapping.setCategory(getString(m, "category"));
                mapping.setSystemQuestionId(getLong(m, "systemQuestionId"));
                mapping.setFirebaseAnswer(getString(m, "firebaseAnswer"));
                mapping.setSystemOptionId(getLong(m, "systemOptionId"));
                batch.add(mapping);
            }
            firebaseQuestionMappingRepository.saveAll(batch);
            int saved = batch.size();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("saved", saved);
            result.put("assessmentId", assessmentId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to save mappings: " + e.getMessage());
        }
    }

    @DeleteMapping("/question-mappings/{assessmentId}")
    @Transactional
    public ResponseEntity<?> deleteQuestionMappings(@PathVariable("assessmentId") Long assessmentId) {
        firebaseQuestionMappingRepository.deleteByAssessmentId(assessmentId);
        return ResponseEntity.ok(Map.of("deleted", true, "assessmentId", assessmentId));
    }

    @GetMapping("/question-mappings/all-assessments")
    public ResponseEntity<?> getAllMappedAssessments() {
        List<FirebaseQuestionMapping> all = firebaseQuestionMappingRepository.findAll();
        // Group by assessmentId and return summary
        Map<Long, Map<String, Object>> summary = new LinkedHashMap<>();
        for (FirebaseQuestionMapping m : all) {
            Long aid = m.getAssessmentId();
            if (!summary.containsKey(aid)) {
                Map<String, Object> info = new LinkedHashMap<>();
                info.put("assessmentId", aid);
                info.put("totalMappings", 0);
                info.put("mappedAt", m.getMappedAt());
                // Get assessment name and questionnaire info
                Optional<AssessmentTable> at = assessmentTableRepository.findById(aid);
                info.put("assessmentName", at.isPresent() ? at.get().getAssessmentName() : "Unknown");
                if (at.isPresent() && at.get().getQuestionnaire() != null) {
                    info.put("questionnaireId", at.get().getQuestionnaire().getQuestionnaireId());
                    info.put("questionnaireName", at.get().getQuestionnaire().getName());
                } else {
                    info.put("questionnaireId", null);
                    info.put("questionnaireName", "Unknown Questionnaire");
                }
                summary.put(aid, info);
            }
            summary.get(aid).put("totalMappings", (int) summary.get(aid).get("totalMappings") + 1);
        }
        return ResponseEntity.ok(new ArrayList<>(summary.values()));
    }

    /**
     * GET /firebase-mapping/firebase-scores/{userStudentId}
     *
     * Looks up the Firebase docId for the given userStudentId from the mapping table,
     * then fetches that document from Firestore and returns its scores.
     */
    @GetMapping("/firebase-scores/{userStudentId}")
    public ResponseEntity<?> getFirebaseScores(@PathVariable Long userStudentId) {
        try {
            Optional<FirebaseDataMapping> mappingOpt =
                    firebaseDataMappingRepository.findByNewEntityIdAndFirebaseType(userStudentId, "STUDENT");
            if (!mappingOpt.isPresent()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No Firebase mapping found for userStudentId: " + userStudentId));
            }

            String firebaseDocId = mappingOpt.get().getFirebaseId();
            Map<String, Object> user = firebaseService.getDocument("users", firebaseDocId);
            if (user == null || user.isEmpty()) {
                user = firebaseService.getDocument("Users", firebaseDocId);
            }
            if (user == null || user.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Firebase document not found for docId: " + firebaseDocId));
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("firebaseDocId", firebaseDocId);
            result.put("name", user.get("personal") instanceof Map ? ((Map<?, ?>) user.get("personal")).get("name") : null);
            result.put("abilityScores", user.get("abilityScores"));
            result.put("multipleIntelligenceScores", user.get("multipleIntelligenceScores"));
            result.put("personalityScores", user.get("personalityScores"));
            return ResponseEntity.ok(result);

        } catch (ExecutionException | InterruptedException | TimeoutException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch Firebase scores: " + e.getMessage()));
        }
    }

    /**
     * POST /firebase-mapping/repair-questionnaire-questions
     * Body: { "assessmentId": 18 }  (optional: "userStudentId": 658)
     *
     * Fixes AssessmentAnswer rows where questionnaireQuestion is null but option is set.
     * Looks up option -> AssessmentQuestions -> QuestionnaireQuestion and patches the row.
     * Run this once after the FirebaseDataMappingController import fix was deployed.
     */
    @PostMapping("/repair-questionnaire-questions")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> repairQuestionnaireQuestions(@RequestBody Map<String, Object> request) {
        try {
            Long assessmentId = getLong(request, "assessmentId");
            Long userStudentId = getLong(request, "userStudentId"); // optional

            // Get the correct questionnaire ID for this assessment
            Optional<AssessmentTable> atOpt = assessmentTableRepository.findById(assessmentId);
            if (!atOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Assessment not found: " + assessmentId));
            }
            AssessmentTable assessment = atOpt.get();
            final Long questionnaireId = (assessment.getQuestionnaire() != null)
                    ? assessment.getQuestionnaire().getQuestionnaireId() : null;

            List<AssessmentAnswer> answers;
            if (userStudentId != null) {
                answers = assessmentAnswerRepository.findByUserStudent_UserStudentIdAndAssessment_Id(userStudentId, assessmentId);
            } else {
                answers = assessmentAnswerRepository.findAllByAssessmentIdForExport(assessmentId);
            }

            int repaired = 0;
            int skipped = 0;
            for (AssessmentAnswer a : answers) {
                // Fix: null QQ OR QQ pointing to wrong questionnaire
                boolean needsRepair = false;
                if (a.getQuestionnaireQuestion() == null) {
                    needsRepair = true;
                } else if (questionnaireId != null) {
                    QuestionnaireSection sec = a.getQuestionnaireQuestion().getSection();
                    if (sec == null || sec.getQuestionnaire() == null
                            || !questionnaireId.equals(sec.getQuestionnaire().getQuestionnaireId())) {
                        needsRepair = true;
                    }
                }
                if (!needsRepair) { skipped++; continue; }

                // Determine questionId to lookup
                Long qId = null;
                if (a.getOption() != null && a.getOption().getQuestion() != null) {
                    qId = a.getOption().getQuestion().getQuestionId();
                } else if (a.getQuestionnaireQuestion() != null
                        && a.getQuestionnaireQuestion().getQuestion() != null) {
                    // Text-only answer: get questionId from the (possibly wrong) QQ's question
                    qId = a.getQuestionnaireQuestion().getQuestion().getQuestionId();
                }

                if (qId == null) { skipped++; continue; }

                List<QuestionnaireQuestion> qqList = (questionnaireId != null)
                        ? questionnaireQuestionRepository.findByQuestionIdAndQuestionnaireId(qId, questionnaireId)
                        : questionnaireQuestionRepository.findByQuestion_QuestionId(qId);
                if (qqList.isEmpty()) { skipped++; continue; }

                a.setQuestionnaireQuestion(qqList.get(0));
                assessmentAnswerRepository.save(a);
                repaired++;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("repaired", repaired);
            result.put("skipped", skipped);
            result.put("assessmentId", assessmentId);
            result.put("questionnaireId", questionnaireId);
            if (userStudentId != null) result.put("userStudentId", userStudentId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Repair failed: " + e.getMessage()));
        }
    }
}
