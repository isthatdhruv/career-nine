package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.repository.Career9.PrincipalDashboardDataRepository;
import com.kccitm.api.repository.Career9.StudentGroupMemberRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Releases a school dashboard: generates every scope on the filter lattice for one
 * institute+assessment, in one batch tagged with a shared {@code releaseId}.
 *
 * <p>Shape of a release:
 * <ol>
 *   <li>{@link #prepareRelease} runs synchronously inside the request. It refuses if a
 *       release is already in flight, builds the lattice, and writes one PENDING row
 *       per scope. The caller gets a releaseId back immediately.</li>
 *   <li>{@link #runReleaseAsync} then walks those rows off-thread. Generation involves
 *       an OpenAI round trip per scope, so it cannot live inside the HTTP request.</li>
 * </ol>
 *
 * <p><b>Status is per scope, never per release.</b> One scope failing its OpenAI call
 * must not void the other twenty-four, and a retry targets that row alone.
 *
 * <p><b>Staleness is a flag, never a spend.</b> Nothing in this service regenerates on
 * its own. A stale row keeps serving its existing content until an admin decides to
 * pay for a new one — regeneration costs money and rewrites wording a principal may
 * already have circulated.
 */
@Service
public class PrincipalDashboardReleaseService {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardReleaseService.class);

    /** Bumped when the aggregation logic changes shape, stamped onto every row. */
    private static final String LOGIC_VERSION = "principal-dashboard-1";

    private final PrincipalDashboardDataRepository repository;
    private final StudentAssessmentMappingRepository mappingRepository;
    private final StudentGroupMemberRepository groupMemberRepository;
    private final PrincipalDashboardScopeCalculator calculator;
    private final PrincipalDashboardAiService aiService;
    private final ObjectMapper objectMapper;

    @Value("${app.principal-dashboard.min-cohort-size:10}")
    private int minCohortSize;

    @Value("${app.principal-dashboard.stale-after-new-students:25}")
    private int staleThreshold;

    public PrincipalDashboardReleaseService(
            PrincipalDashboardDataRepository repository,
            StudentAssessmentMappingRepository mappingRepository,
            StudentGroupMemberRepository groupMemberRepository,
            PrincipalDashboardScopeCalculator calculator,
            PrincipalDashboardAiService aiService,
            ObjectMapper objectMapper) {
        this.repository = repository;
        this.mappingRepository = mappingRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.calculator = calculator;
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    /** What {@link #prepareRelease} tells the caller. */
    public static final class ReleasePlan {
        public String releaseId;
        public int scopeCount;
        public boolean accepted;
        public String reason;

        static ReleasePlan rejected(String reason) {
            ReleasePlan p = new ReleasePlan();
            p.accepted = false;
            p.reason = reason;
            return p;
        }
    }

    /**
     * Preview what a release would do, without writing anything. Backs the
     * confirmation dialog so the admin is told the size of the job — and whether it
     * overwrites an existing release — before committing to it.
     */
    @Transactional(readOnly = true)
    public ReleasePlan preview(Long instituteCode, Long assessmentId) {
        ReleasePlan plan = new ReleasePlan();
        plan.accepted = repository.countInFlight(instituteCode, assessmentId) == 0;
        plan.reason = plan.accepted ? null : "A release for this school is already running.";
        plan.scopeCount = buildLattice(instituteCode, assessmentId).size();
        return plan;
    }

    /**
     * Claim the release and write one PENDING row per scope.
     *
     * <p>Runs in its own transaction and commits before the async worker starts, so
     * the worker never races the rows it is about to read. The in-flight check plus
     * the unique constraint on (institute_code, scope_key) is what makes a double
     * click harmless.
     */
    @Transactional
    public ReleasePlan prepareRelease(Long instituteCode, Long assessmentId, Long triggeredBy) {
        if (repository.countInFlight(instituteCode, assessmentId) > 0) {
            return ReleasePlan.rejected("A release for this school is already running.");
        }

        List<ScopeKey> scopes = buildLattice(instituteCode, assessmentId);
        if (scopes.isEmpty()) {
            return ReleasePlan.rejected("No scoreable students found for this assessment.");
        }

        String releaseId = UUID.randomUUID().toString();

        for (ScopeKey scope : scopes) {
            PrincipalDashboardData row = repository
                    .findByInstituteCodeAndScopeKey(instituteCode, scope.key())
                    .orElseGet(PrincipalDashboardData::new);

            // A re-release reuses the row so the unique constraint holds and the
            // previous content stays readable until this scope is regenerated.
            row.setInstituteCode(instituteCode);
            row.setAssessmentId(assessmentId);
            row.setScopeKey(scope.key());
            row.setScopeLevel(scope.level());
            row.setSessionId(scope.getSessionId());
            row.setClassId(scope.getClassId());
            row.setSectionId(scope.getSectionId());
            row.setGroupId(scope.getGroupId());
            row.setGenerationStatus(PrincipalDashboardData.STATUS_PENDING);
            row.setErrorMessage(null);
            row.setReleaseId(releaseId);
            row.setGeneratedBy(triggeredBy);
            repository.save(row);
        }

        ReleasePlan plan = new ReleasePlan();
        plan.accepted = true;
        plan.releaseId = releaseId;
        plan.scopeCount = scopes.size();
        return plan;
    }

    /**
     * Generate every scope of a release. Off-thread: ~25 OpenAI round trips will not
     * fit inside an HTTP request.
     */
    @Async("applicationTaskExecutor")
    public void runReleaseAsync(String releaseId) {
        List<PrincipalDashboardData> rows = repository.findByReleaseId(releaseId);
        log.info("Principal dashboard release {}: generating {} scopes", releaseId, rows.size());

        int ok = 0, skipped = 0, failed = 0;
        for (PrincipalDashboardData row : rows) {
            try {
                String outcome = generateOneScope(row.getId());
                if (PrincipalDashboardData.STATUS_GENERATED.equals(outcome)) ok++;
                else skipped++;
            } catch (Exception e) {
                failed++;
                // Per-scope failure: record it on the row and keep going. One bad
                // OpenAI call must not cost the other scopes their generation.
                markFailed(row.getId(), e);
                log.warn("Principal dashboard release {}: scope {} failed: {}",
                        releaseId, row.getScopeKey(), e.toString());
            }
        }
        log.info("Principal dashboard release {} finished: {} generated, {} skipped, {} failed",
                releaseId, ok, skipped, failed);
    }

    /**
     * Generate a single scope. Its own transaction so each scope commits on its own —
     * a failure at scope 20 leaves the first 19 readable.
     *
     * @return the status the row ended in
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateOneScope(Long rowId) {
        PrincipalDashboardData row = repository.findById(rowId).orElse(null);
        if (row == null) return PrincipalDashboardData.STATUS_FAILED;

        row.setGenerationStatus(PrincipalDashboardData.STATUS_GENERATING);
        repository.save(row);

        ScopeKey scope = ScopeKey.of(row.getAssessmentId(), row.getSessionId(),
                row.getClassId(), row.getSectionId(), row.getGroupId());

        // 1. Deterministic half — the same producers the Mira Desai exports use.
        PrincipalDashboardScopeCalculator.ScopeResult result =
                calculator.compute(row.getInstituteCode(), scope);

        row.setInternalCalculation(writeJson(result.payload));
        row.setScoredCount(result.scoredCount);
        row.setScoredAtGeneration(result.scoredCount);
        row.setMinCohortSize(minCohortSize);
        row.setStaleThreshold(staleThreshold);
        row.setLogicVersion(LOGIC_VERSION);
        row.setGeneratedAt(new Date());

        // 2. Expensive half — withheld below the floor. A narrative over four students
        //    is statistically meaningless, and "the one student aiming at Commerce"
        //    names a child to anyone at that school.
        if (result.scoredCount < minCohortSize) {
            row.setAiResponse(null);
            row.setPromptVersion(null);
            row.setGenerationStatus(PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT);
            repository.save(row);
            return PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT;
        }

        PrincipalDashboardAiService.AiResult ai = aiService.generate(result.payload, scope);
        row.setAiResponse(ai.json);
        row.setPromptVersion(ai.promptVersion);
        row.setGenerationStatus(PrincipalDashboardData.STATUS_GENERATED);
        repository.save(row);
        return PrincipalDashboardData.STATUS_GENERATED;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long rowId, Exception cause) {
        repository.findById(rowId).ifPresent(row -> {
            row.setGenerationStatus(PrincipalDashboardData.STATUS_FAILED);
            String msg = cause.getMessage();
            row.setErrorMessage(msg == null ? cause.toString()
                    : msg.substring(0, Math.min(msg.length(), 1000)));
            repository.save(row);
        });
    }

    /**
     * Derive the populated lattice from the roster.
     *
     * <p>Only students who have actually completed the assessment count: an empty
     * section that exists in the lookup tables must never become a scope.
     */
    private List<ScopeKey> buildLattice(Long instituteCode, Long assessmentId) {
        List<StudentAssessmentMapping> mappings =
                mappingRepository.findAllByInstituteCode(instituteCode.intValue());

        List<ScopeLattice.RosterEntry> roster = new ArrayList<>();
        Set<Long> studentIds = new LinkedHashSet<>();

        for (StudentAssessmentMapping m : mappings) {
            if (!assessmentId.equals(m.getAssessmentId())) continue;
            // Only completed sittings shape the lattice. A section whose students are
            // all still mid-assessment has nothing to report on yet.
            String status = m.getStatus() == null ? "" : m.getStatus().trim().toLowerCase();
            if (!"completed".equals(status)) continue;
            UserStudent us = m.getUserStudent();
            if (us == null) continue;
            StudentInfo info = us.getStudentInfo();
            if (info == null) continue;

            studentIds.add(us.getUserStudentId());
            roster.add(new ScopeLattice.RosterEntry(
                    longOf(info.getSessionId()),
                    longOf(info.getStudentClass()),
                    longOf(info.getSchoolSectionId())));
        }

        Set<Long> groupIds = new HashSet<>();
        if (!studentIds.isEmpty()) {
            groupIds.addAll(groupMemberRepository.findDistinctGroupIdsByStudentIds(
                    new ArrayList<>(studentIds)));
        }

        return ScopeLattice.build(assessmentId, roster, groupIds);
    }

    private static Long longOf(Number n) {
        return n == null ? null : n.longValue();
    }

    private String writeJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            log.warn("Principal dashboard: could not serialise payload", e);
            return null;
        }
    }

    /** Read-side helper: does this institute have anything released at all? */
    @Transactional(readOnly = true)
    public Optional<PrincipalDashboardData> findScope(Long instituteCode, ScopeKey scope) {
        return repository.findByInstituteCodeAndScopeKey(instituteCode, scope.key());
    }
}
