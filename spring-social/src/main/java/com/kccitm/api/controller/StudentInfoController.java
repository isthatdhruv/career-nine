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
import org.springframework.security.access.prepost.PreAuthorize;
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
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.security.AuthorizationService;
import javax.transaction.Transactional;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.AssessmentSubmissionFailureRepository;
import com.kccitm.api.repository.AssessmentAdminActionRepository;
import com.kccitm.api.model.career9.AssessmentAdminAction;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.exception.ServiceException;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.LoginCredentialsEmailService;
import com.kccitm.api.service.StudentProvisioningService;

@RestController
@RequestMapping("/student-info")
public class StudentInfoController {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StudentInfoRepository studentInfoRepository;
    // Phase 1 (Task 1.6): used to re-authorize /update against the PERSISTED institute.
    @Autowired
    private AuthorizationService authorizationService;
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
    private StudentProvisioningService studentProvisioningService;
    @Autowired
    private com.kccitm.api.repository.Career9.School.SchoolSectionsRepository schoolSectionsRepository;
    @Autowired
    private AssessmentSubmissionFailureRepository submissionFailureRepository;
    @Autowired
    private AssessmentAdminActionRepository adminActionRepository;
    @Autowired
    private com.kccitm.api.repository.Career9.DemographicFieldDefinitionRepository demographicFieldDefinitionRepository;
    @Autowired
    private com.kccitm.api.repository.Career9.StudentDemographicResponseRepository studentDemographicResponseRepository;
    @Autowired
    private LoginCredentialsEmailService loginCredentialsEmailService;
    @Autowired
    private com.kccitm.api.repository.UserRoleGroupMappingRepository userRoleGroupMappingRepository;
    // Dossier endpoint dependencies — spotlight detail view bundles these into
    // a single payload so the frontend can render the panel from one call
    // instead of a chatty waterfall.
    @Autowired
    private com.kccitm.api.repository.Career9.PaymentTransactionRepository paymentTransactionRepository;
    @Autowired
    private com.kccitm.api.repository.Career9.GeneratedReportRepository generatedReportRepository;

    // no scope arg: cross-institute list — scope-filter (Plan 15-06) narrows result set
    @PreAuthorize("@auth.allows('student_info.read.all')")
    @GetMapping("/getAll")
    public List<StudentInfo> getAllStudentInfo() {
        return studentInfoRepository.findAll();
    }

    // no scope arg: identifies student by userStudentId; scope-filter narrows access
    @PreAuthorize("@auth.allows('student_info.read')")
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

                    // Option ID and text — check option, then mappedOption, then textResponse
                    AssessmentQuestionOptions effectiveOption = aa.getOption() != null ? aa.getOption() : aa.getMappedOption();
                    row.put("optionId", effectiveOption != null ? effectiveOption.getOptionId() : null);

                    String optionText = "";
                    if (effectiveOption != null && effectiveOption.getOptionText() != null && !effectiveOption.getOptionText().trim().isEmpty()) {
                        optionText = effectiveOption.getOptionText();
                    } else if (aa.getTextResponse() != null && !aa.getTextResponse().trim().isEmpty()) {
                        optionText = aa.getTextResponse();
                    }
                    row.put("optionText", optionText);

                    // Option number (1-based index) - useful when option is an image
                    int optionNumber = 0;
                    boolean isImageOption = false;
                    if (effectiveOption != null && aa.getQuestionnaireQuestion() != null
                            && aa.getQuestionnaireQuestion().getQuestion() != null
                            && aa.getQuestionnaireQuestion().getQuestion().getOptions() != null) {
                        Long selectedOptionId = effectiveOption.getOptionId();
                        var allOptions = aa.getQuestionnaireQuestion().getQuestion().getOptions();
                        for (int i = 0; i < allOptions.size(); i++) {
                            if (allOptions.get(i).getOptionId().equals(selectedOptionId)) {
                                optionNumber = i + 1;
                                break;
                            }
                        }
                        isImageOption = (effectiveOption.getOptionText() == null
                                || effectiveOption.getOptionText().trim().isEmpty())
                                && effectiveOption.getOptionImage() != null
                                && effectiveOption.getOptionImage().length > 0;
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

    // no scope arg: body is list of id-pairs; scope-filter narrows access
    @PreAuthorize("@auth.allows('student_info.read')")
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

    @PreAuthorize("@auth.allows('student_info.create', #studentInfo.instituteId, null, null, null)")
    @PostMapping("/add")
    public StudentAssessmentMapping addStudentInfo(@RequestBody StudentInfo studentInfo) {
        try {
            System.out.println("[DEBUG addStudentInfo] Received: name=" + studentInfo.getName()
                + ", rollNo=" + studentInfo.getSchoolRollNumber()
                + ", assesment_id=" + studentInfo.getAssesment_id()
                + ", instituteId=" + studentInfo.getInstituteId());

            User user = userRepository.save(new User((int) (Math.random() * 1000),
                    studentInfo.getStudentDob()));

            // Set careerNineRollNumber: use manual value if provided, otherwise auto-generate
            String manualRollNumber = studentInfo.getCareerNineRollNumber();
            if (manualRollNumber != null && !manualRollNumber.trim().isEmpty()) {
                user.setCareerNineRollNumber(manualRollNumber.trim());
            } else {
                String rollNumber = rollNumberService.generateNextRollNumber(
                        studentInfo.getInstituteId(), studentInfo.getSchoolSectionId());
                if (rollNumber != null) {
                    user.setCareerNineRollNumber(rollNumber);
                }
            }
            user = userRepository.save(user);

            studentInfo.setUser(user);
            Integer instituteId = studentInfo.getInstituteId();
            UserStudent userStudent = new UserStudent(user, studentInfoRepository.save(studentInfo),
                    instituteDetailRepository.getById(instituteId));
            UserStudent userStudentSAVED = userStudentRepository.save(userStudent);
            studentProvisioningService.provision(userStudentSAVED);

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

    // no scope arg: mapping body has only ids; scope enforcement via filter
    @PreAuthorize("@auth.allows('student_info.update')")
    @PostMapping("/alotAssessmentToStudent")
    public StudentAssessmentMapping alotAssessmentToStudent(
            @RequestBody StudentAssessmentMapping studentAssessmentMapping) {
        return studentAssessmentMappingRepository.save(studentAssessmentMapping);
    }

    // no scope arg: body is raw id-pair list; scope enforced via filter
    @PreAuthorize("@auth.allows('student_info.update')")
    @PostMapping("/bulkAlotAssessment")
    @org.springframework.transaction.annotation.Transactional
    public synchronized ResponseEntity<?> bulkAlotAssessment(
            @RequestBody List<java.util.Map<String, Long>> assignments) {
        List<StudentAssessmentMapping> savedMappings = new java.util.ArrayList<>();

        // Deduplicate assignments in the request itself
        java.util.Set<String> processedKeys = new java.util.HashSet<>();

        // Cache per-institute remaining capacity so we don't re-query mid-loop
        // and so we honor the cumulative limit across the request batch.
        java.util.Map<Integer, Long> remainingByInstitute = new java.util.HashMap<>();

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

                // Resolve institute for this student so we can enforce the per-institute cap
                java.util.Optional<UserStudent> userStudentOpt = userStudentRepository.findById(userStudentId);
                if (!userStudentOpt.isPresent() || userStudentOpt.get().getInstitute() == null) {
                    // Couldn't resolve institute — skip enforcement, fall through to existing flow
                } else {
                    Integer instituteCode = userStudentOpt.get().getInstitute().getInstituteCode();

                    // Lazy-load the institute's remaining capacity once per institute per request
                    if (!remainingByInstitute.containsKey(instituteCode)) {
                        // Use primitive int to hit the custom findById(int) overload
                        // (the inherited JpaRepository.findById(Integer) returns Optional)
                        com.kccitm.api.model.career9.school.InstituteDetail institute =
                                instituteDetailRepository.findById(instituteCode.intValue());
                        Integer max = (institute != null) ? institute.getMaxAssessments() : null;
                        if (max == null) {
                            // Null = unlimited
                            remainingByInstitute.put(instituteCode, Long.MAX_VALUE);
                        } else {
                            long current = studentAssessmentMappingRepository.countByInstituteCode(instituteCode);
                            remainingByInstitute.put(instituteCode, Math.max(0, max - current));
                        }
                    }

                    long remaining = remainingByInstitute.get(instituteCode);
                    if (remaining <= 0) {
                        // Institute is at or over its cap — reject this request with details.
                        java.util.Map<String, Object> err = new java.util.HashMap<>();
                        err.put("error", "Institute assessment limit reached");
                        err.put("instituteCode", instituteCode);
                        err.put("createdSoFar", savedMappings.size());
                        err.put("remainingForInstitute", 0);
                        return ResponseEntity
                            .status(org.springframework.http.HttpStatus.CONFLICT)
                            .body(err);
                    }

                    remainingByInstitute.put(instituteCode, remaining - 1);
                }

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
        return ResponseEntity.ok(savedMappings);
    }

    @PreAuthorize("@auth.allows('student_info.read', #instituteId, null, null, null)")
    @GetMapping("/getByInstituteId/{instituteId}")
    public List<StudentInfo> getByInstituteId(@PathVariable("instituteId") Integer instituteId) {
        return studentInfoRepository.findByInstituteId(instituteId);
    }

    @PreAuthorize("@auth.allows('student_info.read', #instituteId, null, null, null)")
    @Transactional
    @GetMapping("/getStudentsWithMappingByInstituteId/{instituteId}")
    public List<java.util.Map<String, Object>> getStudentsWithMappingByInstituteId(
            @PathVariable("instituteId") Integer instituteId) {
        try {
            List<StudentInfo> students = studentInfoRepository.findByInstituteId(instituteId);
            return assembleStudentsWithMapping(students);
        } catch (Exception e) {
            System.out.println("Error in getStudentsWithMappingByInstituteId: " + e.getMessage());
            e.printStackTrace();
            return new java.util.ArrayList<>();
        }
    }

    // no scope arg: cross-institute list — scope-filter narrows result set
    @PreAuthorize("@auth.allows('student_info.read.all')")
    @Transactional
    @GetMapping("/getAllStudentsWithMapping")
    public List<java.util.Map<String, Object>> getAllStudentsWithMapping() {
        try {
            List<StudentInfo> students = studentInfoRepository.findAll();
            return assembleStudentsWithMapping(students);
        } catch (Exception e) {
            System.out.println("Error in getAllStudentsWithMapping: " + e.getMessage());
            e.printStackTrace();
            return new java.util.ArrayList<>();
        }
    }

    /**
     * Spotlight-style global search across {@code student_info} metadata
     * (name, email, phone, school roll number, control number, address,
     * family, school board, gender) plus {@code student_demographic_response}
     * (free-form values like father name, mother name, religion, caste).
     *
     * <p>Scope is enforced exclusively by the {@code scopeFilter} declared on
     * {@link StudentInfo}: the demographic hits are funnelled back through
     * {@link StudentInfoRepository#findAllByIdInScoped} so a caller scoped to
     * institute X cannot surface a match on a student belonging to institute Y
     * even if their father's name matches the query.
     *
     * <p>The {@code .read.all} permission acts as a "may run a cross-institute
     * search" gate; the row-level filter still narrows the result set for
     * non-super-admin callers. Empty/whitespace queries short-circuit to an
     * empty list so the modal can show its idle state cheaply.
     */
    @PreAuthorize("@auth.allows('student_info.read.all')")
    @Transactional
    @GetMapping("/global-search")
    public List<java.util.Map<String, Object>> globalSearch(
            @RequestParam("q") String rawQuery,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        try {
            if (rawQuery == null) return new ArrayList<>();
            String trimmed = rawQuery.trim();
            // Require at least 2 chars — a single character flood would scan
            // the whole demographic table and the UX gain is negligible.
            if (trimmed.length() < 2) return new ArrayList<>();
            // Cap limit at a sane upper bound; the modal is meant for top hits,
            // not full pagination.
            int safeLimit = Math.max(1, Math.min(limit, 200));
            String like = "%" + trimmed + "%";

            // 1. Direct metadata hits on student_info — already scope-filtered.
            List<StudentInfo> directHits = studentInfoRepository.globalSearch(like);

            // 2. Demographic-table hits → resolve to studentInfoIds via the
            //    UserStudent bridge, then re-fetch through the scope-filtered
            //    repo method so cross-institute leakage is impossible.
            List<Object[]> demoHits = studentDemographicResponseRepository.searchByResponseValue(like);
            Map<Long, String> matchedFieldByUserStudent = new LinkedHashMap<>();
            Map<Long, String> matchedValueByUserStudent = new LinkedHashMap<>();
            for (Object[] row : demoHits) {
                Long usId = (Long) row[0];
                if (usId == null) continue;
                // Keep the FIRST demographic match per student (stable, predictable).
                matchedFieldByUserStudent.putIfAbsent(usId, (String) row[1]);
                matchedValueByUserStudent.putIfAbsent(usId, (String) row[2]);
            }

            List<StudentInfo> demoMatchedStudents = new ArrayList<>();
            if (!matchedFieldByUserStudent.isEmpty()) {
                // userStudentId → studentInfoId
                List<UserStudent> bridge = userStudentRepository.findAllById(matchedFieldByUserStudent.keySet());
                List<Integer> studentInfoIds = bridge.stream()
                        .filter(us -> us.getStudentInfo() != null)
                        .map(us -> us.getStudentInfo().getId())
                        .distinct()
                        .collect(Collectors.toList());
                if (!studentInfoIds.isEmpty()) {
                    demoMatchedStudents = studentInfoRepository.findAllByIdInScoped(studentInfoIds);
                }
            }

            // 3. Dedupe by studentInfo.id, preserving direct-hit order first
            //    (those are usually the more obvious matches).
            LinkedHashMap<Integer, StudentInfo> merged = new LinkedHashMap<>();
            for (StudentInfo si : directHits) merged.putIfAbsent(si.getId(), si);
            for (StudentInfo si : demoMatchedStudents) merged.putIfAbsent(si.getId(), si);

            List<StudentInfo> top = merged.values().stream()
                    .limit(safeLimit)
                    .collect(Collectors.toList());

            // 4. Use the existing helper to produce the same row shape the
            //    Reports Hub table consumes (name, email, phone, section, etc.).
            List<Map<String, Object>> rows = assembleStudentsWithMapping(top);

            // 5. Decorate each row with a "matched on" hint so the spotlight UI
            //    can show why a row surfaced when the query didn't hit the
            //    visible columns directly.
            Map<Integer, UserStudent> idToUserStudent = new HashMap<>();
            if (!top.isEmpty()) {
                List<Integer> ids = top.stream().map(StudentInfo::getId).collect(Collectors.toList());
                for (UserStudent us : userStudentRepository.findByStudentInfoIdIn(ids)) {
                    if (us.getStudentInfo() != null) {
                        idToUserStudent.putIfAbsent(us.getStudentInfo().getId(), us);
                    }
                }
            }
            String lower = trimmed.toLowerCase();
            for (Map<String, Object> row : rows) {
                Object idObj = row.get("id");
                if (!(idObj instanceof Integer)) continue;
                UserStudent us = idToUserStudent.get((Integer) idObj);
                Long usId = us != null ? us.getUserStudentId() : null;
                String matchHint = buildMatchHint(row, lower);
                if (matchHint == null && usId != null && matchedFieldByUserStudent.containsKey(usId)) {
                    matchHint = matchedFieldByUserStudent.get(usId) + ": "
                            + safeTrim(matchedValueByUserStudent.get(usId), 60);
                }
                row.put("matchHint", matchHint != null ? matchHint : "");
                // Stash institute name if available — handy for the modal's
                // sub-line so the user can tell two same-named students apart.
                if (us != null && us.getInstitute() != null) {
                    row.put("instituteName", us.getInstitute().getInstituteName());
                }
            }
            return rows;
        } catch (Exception e) {
            System.out.println("Error in globalSearch: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    /**
     * Spotlight detail-view dossier: everything we know about a single
     * student, in one payload. Powers the panel that opens when the operator
     * clicks a row in the global-search modal.
     *
     * <p>Scope is enforced by resolving the {@code userStudentId} → {@code
     * studentInfo.id} via {@link UserStudentRepository#findById} and then
     * re-fetching the StudentInfo row through the scope-filtered repository
     * method. If the caller can't see the student, the lookup yields empty and
     * we return 404. Demographic/assessment/payment/report data are joined
     * only AFTER scope passes, so cross-tenant leaks are structurally
     * impossible.
     *
     * <p>The payload is intentionally flat (Map) rather than a typed DTO —
     * matches the rest of this controller's idiom and keeps the frontend free
     * to render additions without a backend type change.
     */
    @PreAuthorize("@auth.allows('student_info.read.all')")
    @Transactional
    @GetMapping("/global-search/detail/{userStudentId}")
    public ResponseEntity<Map<String, Object>> globalSearchDetail(
            @PathVariable("userStudentId") Long userStudentId) {
        try {
            Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
            if (!usOpt.isPresent() || usOpt.get().getStudentInfo() == null) {
                return ResponseEntity.notFound().build();
            }
            UserStudent us = usOpt.get();
            Integer studentInfoId = us.getStudentInfo().getId();

            // Scope gate: re-fetch through the scope-filtered query so a
            // caller outside the student's institute scope gets a 404, not a
            // leak. If the list comes back empty the row was filtered out.
            List<StudentInfo> scoped = studentInfoRepository.findAllByIdInScoped(
                    java.util.Collections.singletonList(studentInfoId));
            if (scoped.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            StudentInfo si = scoped.get(0);

            Map<String, Object> dossier = new LinkedHashMap<>();

            // ── 1. Core profile ──
            Map<String, Object> profile = new LinkedHashMap<>();
            profile.put("userStudentId", us.getUserStudentId());
            profile.put("studentInfoId", si.getId());
            profile.put("name", si.getName());
            profile.put("email", si.getEmail());
            profile.put("phoneNumber", si.getPhoneNumber());
            profile.put("schoolRollNumber", si.getSchoolRollNumber());
            profile.put("controlNumber", si.getControlNumber());
            profile.put("studentDob", si.getStudentDob());
            profile.put("address", si.getAddress());
            profile.put("gender", si.getGender());
            profile.put("family", si.getFamily());
            profile.put("sibling", si.getSibling());
            profile.put("schoolBoard", si.getSchoolBoard());
            profile.put("studentClass", si.getStudentClass());
            try {
                profile.put("username", si.getUser() != null ? si.getUser().getUsername() : null);
                profile.put("careerNineRollNumber",
                        si.getUser() != null ? si.getUser().getCareerNineRollNumber() : null);
            } catch (Exception e) {
                profile.put("username", null);
                profile.put("careerNineRollNumber", null);
            }
            profile.put("infoCompleted", us.getInfoCompleted());
            profile.put("counsellingAllowed", us.getCounsellingAllowed());
            profile.put("reportsVisible", us.getReportsVisible());
            dossier.put("profile", profile);

            // ── 2. Institute ──
            if (us.getInstitute() != null) {
                Map<String, Object> inst = new LinkedHashMap<>();
                inst.put("instituteCode", us.getInstitute().getInstituteCode());
                inst.put("instituteName", us.getInstitute().getInstituteName());
                dossier.put("institute", inst);
            } else {
                dossier.put("institute", null);
            }

            // ── 3. School class + section ──
            if (si.getSchoolSectionId() != null) {
                try {
                    Optional<com.kccitm.api.model.career9.school.SchoolSections> secOpt =
                            schoolSectionsRepository.findById(si.getSchoolSectionId());
                    if (secOpt.isPresent()) {
                        com.kccitm.api.model.career9.school.SchoolSections sec = secOpt.get();
                        Map<String, Object> section = new LinkedHashMap<>();
                        section.put("schoolSectionId", sec.getId());
                        section.put("sectionName", sec.getSectionName());
                        if (sec.getSchoolClasses() != null) {
                            section.put("className", sec.getSchoolClasses().getClassName());
                            section.put("classId", sec.getSchoolClasses().getId());
                        }
                        dossier.put("schoolSection", section);
                    }
                } catch (Exception e) {
                    // section lookup is best-effort; missing section shouldn't kill the dossier
                }
            }

            // ── 4. Demographic responses (Father Name, Mother Name, …) ──
            //    Cross-assessment lookup so we surface every custom field the
            //    student has answered, not just one assessment's slice.
            List<com.kccitm.api.model.career9.StudentDemographicResponse> demoResponses =
                    studentDemographicResponseRepository.findByUserStudentId(userStudentId);
            List<Map<String, Object>> demoList = new ArrayList<>();
            // Dedupe by fieldId — the same field across multiple assessments
            // is conceptually one fact about the student. Keep the most-recent
            // one (the list is unordered, so iterate twice).
            Map<Long, com.kccitm.api.model.career9.StudentDemographicResponse> bestByField = new LinkedHashMap<>();
            for (com.kccitm.api.model.career9.StudentDemographicResponse r : demoResponses) {
                if (r.getFieldDefinition() == null) continue;
                Long fid = r.getFieldDefinition().getFieldId();
                com.kccitm.api.model.career9.StudentDemographicResponse cur = bestByField.get(fid);
                if (cur == null || (r.getSubmittedAt() != null
                        && (cur.getSubmittedAt() == null
                            || r.getSubmittedAt().after(cur.getSubmittedAt())))) {
                    bestByField.put(fid, r);
                }
            }
            for (com.kccitm.api.model.career9.StudentDemographicResponse r : bestByField.values()) {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("fieldId", r.getFieldDefinition().getFieldId());
                d.put("fieldName", r.getFieldDefinition().getFieldName());
                d.put("displayLabel", r.getFieldDefinition().getDisplayLabel());
                d.put("dataType", r.getFieldDefinition().getDataType());
                // Resolve dropdown/radio values to their human label when the
                // field has options — otherwise the UI shows raw ids like "3".
                String raw = r.getResponseValue();
                String resolved = raw;
                try {
                    if (raw != null && r.getFieldDefinition().getOptions() != null) {
                        for (com.kccitm.api.model.career9.DemographicFieldOption opt
                                : r.getFieldDefinition().getOptions()) {
                            if (raw.equals(opt.getOptionValue())) {
                                resolved = opt.getOptionLabel();
                                break;
                            }
                        }
                    }
                } catch (Exception ex) { /* fall back to raw */ }
                d.put("value", resolved);
                d.put("rawValue", raw);
                d.put("submittedAt", r.getSubmittedAt());
                demoList.add(d);
            }
            dossier.put("demographics", demoList);

            // ── 5. Assessments + per-assessment generated reports ──
            List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                    .findByUserStudentUserStudentIdIn(java.util.Collections.singletonList(userStudentId));
            // Dedupe by assessmentId (the same assessment can have multiple
            // mapping rows if it was re-allotted).
            Map<Long, StudentAssessmentMapping> uniqueMappings = new LinkedHashMap<>();
            for (StudentAssessmentMapping m : mappings) {
                uniqueMappings.putIfAbsent(m.getAssessmentId(), m);
            }
            Set<Long> assessmentIds = uniqueMappings.keySet();
            Map<Long, String> assessmentNames = new HashMap<>();
            if (!assessmentIds.isEmpty()) {
                for (AssessmentTable a : assessmentTableRepository.findAllById(assessmentIds)) {
                    assessmentNames.put(a.getId(), a.getAssessmentName());
                }
            }
            // Bulk load every generated report for this student in ONE query,
            // then group by assessmentId so we can attach the per-assessment
            // report rows below.
            List<com.kccitm.api.model.career9.GeneratedReport> reports =
                    generatedReportRepository.findByUserStudentUserStudentId(userStudentId);
            Map<Long, List<com.kccitm.api.model.career9.GeneratedReport>> reportsByAssessment = new HashMap<>();
            for (com.kccitm.api.model.career9.GeneratedReport r : reports) {
                reportsByAssessment.computeIfAbsent(r.getAssessmentId(), k -> new ArrayList<>()).add(r);
            }
            List<Map<String, Object>> assessmentsOut = new ArrayList<>();
            for (StudentAssessmentMapping m : uniqueMappings.values()) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("assessmentId", m.getAssessmentId());
                a.put("assessmentName", assessmentNames.getOrDefault(m.getAssessmentId(), "Unknown"));
                a.put("status", m.getStatus());
                List<Map<String, Object>> reportRows = new ArrayList<>();
                for (com.kccitm.api.model.career9.GeneratedReport r
                        : reportsByAssessment.getOrDefault(m.getAssessmentId(), java.util.Collections.emptyList())) {
                    Map<String, Object> rr = new LinkedHashMap<>();
                    rr.put("generatedReportId", r.getGeneratedReportId());
                    rr.put("typeOfReport", r.getTypeOfReport());
                    rr.put("reportStatus", r.getReportStatus());
                    rr.put("reportUrl", r.getReportUrl());
                    rr.put("visibleToStudent", r.getVisibleToStudent());
                    reportRows.add(rr);
                }
                a.put("reports", reportRows);
                assessmentsOut.add(a);
            }
            dossier.put("assessments", assessmentsOut);

            // ── 6. Payment transactions ──
            //    Surface everything: paid, failed, abandoned. The UI can
            //    style status badges so the operator can answer "did this
            //    student pay?" at a glance.
            List<PaymentTransaction> txns =
                    paymentTransactionRepository.findByUserStudentIdOrderByCreatedAtDesc(userStudentId);
            List<Map<String, Object>> payments = new ArrayList<>();
            for (PaymentTransaction t : txns) {
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("transactionId", t.getTransactionId());
                p.put("amount", t.getAmount());
                p.put("originalAmount", t.getOriginalAmount());
                p.put("currency", t.getCurrency());
                p.put("status", t.getStatus());
                p.put("assessmentId", t.getAssessmentId());
                p.put("assessmentName", t.getAssessmentId() != null
                        ? assessmentNames.get(t.getAssessmentId()) : null);
                p.put("campaignId", t.getCampaignId());
                p.put("promoCode", t.getPromoCode());
                p.put("promoDiscountPercent", t.getPromoDiscountPercent());
                p.put("shortUrl", t.getShortUrl());
                p.put("paymentLinkUrl", t.getPaymentLinkUrl());
                p.put("razorpayPaymentId", t.getRazorpayPaymentId());
                p.put("failureReason", t.getFailureReason());
                p.put("createdAt", t.getCreatedAt());
                p.put("updatedAt", t.getUpdatedAt());
                payments.add(p);
            }
            dossier.put("payments", payments);

            return ResponseEntity.ok(dossier);
        } catch (Exception e) {
            System.out.println("Error in globalSearchDetail: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** Pick the first row column whose value contains the query — drives the
     *  "matched on: Email — foo@bar.com" hint shown under each result. */
    private String buildMatchHint(Map<String, Object> row, String lowerQuery) {
        String[][] candidates = {
                {"name", "Name"},
                {"email", "Email"},
                {"phoneNumber", "Phone"},
                {"schoolRollNumber", "Roll No."},
                {"controlNumber", "Control No."},
                {"address", "Address"},
                {"family", "Family"},
                {"schoolBoard", "School Board"},
                {"gender", "Gender"},
        };
        for (String[] c : candidates) {
            Object v = row.get(c[0]);
            if (v == null) continue;
            String s = String.valueOf(v);
            if (s.toLowerCase().contains(lowerQuery)) {
                return c[1] + ": " + safeTrim(s, 60);
            }
        }
        return null;
    }

    private String safeTrim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /**
     * Build the {@code studentMappings} JSON shape from a (possibly already
     * filtered) list of StudentInfo rows. Visibility widened from private to
     * public so {@code DashboardDataService} can call it with a scope-narrowed
     * list instead of pulling everything through {@code findAll()}.
     */
    public List<java.util.Map<String, Object>> assembleStudentsWithMapping(List<StudentInfo> students) {
        try {
            if (students.isEmpty()) return new java.util.ArrayList<>();

            // 2. Collect all studentInfo IDs
            List<Integer> studentInfoIds = students.stream()
                    .map(StudentInfo::getId)
                    .collect(Collectors.toList());

            // 3. Bulk load all UserStudents for these studentInfo IDs (1 query instead of N)
            Map<Integer, UserStudent> studentInfoToUserStudent = new HashMap<>();
            List<Long> allUserStudentIds = new ArrayList<>();
            Set<Long> allUserIds = new java.util.HashSet<>();
            List<UserStudent> allUserStudents = userStudentRepository.findByStudentInfoIdIn(studentInfoIds);
            for (UserStudent us : allUserStudents) {
                if (us.getStudentInfo() != null) {
                    studentInfoToUserStudent.putIfAbsent(us.getStudentInfo().getId(), us);
                    allUserStudentIds.add(us.getUserStudentId());
                    if (us.getUserId() != null) {
                        allUserIds.add(us.getUserId());
                    }
                }
            }

            // 3b. Bulk load role-group mappings for every userId in one query (avoids N+1
            //     when rendering the Role Group column on the Data Download page).
            Map<Long, List<Map<String, Object>>> roleGroupsByUserId = new HashMap<>();
            if (!allUserIds.isEmpty()) {
                try {
                    List<com.kccitm.api.model.UserRoleGroupMapping> rgMappings =
                            userRoleGroupMappingRepository.findByUserIn(allUserIds);
                    if (rgMappings != null) {
                        for (com.kccitm.api.model.UserRoleGroupMapping m : rgMappings) {
                            if (Boolean.FALSE.equals(m.getDisplay())) continue;
                            if (m.getRoleGroup() == null) continue;
                            Map<String, Object> rg = new LinkedHashMap<>();
                            rg.put("id", m.getRoleGroup().getId());
                            rg.put("name", m.getRoleGroup().getName());
                            roleGroupsByUserId
                                    .computeIfAbsent(m.getUser(), k -> new ArrayList<>())
                                    .add(rg);
                        }
                    }
                } catch (Exception ex) {
                    System.out.println("Warning: failed to bulk-load role groups: " + ex.getMessage());
                }
            }

            // 4. Bulk load all assessment mappings for all these userStudentIds (1 query)
            // Group by userStudentId
            Map<Long, List<StudentAssessmentMapping>> mappingsByStudent = new HashMap<>();
            if (!allUserStudentIds.isEmpty()) {
                List<StudentAssessmentMapping> allMappings = studentAssessmentMappingRepository
                        .findByUserStudentUserStudentIdIn(allUserStudentIds);
                for (StudentAssessmentMapping m : allMappings) {
                    Long usId = m.getUserStudent().getUserStudentId();
                    mappingsByStudent.computeIfAbsent(usId, k -> new ArrayList<>()).add(m);
                }
            }

            // 5. Bulk load all assessment names (1 query)
            Set<Long> allAssessmentIds = new java.util.HashSet<>();
            for (List<StudentAssessmentMapping> maps : mappingsByStudent.values()) {
                for (StudentAssessmentMapping m : maps) {
                    allAssessmentIds.add(m.getAssessmentId());
                }
            }
            Map<Long, String> assessmentNames = new HashMap<>();
            if (!allAssessmentIds.isEmpty()) {
                List<AssessmentTable> assessments = assessmentTableRepository.findAllById(allAssessmentIds);
                for (AssessmentTable a : assessments) {
                    assessmentNames.put(a.getId(), a.getAssessmentName());
                }
            }

            // 5b. Bulk load latest gender from demographic responses (CUSTOM fields).
            //     SYSTEM gender writes back to studentInfo.gender, but if the gender
            //     field is configured as CUSTOM, the value lives in
            //     student_demographic_response. The stored responseValue is the
            //     option's `option_value` (often a numeric id like "1") — we resolve
            //     it to the human-readable `option_label` via the field's options.
            //     We prefer the demographic response value and fall back to
            //     studentInfo.gender otherwise.
            Map<Long, String> genderByUserStudentId = new HashMap<>();
            try {
                List<com.kccitm.api.model.career9.DemographicFieldDefinition> genderFields =
                        demographicFieldDefinitionRepository.findGenderLikeFields("gender");
                if (!genderFields.isEmpty() && !allUserStudentIds.isEmpty()) {
                    // fieldId -> (optionValue -> optionLabel)
                    Map<Long, Map<String, String>> optionLabelByField = new HashMap<>();
                    List<Long> genderFieldIds = new ArrayList<>();
                    for (com.kccitm.api.model.career9.DemographicFieldDefinition f : genderFields) {
                        genderFieldIds.add(f.getFieldId());
                        Map<String, String> optionMap = new HashMap<>();
                        if (f.getOptions() != null) {
                            for (com.kccitm.api.model.career9.DemographicFieldOption opt : f.getOptions()) {
                                if (opt.getOptionValue() != null) {
                                    optionMap.put(opt.getOptionValue(),
                                            opt.getOptionLabel() != null
                                                    ? opt.getOptionLabel()
                                                    : opt.getOptionValue());
                                }
                            }
                        }
                        optionLabelByField.put(f.getFieldId(), optionMap);
                    }

                    List<com.kccitm.api.model.career9.StudentDemographicResponse> responses =
                            studentDemographicResponseRepository
                                    .findByUserStudentIdInAndFieldDefinitionFieldIdIn(
                                            allUserStudentIds, genderFieldIds);
                    for (com.kccitm.api.model.career9.StudentDemographicResponse r : responses) {
                        String raw = r.getResponseValue();
                        if (raw == null || raw.trim().isEmpty()) continue;
                        Long fieldId = r.getFieldDefinition() != null
                                ? r.getFieldDefinition().getFieldId() : null;
                        Map<String, String> optionMap = fieldId != null
                                ? optionLabelByField.get(fieldId) : null;
                        String resolved = (optionMap != null && optionMap.containsKey(raw))
                                ? optionMap.get(raw)
                                : raw;
                        genderByUserStudentId.put(r.getUserStudentId(), resolved);
                    }
                }
            } catch (Exception ex) {
                System.out.println("Warning: failed to load demographic gender data: " + ex.getMessage());
            }

            // 6. Assemble response in memory — no more DB queries
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
                try {
                    UserStudent usForGender = studentInfoToUserStudent.get(si.getId());
                    Long usId = usForGender != null ? usForGender.getUserStudentId() : null;
                    String demographicGender = usId != null ? genderByUserStudentId.get(usId) : null;
                    String fallbackGender = si.getGender();
                    String resolvedGender = (demographicGender != null && !demographicGender.trim().isEmpty())
                            ? demographicGender
                            : fallbackGender;
                    studentData.put("gender", resolvedGender);
                } catch (Exception e) {
                    studentData.put("gender", si.getGender());
                }
                try {
                    studentData.put("username", si.getUser() != null ? si.getUser().getUsername() : null);
                    studentData.put("loginDob", si.getUser() != null ? si.getUser().getDobDate() : null);
                } catch (Exception e) {
                    studentData.put("username", null);
                    studentData.put("loginDob", null);
                }

                UserStudent us = studentInfoToUserStudent.get(si.getId());
                if (us != null) {
                    studentData.put("userStudentId", us.getUserStudentId());
                    studentData.put("roleGroups",
                            us.getUserId() != null
                                    ? roleGroupsByUserId.getOrDefault(us.getUserId(), new ArrayList<>())
                                    : new ArrayList<>());

                    List<StudentAssessmentMapping> mappings = mappingsByStudent
                            .getOrDefault(us.getUserStudentId(), new ArrayList<>());

                    // Deduplicate by assessmentId
                    java.util.Map<Long, StudentAssessmentMapping> uniqueMappings = new java.util.LinkedHashMap<>();
                    for (StudentAssessmentMapping mapping : mappings) {
                        uniqueMappings.putIfAbsent(mapping.getAssessmentId(), mapping);
                    }
                    List<StudentAssessmentMapping> deduplicatedMappings = new java.util.ArrayList<>(uniqueMappings.values());

                    List<Long> assignedAssessmentIds = new java.util.ArrayList<>();
                    List<java.util.Map<String, Object>> assessmentDetails = new java.util.ArrayList<>();
                    for (StudentAssessmentMapping mapping : deduplicatedMappings) {
                        assignedAssessmentIds.add(mapping.getAssessmentId());
                        java.util.Map<String, Object> detail = new java.util.HashMap<>();
                        detail.put("assessmentId", mapping.getAssessmentId());
                        detail.put("status", mapping.getStatus());
                        detail.put("assessmentName", assessmentNames.getOrDefault(mapping.getAssessmentId(), "Unknown"));
                        assessmentDetails.add(detail);
                    }
                    studentData.put("assignedAssessmentIds", assignedAssessmentIds);
                    studentData.put("assessments", assessmentDetails);

                    if (!mappings.isEmpty()) {
                        studentData.put("assessmentId", mappings.get(mappings.size() - 1).getAssessmentId());
                    } else {
                        studentData.put("assessmentId", null);
                    }
                } else {
                    studentData.put("userStudentId", null);
                    studentData.put("assessmentId", null);
                    studentData.put("assignedAssessmentIds", new java.util.ArrayList<>());
                    studentData.put("assessments", new java.util.ArrayList<>());
                    studentData.put("roleGroups", new java.util.ArrayList<>());
                }

                result.add(studentData);
            }

            return result;
        } catch (Exception e) {
            System.out.println("Error in assembleStudentsWithMapping: " + e.getMessage());
            e.printStackTrace();
            return new java.util.ArrayList<>();
        }
    }

    // Phase 1 (Task 1.6 / audit HIGH-D): previously `return studentInfoRepository.save(studentInfo)`
    // — a blind upsert of the full client-supplied entity. The caller controlled the primary `id`
    // (overwrite or create any row) AND `instituteId` (which was also the ABAC scope arg), so an
    // attacker could pick the institute their own request was scope-checked against and rewrite an
    // arbitrary student in any tenant. Now: require an existing id, load the persisted row,
    // re-authorize against the PERSISTED institute, and pin `id` + `instituteId` from the persisted
    // row so this endpoint can neither move a student across tenants nor mint a new row. The
    // annotation drops the body-supplied scope arg (it was attacker-controlled and meaningless);
    // the real scope check happens in-method below.
    @PreAuthorize("@auth.allows('student_info.update')")
    @PostMapping("/update")
    public ResponseEntity<?> updateStudentInfo(@RequestBody StudentInfo studentInfo) {
        if (studentInfo.getId() == null) {
            return ResponseEntity.badRequest().body("id is required to update a student");
        }
        StudentInfo existing = studentInfoRepository.findById(studentInfo.getId().longValue())
                .orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        // Authorize against the institute on the PERSISTED row, not the client-supplied one.
        if (!authorizationService.allows("student_info.update", existing.getInstituteId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Not permitted to update a student in this institute");
        }
        // Pin tenant + identity from the persisted row regardless of what the client sent.
        studentInfo.setId(existing.getId());
        studentInfo.setInstituteId(existing.getInstituteId());
        return ResponseEntity.ok(studentInfoRepository.save(studentInfo));
    }

    // no scope arg: delete by id alone; scope-filter narrows access
    @PreAuthorize("@auth.allows('student_info.delete')")
    @PostMapping("/delete/{id}")
    public void deleteStudentInfo(@PathVariable("id") Long id) {
        studentInfoRepository.deleteById(id);
    }

    // no scope arg: identifies by userStudentId; scope-filter narrows access
    @PreAuthorize("@auth.allows('student_info.read')")
    @GetMapping("/getDemographics/{userStudentId}")
    public ResponseEntity<?> getDemographics(@PathVariable("userStudentId") Long userStudentId) {
        UserStudent userStudent = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

        // Get associated StudentInfo
        StudentInfo studentInfo = userStudent.getStudentInfo();

        if (studentInfo == null) {
            throw new ResourceNotFoundException("StudentInfo", "userStudentId", userStudentId);
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
    }

    // no scope arg: body is raw Map<String,Object>; SpEL cannot address its keys
    @PreAuthorize("@auth.allows('student_info.update')")
    @PostMapping("/updateDemographics")
    public ResponseEntity<?> updateDemographics(@RequestBody Map<String, Object> request) {
        Long userStudentId = Long.valueOf(request.get("userStudentId").toString());

        // Find UserStudent by userStudentId
        UserStudent userStudent = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

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
        if (request.containsKey("email")) {
            studentInfo.setEmail(request.get("email").toString());
        }
        if (request.containsKey("phoneNumber")) {
            studentInfo.setPhoneNumber(request.get("phoneNumber").toString());
        }
        if (request.containsKey("studentDob")) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
                Date parsedDob = sdf.parse(request.get("studentDob").toString());
                studentInfo.setStudentDob(parsedDob);
                // Also update User.dobDate (used for student login)
                User user = userRepository.findById(userStudent.getUserId()).orElse(null);
                if (user != null) {
                    user.setDobDate(parsedDob);
                    userRepository.save(user);
                }
            } catch (Exception e) {
                return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy");
            }
        }

        // Save updated StudentInfo
        StudentInfo saved = studentInfoRepository.save(studentInfo);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Demographics updated successfully");
        response.put("studentInfo", saved);
        return ResponseEntity.ok(response);
    }

    // no scope arg: body is raw Map<String,Object>; admin-only operation, scope enforced via filter
    @PreAuthorize("@auth.allows('student_info.update')")
    @PostMapping("/resetAssessment")
    @javax.transaction.Transactional
    public ResponseEntity<?> resetAssessment(@RequestBody Map<String, Object> request) {
        Object usIdRaw = request.get("userStudentId");
        Object asIdRaw = request.get("assessmentId");
        Long userStudentId = usIdRaw instanceof Number ? ((Number) usIdRaw).longValue() : null;
        Long assessmentId = asIdRaw instanceof Number ? ((Number) asIdRaw).longValue() : null;
        String reason = request.get("reason") instanceof String ? (String) request.get("reason") : null;
        Object adminRaw = request.get("adminUserId");
        Long adminUserId = adminRaw instanceof Number ? ((Number) adminRaw).longValue() : null;

        if (userStudentId == null || assessmentId == null) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "userStudentId and assessmentId are required");
            return ResponseEntity.badRequest().body(error);
        }

        // Find the mapping
        StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("StudentAssessmentMapping", "userStudentId/assessmentId", userStudentId + "/" + assessmentId));

        // Enforce per-assessment reset cap before doing any destructive work.
        // Pull current cap from AssessmentTable.maxResetsPerStudent (null = unlimited).
        java.util.Optional<com.kccitm.api.model.career9.AssessmentTable> assessmentOpt =
                assessmentTableRepository.findById(assessmentId);
        Integer maxResets = assessmentOpt.map(a -> a.getMaxResetsPerStudent()).orElse(null);
        int alreadyReset = mapping.getResetCount();
        if (maxResets != null && alreadyReset >= maxResets) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Reset limit reached for this assessment");
            err.put("assessmentId", assessmentId);
            err.put("userStudentId", userStudentId);
            err.put("resetCount", alreadyReset);
            err.put("maxResetsPerStudent", maxResets);
            return ResponseEntity
                .status(org.springframework.http.HttpStatus.CONFLICT)
                .body(err);
        }

        // Capture before-state for audit
        String beforeState = String.format(
                "{\"status\":\"%s\",\"persistenceState\":\"%s\"}",
                mapping.getStatus(), mapping.getPersistenceState());

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
        assessmentSessionService.clearAllForMapping(userStudentId, assessmentId);

        // Resolve any submission failure row so the retry scheduler forgets about it
        submissionFailureRepository
                .findByUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .ifPresent(row -> {
                    row.setResolved(true);
                    row.setResolvedAt(java.time.Instant.now());
                    row.setNextRetryAt(null);
                    submissionFailureRepository.save(row);
                });

        // Reset status to 'notstarted', clear persistenceState, and bump the reset counter
        mapping.setStatus("notstarted");
        mapping.setPersistenceState(null);
        mapping.setResetCount(alreadyReset + 1);
        studentAssessmentMappingRepository.save(mapping);

        // Audit trail
        AssessmentAdminAction audit = new AssessmentAdminAction();
        audit.setActionType("reset");
        audit.setUserStudentId(userStudentId);
        audit.setAssessmentId(assessmentId);
        audit.setAdminUserId(adminUserId);
        audit.setActionAt(java.time.Instant.now());
        audit.setReason(reason);
        audit.setBeforeStateJson(beforeState);
        audit.setAfterStateJson("{\"status\":\"notstarted\",\"persistenceState\":null}");
        adminActionRepository.save(audit);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Assessment reset successfully");
        response.put("resetCount", mapping.getResetCount());
        if (maxResets != null) {
            response.put("maxResetsPerStudent", maxResets);
            response.put("remaining", Math.max(0, maxResets - mapping.getResetCount()));
        }
        return ResponseEntity.ok(response);
    }

    // no scope arg: identifies student by userStudentId; scope-filter narrows access
    @PreAuthorize("@auth.allows('student_info.read')")
    @GetMapping("/getStudentScores")
    public ResponseEntity<?> getStudentScores(
            @RequestParam Long userStudentId,
            @RequestParam Long assessmentId) {
        // Find the student assessment mapping
        StudentAssessmentMapping mapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("StudentAssessmentMapping", "userStudentId/assessmentId", userStudentId + "/" + assessmentId));

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
    }

    @PreAuthorize("@auth.allows('student_info.read', #instituteId, null, null, null)")
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

    @PreAuthorize("@auth.allows('student_info.read', #instituteId, null, null, null)")
    @GetMapping("/bet-report/{instituteId}/{assessmentId}")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getBetReport(
            @PathVariable("instituteId") Integer instituteId,
            @PathVariable("assessmentId") Long assessmentId) {
        // 1. Validate assessment exists and is BET type
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId));
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
    }

    /**
     * Send login credentials (username = User.username, password = student DOB
     * formatted dd-MM-yyyy) by email to one or more students.
     *
     * <p>Request body: {@code { "userStudentIds": [1, 2, 3] }}.
     *
     * <p>Returns a per-row outcome list plus aggregate counts so the frontend
     * can show which students succeeded and which failed (missing email, no
     * dob, no username, send error).
     *
     * <p>Authorization: {@code student_info.update} — sending credentials is a
     * mutation of the student's outbox/state, not a read. Scope filter narrows
     * access (Plan 15-06) so KVS-scoped users can only send for KVS students.
     */
    @PreAuthorize("@auth.allows('student_info.update')")
    @PostMapping("/send-login-credentials")
    public ResponseEntity<?> sendLoginCredentials(@RequestBody Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        List<Object> rawIds = (List<Object>) payload.get("userStudentIds");
        if (rawIds == null || rawIds.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "userStudentIds is required"));
        }

        List<Long> userStudentIds = new ArrayList<>();
        for (Object o : rawIds) {
            if (o instanceof Number) userStudentIds.add(((Number) o).longValue());
        }

        List<Map<String, Object>> results = new ArrayList<>();
        int sent = 0;
        int failed = 0;

        for (Long usid : userStudentIds) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userStudentId", usid);

            Optional<UserStudent> usOpt = userStudentRepository.findById(usid);
            if (!usOpt.isPresent()) {
                row.put("status", "failed");
                row.put("reason", "UserStudent not found");
                results.add(row); failed++;
                continue;
            }
            UserStudent us = usOpt.get();
            StudentInfo info = us.getStudentInfo();
            if (info == null) {
                row.put("status", "failed");
                row.put("reason", "StudentInfo missing");
                results.add(row); failed++;
                continue;
            }

            String email = info.getEmail();
            if (email == null || email.trim().isEmpty()) {
                row.put("status", "failed");
                row.put("reason", "No email on file");
                results.add(row); failed++;
                continue;
            }

            // Username lives on User (not StudentInfo). Walk via userId; tolerate
            // students whose User row was never linked (legacy / B2C-only flows).
            String username = null;
            if (us.getUserId() != null) {
                Optional<User> userOpt = userRepository.findById(us.getUserId());
                if (userOpt.isPresent()) username = userOpt.get().getUsername();
            }
            if (username == null || username.trim().isEmpty()) {
                row.put("status", "failed");
                row.put("reason", "No username assigned");
                results.add(row); failed++;
                continue;
            }

            if (info.getStudentDob() == null) {
                row.put("status", "failed");
                row.put("reason", "No DOB on file (used as password)");
                results.add(row); failed++;
                continue;
            }
            String dob = new SimpleDateFormat("dd-MM-yyyy").format(info.getStudentDob());

            // Hand off to the Gmail-backed templated email service. Note that
            // the Gmail send is @Async fire-and-forget — the actual dispatch
            // happens later; eventual send success/failure shows up
            // only in SmtpEmailService logs. So per-row status here is
            // "queued" once validation passes, not "sent". Anything thrown
            // synchronously (validation guard or pre-queue error) is reported
            // as "failed" with the reason.
            try {
                loginCredentialsEmailService.send(info.getName(), email, username, dob, us.getInstitute());
                row.put("status", "queued");
                row.put("email", email);
                sent++;
            } catch (Exception e) {
                row.put("status", "failed");
                row.put("reason", "Email queue failed: " + e.getMessage());
                failed++;
            }
            results.add(row);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("requested", userStudentIds.size());
        // `sent` here means "queued for Gmail dispatch" — the FE label reads
        // "Sent to N students" which matches user expectation even though the
        // actual send happens asynchronously.
        resp.put("sent", sent);
        resp.put("failed", failed);
        resp.put("results", results);
        return ResponseEntity.ok(resp);
    }

    // no scope arg: body is raw id-pair list; scope-filter narrows access
    @PreAuthorize("@auth.allows('student_info.delete')")
    @PostMapping("/bulkRemoveAssessment")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> bulkRemoveAssessment(@RequestBody List<Map<String, Long>> removals) {
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
    }

}
