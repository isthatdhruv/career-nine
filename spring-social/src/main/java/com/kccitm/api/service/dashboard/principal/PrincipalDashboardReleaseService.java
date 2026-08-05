package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.group.StudentGroup;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.school.SchoolSession;
import com.kccitm.api.repository.Career9.PrincipalDashboardDataRepository;
import com.kccitm.api.repository.Career9.StudentGroupMemberRepository;
import com.kccitm.api.repository.Career9.StudentGroupRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredStudent;

/**
 * Releases a school dashboard: generates the scopes an admin selected for one
 * institute+assessment, in one batch tagged with a shared {@code releaseId}.
 *
 * <p>Shape of a release:
 * <ol>
 *   <li>{@link #prepareRelease} runs synchronously inside the request. It scores the
 *       institute <em>once</em>, expands the selection, classifies every scope against
 *       what is already stored, writes one PENDING row per scope that will actually be
 *       generated, and commits. The caller gets a releaseId back immediately.</li>
 *   <li>{@link #runReleaseAsync} then walks those rows off-thread, using the same
 *       snapshot. Generation involves an OpenAI round trip per scope, so it cannot live
 *       inside the HTTP request.</li>
 * </ol>
 *
 * <p><b>One snapshot, start to finish.</b> Scoring reads the whole cohort's answers, so
 * doing it per scope is the expensive mistake; doing it twice within a release is also
 * how two scopes end up disagreeing about who is in 10-A. It is built once and carried
 * through.
 *
 * <p><b>Status is per scope, never per release.</b> One scope failing its OpenAI call
 * must not void the others, and a retry targets that row alone.
 *
 * <p><b>Nothing regenerates on its own.</b> Every release is an admin action. The
 * conditions in {@link #classify} decide only what that action is allowed to spend.
 */
@Service
public class PrincipalDashboardReleaseService {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardReleaseService.class);

    private final PrincipalDashboardDataRepository repository;
    private final StudentAssessmentMappingRepository mappingRepository;
    private final StudentGroupMemberRepository groupMemberRepository;
    private final StudentGroupRepository groupRepository;
    private final InstituteDetailRepository instituteRepository;
    private final CounsellingAppointmentRepository appointmentRepository;
    private final SchoolDashboardDataService dashboardDataService;
    private final PrincipalDashboardScopeCalculator calculator;
    private final PrincipalDashboardRequestBuilder requestBuilder;
    private final PrincipalDashboardAiService aiService;
    private final ObjectMapper objectMapper;

    /**
     * This service through its own proxy.
     *
     * <p>{@code @Transactional} is applied by a proxy, so a plain {@code this.method()}
     * call inside the class skips it entirely. {@link #generateOneScope} and
     * {@link #markFailed} both declare {@code REQUIRES_NEW} precisely so one scope's
     * failure cannot roll back the scopes before it — a guarantee that only exists if
     * they are reached through the proxy. Lazy, because a bean cannot inject itself
     * eagerly.
     */
    @Autowired
    @Lazy
    private PrincipalDashboardReleaseService self;

    @Value("${app.principal-dashboard.min-cohort-size:10}")
    private int minCohortSize;

    /** New scored students in a scope before a refresh is justified. */
    @Value("${app.principal-dashboard.stale-after-new-students:25}")
    private int staleThreshold;

    /** Rate limit: how long a generated scope stays current regardless of new students. */
    @Value("${app.principal-dashboard.refresh-cooldown-hours:24}")
    private int refreshCooldownHours;

    public PrincipalDashboardReleaseService(
            PrincipalDashboardDataRepository repository,
            StudentAssessmentMappingRepository mappingRepository,
            StudentGroupMemberRepository groupMemberRepository,
            StudentGroupRepository groupRepository,
            InstituteDetailRepository instituteRepository,
            CounsellingAppointmentRepository appointmentRepository,
            SchoolDashboardDataService dashboardDataService,
            PrincipalDashboardScopeCalculator calculator,
            PrincipalDashboardRequestBuilder requestBuilder,
            PrincipalDashboardAiService aiService,
            ObjectMapper objectMapper) {
        this.repository = repository;
        this.mappingRepository = mappingRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupRepository = groupRepository;
        this.instituteRepository = instituteRepository;
        this.appointmentRepository = appointmentRepository;
        this.dashboardDataService = dashboardDataService;
        this.calculator = calculator;
        this.requestBuilder = requestBuilder;
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    // ─────────────────────────── classification ───────────────────────────

    /**
     * What a release would do to one scope.
     *
     * <p>Only {@link #UNCHANGED} and {@link #SKIPPED_SMALL_COHORT} avoid an OpenAI call.
     * Metrics are recomputed for every scope either way — after the snapshot they cost a
     * filter and an aggregate, so there is no reason for a principal to read stale
     * numbers just because the narrative is still current.
     */
    public enum Verdict {
        /** No row yet. */
        NEW,
        /** Last attempt failed. A failure is never "current", so it always retries. */
        RETRY,
        /** Enough new students, and past the cooldown. */
        REFRESH,
        /**
         * Was below the cohort floor and now clears it. Crossing the floor can take far
         * fewer students than the refresh threshold, so it is checked separately —
         * otherwise a section that grew from 8 to 12 would wait for 25 more.
         */
        NOW_ELIGIBLE,
        /** Generated, and nothing has moved. Metrics refresh; the narrative does not. */
        UNCHANGED,
        /** Below the narrative floor. Metrics only. */
        SKIPPED_SMALL_COHORT,
        /** Explicitly selected, but nobody is in it. */
        EMPTY
    }

    /**
     * One scope's verdict, for the confirmation dialog.
     *
     * <p>Carries the dimension ids as well as the key so the dialog can build its
     * session/class/section selectors from a single whole-school preview and then narrow
     * client-side. Re-previewing on every dropdown change would mean re-scoring the
     * school to answer a question the first preview already contains.
     */
    public static final class ScopePlanItem {
        public String scopeKey;
        public String scopeLabel;
        public String scopeLevel;
        public Long sessionId;
        public Long classId;
        public Long sectionId;
        public Long groupId;
        public Verdict verdict;
        public int scoredCount;
        public int totalCount;
        /** Whether this scope will cost an OpenAI call. */
        public boolean generatesNarrative;
    }

    /** What {@link #preview} and {@link #prepareRelease} tell the caller. */
    public static final class ReleasePlan {
        public String releaseId;
        public boolean accepted;
        public String reason;
        /** Scopes the release touches, including metric-only ones. */
        public int scopeCount;
        /** Scopes that will call OpenAI — the part that costs money. */
        public int narrativeCount;
        /** The floor actually in force for this plan. */
        public int minCohortSize;
        /** The configured floor, so the dialog can say what the override is overriding. */
        public int configuredMinCohortSize;
        public boolean cohortFloorIgnored;
        public int staleThreshold;
        public int refreshCooldownHours;
        public Map<String, Integer> byVerdict = new LinkedHashMap<>();
        public List<ScopePlanItem> scopes = new ArrayList<>();
        public Date existingGeneratedAt;

        /** Carried to the async worker so generation sees exactly what was planned. */
        @JsonIgnore
        public transient ReleaseSnapshot snapshot;

        static ReleasePlan rejected(String reason) {
            ReleasePlan p = new ReleasePlan();
            p.accepted = false;
            p.reason = reason;
            return p;
        }
    }

    /**
     * Classify one scope against what is already stored.
     *
     * <p>The refresh gate is {@code (enough new students) AND (past the cooldown)}. Data
     * change is what justifies the spend; the cooldown is what stops a regeneration loop.
     * Time alone is not a trigger — 24 hours passing does not make identical numbers
     * worth re-narrating.
     *
     * <p>Force bypasses both. It is the escape hatch for "the roster was wrong, redo it
     * now", and because a release overwrites with no version to fall back to, it carries
     * its own confirmation upstream.
     */
    private Verdict classify(PrincipalDashboardData existing, int scoredCount, int totalCount,
                             boolean force, int effectiveFloor, Date now) {
        if (totalCount == 0) {
            return Verdict.EMPTY;
        }
        // No scored students means nothing to write about, whatever the floor is set to.
        if (scoredCount == 0 || scoredCount < effectiveFloor) {
            return Verdict.SKIPPED_SMALL_COHORT;
        }
        if (existing == null) {
            return Verdict.NEW;
        }
        String status = existing.getGenerationStatus();
        if (PrincipalDashboardData.STATUS_FAILED.equals(status)) {
            return Verdict.RETRY;
        }
        if (PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT.equals(status)) {
            return Verdict.NOW_ELIGIBLE;
        }
        if (!PrincipalDashboardData.STATUS_GENERATED.equals(status)) {
            // PENDING or GENERATING left behind by an interrupted run — never generated.
            return Verdict.NEW;
        }
        if (force) {
            return Verdict.REFRESH;
        }
        boolean enoughNew = existing.newStudentsSince(scoredCount) >= staleThreshold;
        boolean pastCooldown = existing.hoursSinceGeneration(now) >= refreshCooldownHours;
        return enoughNew && pastCooldown ? Verdict.REFRESH : Verdict.UNCHANGED;
    }

    private static boolean spendsMoney(Verdict v) {
        return v == Verdict.NEW || v == Verdict.RETRY
                || v == Verdict.REFRESH || v == Verdict.NOW_ELIGIBLE;
    }

    // ───────────────────────────── snapshot ─────────────────────────────

    /**
     * Score the institute once and gather everything a release needs to name and narrate
     * its scopes.
     */
    @Transactional(readOnly = true)
    public ReleaseSnapshot buildSnapshot(Long instituteCode, Long assessmentId) {
        SchoolDashboardDataService.ScoredRoster roster =
                dashboardDataService.buildScoredRoster(instituteCode.intValue(), assessmentId);

        List<Long> studentIds = new ArrayList<>(roster.students.size());
        for (ScoredStudent s : roster.students) {
            studentIds.add(s.userStudentId);
        }

        Map<Long, List<Long>> groupsByStudent = new LinkedHashMap<>();
        Set<Long> counselled = new HashSet<>();
        if (!studentIds.isEmpty()) {
            for (Object[] row : groupMemberRepository.findGroupIdsByStudentIds(studentIds)) {
                Long studentId = ((Number) row[0]).longValue();
                Long groupId = ((Number) row[1]).longValue();
                groupsByStudent.computeIfAbsent(studentId, k -> new ArrayList<>()).add(groupId);
            }
            counselled.addAll(appointmentRepository.findCounselledStudentIds(studentIds));
        }

        InstituteDetail institute = null;
        List<InstituteDetail> found = instituteRepository.findByInstituteCode(instituteCode.intValue());
        if (found != null && !found.isEmpty()) {
            institute = found.get(0);
        }

        Map<Long, String> sessionNames = new LinkedHashMap<>();
        if (institute != null && institute.getSchoolSession() != null) {
            for (SchoolSession session : institute.getSchoolSession()) {
                if (session != null && session.getId() != null) {
                    sessionNames.put(session.getId().longValue(), session.getSessionYear());
                }
            }
        }

        Map<Long, String> groupNames = new LinkedHashMap<>();
        for (StudentGroup group : groupRepository
                .findByInstitute_InstituteCodeOrderByNameAsc(instituteCode.intValue())) {
            if (group != null && group.getId() != null) {
                groupNames.put(group.getId(), group.getName());
            }
        }

        // Flattened here, while the session is still open. Carrying the entity itself
        // into the snapshot means its lazy associations blow up on the async thread.
        return new ReleaseSnapshot(roster, groupsByStudent,
                ReleaseSnapshot.InstituteProfile.of(institute),
                sessionNames, groupNames, counselled);
    }

    // ───────────────────────────── planning ─────────────────────────────

    /**
     * What a release would do, without doing it.
     *
     * <p>Reports consequences rather than a bare count: how many scopes are new, how many
     * will be refreshed, how many are already current, how many sit below the floor — so
     * an admin sees the spend before committing to it.
     */
    @Transactional(readOnly = true)
    public ReleasePlan preview(Long instituteCode, Long assessmentId,
                               ScopeExpansion.Selection selection, boolean force,
                               boolean ignoreCohortFloor) {
        if (repository.countInFlight(instituteCode, assessmentId) > 0) {
            return ReleasePlan.rejected("A release for this school is already running.");
        }
        ReleaseSnapshot snapshot = buildSnapshot(instituteCode, assessmentId);
        return plan(instituteCode, assessmentId, selection, force, ignoreCohortFloor, snapshot);
    }

    /**
     * The cohort size a scope needs before it is narrated.
     *
     * <p>Overriding it is a real decision, not a formality. Below roughly ten students a
     * narrative stops describing a cohort and starts describing people — "the one student
     * aiming at Commerce" names a child to anyone at that school — and percentages over
     * six students carry no useful precision. One student is the floor even when the
     * override is on, because a scope with nobody scored has nothing to write about.
     */
    private int effectiveFloor(boolean ignoreCohortFloor) {
        return ignoreCohortFloor ? 1 : minCohortSize;
    }

    private ReleasePlan plan(Long instituteCode, Long assessmentId,
                             ScopeExpansion.Selection selection, boolean force,
                             boolean ignoreCohortFloor, ReleaseSnapshot snapshot) {
        int floor = effectiveFloor(ignoreCohortFloor);

        ReleasePlan plan = new ReleasePlan();
        plan.accepted = true;
        plan.minCohortSize = floor;
        plan.configuredMinCohortSize = minCohortSize;
        plan.cohortFloorIgnored = ignoreCohortFloor;
        plan.staleThreshold = staleThreshold;
        plan.refreshCooldownHours = refreshCooldownHours;
        plan.snapshot = snapshot;

        Map<String, PrincipalDashboardData> existing = new LinkedHashMap<>();
        for (PrincipalDashboardData row :
                repository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId)) {
            existing.put(row.getScopeKey(), row);
            if (row.getGeneratedAt() != null
                    && (plan.existingGeneratedAt == null
                        || row.getGeneratedAt().after(plan.existingGeneratedAt))) {
                plan.existingGeneratedAt = row.getGeneratedAt();
            }
        }

        Date now = new Date();
        for (ScopeKey scope : ScopeExpansion.expand(selection, snapshot)) {
            ReleaseSnapshot.Cohort cohort = ReleaseSnapshot.cohortOf(snapshot.inScope(scope));

            ScopePlanItem item = new ScopePlanItem();
            item.scopeKey = scope.key();
            item.scopeLabel = snapshot.labelFor(scope);
            item.scopeLevel = scope.level();
            item.sessionId = scope.getSessionId();
            item.classId = scope.getClassId();
            item.sectionId = scope.getSectionId();
            item.groupId = scope.getGroupId();
            item.scoredCount = cohort.scored;
            item.totalCount = cohort.total;
            item.verdict = classify(existing.get(scope.key()), cohort.scored, cohort.total,
                    force, floor, now);
            item.generatesNarrative = spendsMoney(item.verdict);

            plan.scopes.add(item);
            plan.byVerdict.merge(item.verdict.name(), 1, Integer::sum);
            if (item.generatesNarrative) plan.narrativeCount++;
        }
        plan.scopeCount = plan.scopes.size();

        if (plan.scopes.isEmpty()) {
            plan.accepted = false;
            plan.reason = "No scoreable students found for this assessment.";
        }
        return plan;
    }

    /**
     * Claim the release and write one row per scope.
     *
     * <p>Runs in its own transaction and commits before the async worker starts, so the
     * worker never races the rows it is about to read. The in-flight check plus the
     * unique constraint on (institute_code, scope_key) is what makes a double click
     * harmless.
     *
     * <p>{@code EMPTY} scopes are dropped rather than stored: a scope with nobody in it
     * is a selection mistake, not a result.
     */
    @Transactional
    public ReleasePlan prepareRelease(Long instituteCode, Long assessmentId,
                                      ScopeExpansion.Selection selection, boolean force,
                                      boolean ignoreCohortFloor, Long triggeredBy) {
        if (repository.countInFlight(instituteCode, assessmentId) > 0) {
            return ReleasePlan.rejected("A release for this school is already running.");
        }

        ReleaseSnapshot snapshot = buildSnapshot(instituteCode, assessmentId);
        ReleasePlan plan = plan(instituteCode, assessmentId, selection, force,
                ignoreCohortFloor, snapshot);
        if (!plan.accepted) {
            return plan;
        }

        String releaseId = UUID.randomUUID().toString();
        int written = 0;
        for (ScopePlanItem item : plan.scopes) {
            if (item.verdict == Verdict.EMPTY) continue;

            PrincipalDashboardData row = repository
                    .findByInstituteCodeAndScopeKey(instituteCode, item.scopeKey)
                    .orElseGet(PrincipalDashboardData::new);

            ScopeKey scope = parseScope(assessmentId, item.scopeKey);
            row.setInstituteCode(instituteCode);
            row.setAssessmentId(assessmentId);
            row.setScopeKey(item.scopeKey);
            row.setScopeLevel(item.scopeLevel);
            row.setScopeLabel(item.scopeLabel);
            row.setSessionId(scope.getSessionId());
            row.setClassId(scope.getClassId());
            row.setSectionId(scope.getSectionId());
            row.setGroupId(scope.getGroupId());
            row.setGenerationStatus(PrincipalDashboardData.STATUS_PENDING);
            row.setErrorMessage(null);
            row.setReleaseId(releaseId);
            row.setGeneratedBy(triggeredBy);
            // The floor this release runs under is recorded on the row rather than
            // carried to the worker: generation then applies the same rule the plan was
            // shown against, and the stored row says which floor produced it.
            row.setMinCohortSize(plan.minCohortSize);
            repository.save(row);
            written++;
        }

        if (written == 0) {
            return ReleasePlan.rejected("Nothing to release — no scope in this selection has students.");
        }

        // This assessment is now the one the school's dashboard shows.
        repository.markCurrentAssessment(instituteCode, assessmentId);

        plan.releaseId = releaseId;
        plan.scopeCount = written;
        log.info("Principal dashboard release {}: {} scopes claimed, {} will be narrated",
                releaseId, written, plan.narrativeCount);
        return plan;
    }

    // ───────────────────────────── generation ─────────────────────────────

    /**
     * Generate every scope of a release. Off-thread: many OpenAI round trips will not fit
     * inside an HTTP request.
     *
     * <p>Takes the snapshot the plan was built from, so what is generated is what was
     * previewed — not whatever the roster looks like by the time the worker starts.
     */
    @Async("applicationTaskExecutor")
    public void runReleaseAsync(String releaseId, ReleaseSnapshot snapshot) {
        List<PrincipalDashboardData> rows = repository.findByReleaseId(releaseId);
        log.info("Principal dashboard release {}: generating {} scopes", releaseId, rows.size());

        // The institute scope is what every other scope is written against, so it is
        // computed once here rather than recomputed inside each one.
        Map<String, Object> baselineSheets = null;
        Map<String, Object> event = null;
        try {
            PrincipalDashboardScopeCalculator.ScopeResult institute =
                    calculator.compute(snapshot, ScopeKey.institute(snapshot.assessmentId()));
            baselineSheets = institute.sheets;
            event = buildEvent(snapshot);
        } catch (Exception e) {
            log.warn("Principal dashboard release {}: baseline unavailable, scopes will be "
                    + "narrated without a school-wide comparison: {}", releaseId, e.toString());
        }

        int ok = 0, skipped = 0, failed = 0;
        for (PrincipalDashboardData row : rows) {
            try {
                // Through the proxy, so each scope really does get its own transaction.
                String outcome = self.generateOneScope(row.getId(), snapshot, baselineSheets, event);
                if (PrincipalDashboardData.STATUS_GENERATED.equals(outcome)) ok++;
                else skipped++;
            } catch (Exception e) {
                failed++;
                // Per-scope failure: record it on the row and keep going. One bad OpenAI
                // call must not cost the other scopes their generation.
                self.markFailed(row.getId(), e);
                log.warn("Principal dashboard release {}: scope {} failed: {}",
                        releaseId, row.getScopeKey(), e.toString());
            }
        }
        log.info("Principal dashboard release {} finished: {} generated, {} skipped, {} failed",
                releaseId, ok, skipped, failed);
    }

    /**
     * Generate a single scope. Its own transaction so each scope commits on its own — a
     * failure at scope 20 leaves the first 19 readable.
     *
     * <p>Metrics are written before the OpenAI call. An outage then leaves a dashboard
     * with fresh numbers and no narrative, rather than no dashboard.
     *
     * @return the status the row ended in
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateOneScope(Long rowId, ReleaseSnapshot snapshot,
                                   Map<String, Object> baselineSheets, Map<String, Object> event) {
        PrincipalDashboardData row = repository.findById(rowId).orElse(null);
        if (row == null) return PrincipalDashboardData.STATUS_FAILED;

        row.setGenerationStatus(PrincipalDashboardData.STATUS_GENERATING);
        repository.save(row);

        ScopeKey scope = ScopeKey.of(row.getAssessmentId(), row.getSessionId(),
                row.getClassId(), row.getSectionId(), row.getGroupId());

        // 1. Deterministic half — a filter over the snapshot, then the same aggregation
        //    the Mira Desai dashboard export uses.
        PrincipalDashboardScopeCalculator.ScopeResult result = calculator.compute(snapshot, scope);

        row.setInternalCalculation(writeJson(result.payload));
        row.setScoredCount(result.scoredCount);
        row.setScoredAtGeneration(result.scoredCount);
        row.setStaleThreshold(staleThreshold);
        row.setLogicVersion(PrincipalDashboardScopeCalculator.LOGIC_VERSION);
        row.setGeneratedAt(new Date());

        // 2. Expensive half — withheld below the floor. A narrative over four students is
        //    statistically meaningless, and "the one student aiming at Commerce" names a
        //    child to anyone at that school.
        //
        //    The floor comes off the row, written when the release was planned, so
        //    generation cannot apply a stricter rule than the admin was shown — and an
        //    override is recorded on the row it produced.
        int floor = row.getMinCohortSize() == null ? minCohortSize : row.getMinCohortSize();
        if (result.scoredCount == 0 || result.scoredCount < floor) {
            row.setAiResponse(null);
            row.setPromptVersion(null);
            row.setGenerationStatus(PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT);
            repository.save(row);
            return PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT;
        }

        // The institute compares against nothing; every other scope compares against it.
        Map<String, Object> baseline =
                PrincipalDashboardData.LEVEL_INSTITUTE.equals(scope.level()) ? null : baselineSheets;

        Map<String, Object> request = requestBuilder.build(
                result.payload, baseline, event, scope.level());

        PrincipalDashboardAiService.AiResult ai = aiService.generate(request, scope);
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

    // ───────────────────────────── helpers ─────────────────────────────

    /**
     * Programme facts for the whole institute.
     *
     * <p>"Counselled" means a completed appointment, not an assigned counsellor — the
     * figure is printed in a school's report, and an assignment is not a session. What
     * the system does not record — the windows, session duration, teacher-training notes
     * — is declared in the request's {@code pending} block rather than guessed at.
     */
    private Map<String, Object> buildEvent(ReleaseSnapshot snapshot) {
        List<ScoredStudent> all = snapshot.allStudents();
        ReleaseSnapshot.Cohort cohort = ReleaseSnapshot.cohortOf(all);

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("students_assessed", cohort.completed);
        event.put("students_counselled", snapshot.counselledAmong(all));
        event.put("assessment_window", null);
        event.put("counselling_window", null);
        event.put("session_duration", null);
        event.put("teacher_training_observations", new ArrayList<String>());
        return event;
    }

    /** Rebuild a scope from its stored key, for rows read back out of the table. */
    static ScopeKey parseScope(Long assessmentId, String key) {
        Long session = null, klass = null, section = null, group = null;
        for (String part : key.split("\\|")) {
            int colon = part.indexOf(':');
            if (colon < 0) continue;
            String field = part.substring(0, colon);
            String value = part.substring(colon + 1);
            if ("null".equals(value)) continue;
            Long parsed;
            try {
                parsed = Long.valueOf(value);
            } catch (NumberFormatException e) {
                continue;
            }
            switch (field) {
                case "s": session = parsed; break;
                case "c": klass = parsed; break;
                case "x": section = parsed; break;
                case "g": group = parsed; break;
                default: break;
            }
        }
        return ScopeKey.of(assessmentId, session, klass, section, group);
    }

    private String writeJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            log.warn("Principal dashboard: could not serialise payload", e);
            return null;
        }
    }

    /** Read-side helper: does this institute have this scope released? */
    @Transactional(readOnly = true)
    public Optional<PrincipalDashboardData> findScope(Long instituteCode, ScopeKey scope) {
        return repository.findByInstituteCodeAndScopeKey(instituteCode, scope.key());
    }

    /**
     * Students currently scored in one scope — the live half of the refresh gate.
     *
     * <p>Counted now rather than read from a column, because both stored counts are
     * written in the same transaction at generation and can never differ from each other.
     * Completion is what is counted here; whether scoring succeeds is only knowable by
     * scoring, which is too expensive for a read.
     */
    @Transactional(readOnly = true)
    public int liveScoredCount(Long instituteCode, Long assessmentId, ScopeKey scope) {
        List<Long> groupMembers = scope.getGroupId() == null ? null
                : groupMemberRepository.findUserStudentIdsByGroupId(scope.getGroupId());

        int count = 0;
        for (StudentAssessmentMapping m :
                mappingRepository.findAllByInstituteCode(instituteCode.intValue())) {
            if (!assessmentId.equals(m.getAssessmentId())) continue;
            String status = m.getStatus() == null ? "" : m.getStatus().trim().toLowerCase();
            if (!"completed".equals(status)) continue;
            UserStudent us = m.getUserStudent();
            if (us == null || us.getStudentInfo() == null) continue;

            if (groupMembers != null) {
                if (!groupMembers.contains(us.getUserStudentId())) continue;
            } else {
                if (!dimMatches(scope.getSessionId(), us.getStudentInfo().getSessionId())) continue;
                if (!dimMatches(scope.getClassId(), us.getStudentInfo().getStudentClass())) continue;
                if (!dimMatches(scope.getSectionId(), us.getStudentInfo().getSchoolSectionId())) continue;
            }
            count++;
        }
        return count;
    }

    private static boolean dimMatches(Long scopeDim, Number studentDim) {
        if (scopeDim == null) return true;
        if (studentDim == null) return false;
        return scopeDim.longValue() == studentDim.longValue();
    }

    public int getMinCohortSize() { return minCohortSize; }
    public int getStaleThreshold() { return staleThreshold; }
    public int getRefreshCooldownHours() { return refreshCooldownHours; }
}
