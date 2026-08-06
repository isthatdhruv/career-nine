package com.kccitm.api.controller.dashboard;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.service.dashboard.principal.PrincipalDashboardNotificationService;
import com.kccitm.api.service.dashboard.principal.PrincipalDashboardReleaseLogger;
import com.kccitm.api.model.career9.PrincipalDashboardReleaseLog;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.PrincipalDashboardDataRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.dashboard.principal.PrincipalDashboardChartLogger;
import com.kccitm.api.service.dashboard.principal.PrincipalDashboardReleaseService;
import com.kccitm.api.service.dashboard.principal.ScopeExpansion;
import com.kccitm.api.service.dashboard.principal.ScopeKey;

/**
 * Release and read the per-scope principal dashboards.
 *
 * <p>Three concerns, deliberately separate endpoints: previewing a release (so the
 * confirmation dialog can state what it will do and what it will cost), triggering one
 * (async, returns immediately), and reading a single scope (a pure lookup — no
 * computation on the read path).
 *
 * <p>The release endpoints take a <em>selection</em> rather than a size. An admin picks a
 * point on the academic hierarchy, a set of groups, or everything; the backend expands
 * that downward — selecting Class 10 releases 10, 10-A, 10-B and 10-C — so a filter the
 * dashboard offers is never one the release skipped.
 *
 * <p>Named for the release pipeline rather than "PrincipalDashboardController" because
 * {@code com.kccitm.api.controller.principal.PrincipalDashboardController} already owns
 * that simple name — component scanning derives bean names from the simple name, so two
 * classes called the same thing abort startup with a ConflictingBeanDefinitionException.
 */
@RestController
@RequestMapping("/dashboard/principal")
public class PrincipalDashboardReleaseController {

    private final PrincipalDashboardReleaseService releaseService;
    private final PrincipalDashboardDataRepository repository;
    private final UserStudentRepository userStudentRepository;
    private final ObjectMapper objectMapper;
    /** TEMPORARY — remove with the /log-chart-data endpoint. */
    private final PrincipalDashboardChartLogger chartLogger;
    private final PrincipalDashboardReleaseLogger trace;
    private final PrincipalDashboardNotificationService notifications;

    public PrincipalDashboardReleaseController(PrincipalDashboardReleaseService releaseService,
                                               PrincipalDashboardDataRepository repository,
                                               UserStudentRepository userStudentRepository,
                                               ObjectMapper objectMapper,
                                               PrincipalDashboardChartLogger chartLogger,
                                               PrincipalDashboardReleaseLogger trace,
                                               PrincipalDashboardNotificationService notifications) {
        this.releaseService = releaseService;
        this.repository = repository;
        this.userStudentRepository = userStudentRepository;
        this.objectMapper = objectMapper;
        this.chartLogger = chartLogger;
        this.trace = trace;
        this.notifications = notifications;
    }

    /**
     * Build the selection an admin made.
     *
     * <p>{@code ALL} covers both axes; {@code GROUPS} covers groups alone; anything else
     * is the academic axis, narrowed by whichever of session/class/section was supplied.
     * An unrecognised value falls back to the academic axis rather than silently widening
     * to everything.
     */
    private static ScopeExpansion.Selection selectionOf(String mode, Long sessionId, Long classId,
                                                        Long sectionId, List<Long> groupIds) {
        String requested = mode == null ? "" : mode.trim().toUpperCase();
        if ("ALL".equals(requested)) {
            return ScopeExpansion.Selection.all();
        }
        if ("GROUPS".equals(requested)) {
            return ScopeExpansion.Selection.groups(groupIds);
        }
        return ScopeExpansion.Selection.academic(sessionId, classId, sectionId);
    }

    /**
     * What a release would do, without doing it.
     *
     * <p>Reports consequences rather than a bare scope count: how many scopes are new,
     * refreshed, already current, or below the narrative floor — and how many will
     * actually call OpenAI, which is the only number that costs anything.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/preview")
    public ResponseEntity<?> preview(@PathVariable Long instituteCode,
                                     @RequestParam Long assessmentId,
                                     @RequestParam(required = false, defaultValue = "ALL") String mode,
                                     @RequestParam(required = false) Long sessionId,
                                     @RequestParam(required = false) Long classId,
                                     @RequestParam(required = false) Long sectionId,
                                     @RequestParam(required = false) List<Long> groupIds,
                                     @RequestParam(required = false, defaultValue = "false") boolean force,
                                     @RequestParam(required = false, defaultValue = "false")
                                     boolean ignoreCohortFloor) {

        PrincipalDashboardReleaseService.ReleasePlan plan = releaseService.preview(
                instituteCode, assessmentId,
                selectionOf(mode, sessionId, classId, sectionId, groupIds), force, ignoreCohortFloor);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("canRelease", plan.accepted);
        out.put("reason", plan.reason);
        out.put("scopeCount", plan.scopeCount);
        out.put("narrativeCount", plan.narrativeCount);
        out.put("minCohortSize", plan.minCohortSize);
        out.put("configuredMinCohortSize", plan.configuredMinCohortSize);
        out.put("cohortFloorIgnored", plan.cohortFloorIgnored);
        out.put("staleThreshold", plan.staleThreshold);
        out.put("refreshCooldownHours", plan.refreshCooldownHours);
        out.put("byVerdict", plan.byVerdict);
        out.put("scopes", plan.scopes);
        // So the dialog can say "overwrites the dashboard released on <date>" rather than
        // letting an admin discover the overwrite afterwards.
        out.put("existingGeneratedAt", plan.existingGeneratedAt);
        return ResponseEntity.ok(out);
    }

    /**
     * Trigger a release. Returns 202 with a releaseId; generation continues off-thread
     * because many OpenAI round trips will not fit inside a request.
     *
     * <p>{@code force} bypasses the refresh conditions. It exists for "the roster was
     * wrong, redo it now", and because a release overwrites with no version to fall back
     * to, the dialog confirms it separately.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @PostMapping("/release/{instituteCode}")
    public ResponseEntity<?> release(@PathVariable Long instituteCode,
                                     @RequestParam Long assessmentId,
                                     @RequestParam(required = false, defaultValue = "ALL") String mode,
                                     @RequestParam(required = false) Long sessionId,
                                     @RequestParam(required = false) Long classId,
                                     @RequestParam(required = false) Long sectionId,
                                     @RequestParam(required = false) List<Long> groupIds,
                                     @RequestParam(required = false, defaultValue = "false") boolean force,
                                     @RequestParam(required = false, defaultValue = "false")
                                     boolean ignoreCohortFloor,
                                     @AuthenticationPrincipal UserPrincipal principal) {

        Long userId = principal == null ? null : principal.getId();

        PrincipalDashboardReleaseService.ReleasePlan plan = releaseService.prepareRelease(
                instituteCode, assessmentId,
                selectionOf(mode, sessionId, classId, sectionId, groupIds),
                force, ignoreCohortFloor, userId);

        if (!plan.accepted) {
            return ResponseEntity.status(409).body(Map.of("error", plan.reason));
        }

        // Rows are committed by the call above, so the worker cannot race them. The
        // snapshot travels with it so generation sees exactly what was previewed.
        releaseService.runReleaseAsync(plan.releaseId, plan.snapshot);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("releaseId", plan.releaseId);
        out.put("scopeCount", plan.scopeCount);
        out.put("narrativeCount", plan.narrativeCount);
        out.put("byVerdict", plan.byVerdict);
        return ResponseEntity.accepted().body(out);
    }

    /** Progress for the polling UI. Counts only — never loads the LONGTEXT payloads. */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/status")
    public ResponseEntity<?> status(@PathVariable Long instituteCode,
                                    @RequestParam String releaseId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        long total = 0;
        for (Object[] row : repository.countByStatusForRelease(releaseId)) {
            long n = ((Number) row[1]).longValue();
            counts.put((String) row[0], n);
            total += n;
        }
        long done = counts.getOrDefault(PrincipalDashboardData.STATUS_GENERATED, 0L)
                  + counts.getOrDefault(PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT, 0L)
                  + counts.getOrDefault(PrincipalDashboardData.STATUS_FAILED, 0L);

        // Distinct reasons rather than one per scope: 25 scopes failing on the same
        // missing API key is one problem to fix, not 25.
        List<Map<String, String>> failures = new ArrayList<>();
        Set<String> seenReasons = new LinkedHashSet<>();
        for (Object[] row : repository.findFailuresForRelease(releaseId)) {
            String reason = row[1] == null ? "No error recorded." : (String) row[1];
            if (!seenReasons.add(reason)) continue;
            Map<String, String> f = new LinkedHashMap<>();
            f.put("scopeKey", (String) row[0]);
            f.put("reason", reason);
            failures.add(f);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("releaseId", releaseId);
        out.put("total", total);
        out.put("done", done);
        out.put("complete", total > 0 && done == total);
        out.put("byStatus", counts);
        out.put("failures", failures);
        out.put("minCohortSize", releaseService.getMinCohortSize());
        return ResponseEntity.ok(out);
    }

    /**
     * Read one scope. A pure lookup: the read path never computes and never calls OpenAI,
     * so a dashboard that was never released stays empty rather than silently generating
     * itself on someone's first visit.
     *
     * <p>Absent or non-GENERATED resolves to {@code released: false}, which is what drives
     * the page's "Dashboard is not Generated Yet" state.
     */
    @PreAuthorize("@auth.allows('dashboard.school.read', #instituteCode)")
    @GetMapping("/{instituteCode}")
    public ResponseEntity<?> read(@PathVariable Long instituteCode,
                                  @RequestParam Long assessmentId,
                                  @RequestParam(required = false) Long sessionId,
                                  @RequestParam(required = false) Long classId,
                                  @RequestParam(required = false) Long sectionId,
                                  @RequestParam(required = false) Long groupId) {

        ScopeKey scope = ScopeKey.of(assessmentId, sessionId, classId, sectionId, groupId);
        Optional<PrincipalDashboardData> found =
                repository.findByInstituteCodeAndScopeKey(instituteCode, scope.key());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scopeKey", scope.key());
        out.put("scopeLabel", scope.describe());

        if (found.isEmpty()) {
            out.put("released", false);
            out.put("status", "NOT_GENERATED");
            return ResponseEntity.ok(out);
        }
        return ResponseEntity.ok(describe(found.get(), out, instituteCode, scope));
    }

    /**
     * The school's live dashboard, payload included.
     *
     * <p>The page knows its institute but not which assessment is current, and resolving
     * that through the live computation would reintroduce exactly the recompute this read
     * path exists to avoid — so the answer comes from stored rows, filtered to the
     * assessment a release marked current.
     */
    @PreAuthorize("@auth.allows('dashboard.school.read', #instituteCode)")
    @GetMapping("/{instituteCode}/latest")
    public ResponseEntity<?> latest(@PathVariable Long instituteCode) {
        List<PrincipalDashboardData> rows = repository.findInstituteScopesNewestFirst(instituteCode);

        Map<String, Object> out = new LinkedHashMap<>();
        if (rows.isEmpty()) {
            out.put("released", false);
            out.put("status", "NOT_GENERATED");
            return ResponseEntity.ok(out);
        }

        PrincipalDashboardData row = rows.get(0);
        out.put("assessmentId", row.getAssessmentId());
        out.put("scopeKey", row.getScopeKey());
        out.put("scopeLabel", "Whole school");
        ScopeKey scope = ScopeKey.institute(row.getAssessmentId());
        return ResponseEntity.ok(describe(row, out, instituteCode, scope));
    }

    // ─────────────────────── TEMPORARY: chart data dump ───────────────────────
    // Added on request to inspect what the page's charts are drawn from. Delete this
    // endpoint, the button that calls it, and PrincipalDashboardChartLogger together.

    /**
     * Print the computed chart data for the scope in view to the server console.
     *
     * <p>Reads the stored payload — the same numbers the page is rendering — rather than
     * recomputing, so what is logged is exactly what the charts show.
     */
    @PreAuthorize("@auth.allows('dashboard.school.read', #instituteCode)")
    @PostMapping("/{instituteCode}/log-chart-data")
    public ResponseEntity<?> logChartData(@PathVariable Long instituteCode,
                                          @RequestParam Long assessmentId,
                                          @RequestParam(required = false) Long sessionId,
                                          @RequestParam(required = false) Long classId,
                                          @RequestParam(required = false) Long sectionId,
                                          @RequestParam(required = false) Long groupId) {

        ScopeKey scope = ScopeKey.of(assessmentId, sessionId, classId, sectionId, groupId);
        Optional<PrincipalDashboardData> found =
                repository.findByInstituteCodeAndScopeKey(instituteCode, scope.key());

        if (found.isEmpty() || found.get().getInternalCalculation() == null) {
            return ResponseEntity.ok(Map.of(
                    "logged", false,
                    "message", "Nothing stored for " + scope.key()));
        }

        int charts = chartLogger.dump(found.get().getScopeLabel(), scope.key(),
                found.get().getInternalCalculation(), found.get().getAiResponse());

        return ResponseEntity.ok(Map.of(
                "logged", true,
                "scope", String.valueOf(found.get().getScopeLabel()),
                "charts", charts,
                "message", "Printed to the server console."));
    }

    /**
     * The students behind one screening tier.
     *
     * <p>The counts travel with every dashboard load; the names do not. They are resolved
     * here, on request, so identifiable screening data crosses the wire only when someone
     * has actually asked which students a tier refers to.
     *
     * <p>Reads the ids the release stored rather than recomputing the tier — recomputing
     * would mean re-scoring the cohort on a read.
     *
     * <p>Gated on {@code dashboard.school.read}: anyone who can open this school's
     * dashboard can see which of its students are flagged.
     */
    @PreAuthorize("@auth.allows('dashboard.school.read', #instituteCode)")
    @GetMapping("/{instituteCode}/flagged")
    public ResponseEntity<?> flagged(@PathVariable Long instituteCode,
                                     @RequestParam Long assessmentId,
                                     @RequestParam String tier,
                                     @RequestParam(required = false) Long sessionId,
                                     @RequestParam(required = false) Long classId,
                                     @RequestParam(required = false) Long sectionId,
                                     @RequestParam(required = false) Long groupId) {

        ScopeKey scope = ScopeKey.of(assessmentId, sessionId, classId, sectionId, groupId);
        Optional<PrincipalDashboardData> found =
                repository.findByInstituteCodeAndScopeKey(instituteCode, scope.key());
        if (found.isEmpty() || found.get().getInternalCalculation() == null) {
            return ResponseEntity.ok(List.of());
        }

        List<Long> ids = flaggedIds(found.get().getInternalCalculation(), tier);
        if (ids.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (UserStudent student : userStudentRepository.findAllById(ids)) {
            StudentInfo info = student.getStudentInfo();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userStudentId", student.getUserStudentId());
            m.put("name", info == null || info.getName() == null ? "Unnamed student" : info.getName());
            m.put("studentClass", info == null ? null : info.getStudentClass());
            m.put("rollNumber", info == null ? null : info.getSchoolRollNumber());
            out.add(m);
        }
        // Alphabetical: this is a list to work through, not a ranking.
        out.sort(Comparator.comparing(m -> String.valueOf(m.get("name")).toLowerCase()));
        return ResponseEntity.ok(out);
    }

    /**
     * Pull one tier's stored ids out of the payload.
     *
     * <p>An unknown tier, an older payload written before ids were stored, or malformed
     * JSON all resolve to an empty list — the dashboard shows "no students recorded"
     * rather than an error, because the counts beside it are still valid.
     */
    private List<Long> flaggedIds(String internalCalculation, String tier) {
        try {
            JsonNode students = objectMapper.readTree(internalCalculation)
                    .path("flags").path("students").path(tier);
            if (!students.isArray()) return List.of();
            List<Long> ids = new ArrayList<>();
            students.forEach(node -> {
                if (node.canConvertToLong()) ids.add(node.asLong());
            });
            return ids;
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Every released scope for an institute, without payloads — lets the dashboard's
     * filter rail grey out combinations that were never generated instead of offering them
     * and then showing an empty state.
     *
     * <p>Staleness is deliberately absent here. It needs a live count per scope, and this
     * endpoint returns every scope; the single-scope endpoints carry it instead.
     */
    @PreAuthorize("@auth.allows('dashboard.school.read', #instituteCode)")
    @GetMapping("/{instituteCode}/scopes")
    public ResponseEntity<?> scopes(@PathVariable Long instituteCode,
                                    @RequestParam Long assessmentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (PrincipalDashboardData row :
                repository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("scopeKey", row.getScopeKey());
            m.put("scopeLevel", row.getScopeLevel());
            // The name resolved when this was released — what the filter rail labels it.
            m.put("scopeLabel", row.getScopeLabel());
            m.put("sessionId", row.getSessionId());
            m.put("classId", row.getClassId());
            m.put("sectionId", row.getSectionId());
            m.put("groupId", row.getGroupId());
            m.put("status", row.getGenerationStatus());
            m.put("studentCount", row.getScoredCount());
            m.put("generatedAt", row.getGeneratedAt());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    /**
     * Fill in one row's response, including how far the cohort has moved since it was
     * generated.
     *
     * <p>The live count is queried here rather than read from a column: both stored counts
     * are written in the same transaction at generation, so any comparison between them is
     * zero forever. The delta only exists against a number counted now.
     */
    private Map<String, Object> describe(PrincipalDashboardData row, Map<String, Object> out,
                                         Long instituteCode, ScopeKey scope) {
        boolean usable = PrincipalDashboardData.STATUS_GENERATED.equals(row.getGenerationStatus())
                || PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT.equals(row.getGenerationStatus());

        int live = releaseService.liveScoredCount(instituteCode, row.getAssessmentId(), scope);

        out.put("released", usable);
        out.put("status", row.getGenerationStatus());
        out.put("generatedAt", row.getGeneratedAt());
        out.put("scopeLevel", row.getScopeLevel());
        if (row.getScopeLabel() != null) {
            // The stored name wins over the key-derived fallback set by the caller.
            out.put("scopeLabel", row.getScopeLabel());
        }
        out.put("studentCount", row.getScoredCount());
        out.put("liveStudentCount", live);
        out.put("newStudentsSinceGeneration", row.newStudentsSince(live));
        out.put("stale", row.isStale(live));
        out.put("minCohortSize", row.getMinCohortSize());

        if (usable) {
            out.put("internalCalculation", row.getInternalCalculation());
            out.put("aiResponse", row.getAiResponse());
            out.put("docxPath", row.getDocxPath());
        }
        if (PrincipalDashboardData.STATUS_FAILED.equals(row.getGenerationStatus())) {
            out.put("error", row.getErrorMessage());
        }
        return out;
    }

    // ───────────────────────── administration ─────────────────────────

    /**
     * Take a school's dashboard off the air, or put it back.
     *
     * <p>A flag, not a delete. The principal's page filters on it, so the dashboard is
     * gated immediately while the computed figures and the paid narrative survive —
     * republishing costs nothing, where regenerating would be another full run of OpenAI
     * calls. Pass a scopeKey to withdraw one cohort instead of the school.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @PostMapping("/release/{instituteCode}/publish")
    public ResponseEntity<Map<String, Object>> setPublished(
            @PathVariable Long instituteCode,
            @RequestParam Long assessmentId,
            @RequestParam boolean published,
            @RequestParam(required = false) String scopeKey) {

        int affected = scopeKey == null || scopeKey.isBlank()
                ? repository.setCurrentForInstitute(instituteCode, assessmentId, published)
                : repository.setCurrentForScope(instituteCode, assessmentId, scopeKey, published);

        trace.run("admin-" + instituteCode, instituteCode, assessmentId,
                published ? PrincipalDashboardReleaseLog.STEP_REPUBLISHED
                          : PrincipalDashboardReleaseLog.STEP_UNPUBLISHED,
                PrincipalDashboardReleaseLog.OUTCOME_OK,
                (scopeKey == null || scopeKey.isBlank() ? "Whole school" : scopeKey)
                        + " — " + affected + " scope(s) "
                        + (published ? "republished" : "withdrawn"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("published", published);
        out.put("affected", affected);
        return ResponseEntity.ok(out);
    }

    /**
     * Every stored scope for a school, withdrawn ones included.
     *
     * <p>Distinct from {@code /scopes}, which the principal's filter rail uses and which
     * deliberately hides anything not published — the admin page needs to see exactly what
     * it is being asked to republish.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/scopes")
    public ResponseEntity<List<Map<String, Object>>> adminScopes(
            @PathVariable Long instituteCode,
            @RequestParam Long assessmentId) {

        List<Map<String, Object>> out = new ArrayList<>();
        for (PrincipalDashboardData row : repository.findAllScopesForAdmin(instituteCode, assessmentId)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("scopeKey", row.getScopeKey());
            item.put("scopeLabel", row.getScopeLabel());
            item.put("scopeLevel", row.getScopeLevel());
            item.put("status", row.getGenerationStatus());
            item.put("published", Boolean.TRUE.equals(row.getIsCurrent()));
            item.put("studentCount", row.getScoredCount());
            item.put("generatedAt", row.getGeneratedAt());
            item.put("error", row.getErrorMessage());
            item.put("hasNarrative", row.getAiResponse() != null);
            out.add(item);
        }
        return ResponseEntity.ok(out);
    }

    /** The step-by-step trace of one run. */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/log")
    public ResponseEntity<List<Map<String, Object>>> releaseLog(
            @PathVariable Long instituteCode,
            @RequestParam(required = false) String releaseId,
            @RequestParam(defaultValue = "300") int limit) {

        List<PrincipalDashboardReleaseLog> entries = releaseId == null || releaseId.isBlank()
                ? trace.forInstitute(instituteCode, limit)
                : trace.forRelease(releaseId);

        List<Map<String, Object>> out = new ArrayList<>();
        for (PrincipalDashboardReleaseLog entry : entries) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", entry.getId());
            item.put("releaseId", entry.getReleaseId());
            item.put("scopeKey", entry.getScopeKey());
            item.put("scopeLabel", entry.getScopeLabel());
            item.put("step", entry.getStep());
            item.put("outcome", entry.getOutcome());
            item.put("message", entry.getMessage());
            item.put("durationMs", entry.getDurationMs());
            item.put("createdAt", entry.getCreatedAt());
            out.add(item);
        }
        return ResponseEntity.ok(out);
    }

    /** The runs this school has had, for the log viewer's picker. */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/runs")
    public ResponseEntity<List<Map<String, Object>>> releaseRuns(
            @PathVariable Long instituteCode,
            @RequestParam(defaultValue = "20") int limit) {

        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row : trace.runsFor(instituteCode, limit)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("releaseId", row[0]);
            item.put("startedAt", row[1]);
            item.put("finishedAt", row[2]);
            item.put("entries", row[3]);
            out.add(item);
        }
        return ResponseEntity.ok(out);
    }

    /** Who could be told the dashboard is live. */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/contacts")
    public ResponseEntity<List<PrincipalDashboardNotificationService.Recipient>> contacts(
            @PathVariable Long instituteCode) {
        return ResponseEntity.ok(notifications.recipientsFor(instituteCode));
    }

    /**
     * Mail the chosen contacts that the dashboard is live.
     *
     * <p>Returns one outcome per recipient rather than a single success flag: one bad
     * address among five is the normal case, and the admin needs to know which.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @PostMapping("/release/{instituteCode}/notify")
    public ResponseEntity<List<PrincipalDashboardNotificationService.SendOutcome>> notifyContacts(
            @PathVariable Long instituteCode,
            @RequestParam(required = false) String instituteName,
            @RequestParam(required = false) String assessmentName,
            @RequestParam List<Long> contactPersonIds) {

        return ResponseEntity.ok(notifications.notify(
                instituteCode,
                instituteName == null || instituteName.isBlank() ? "your school" : instituteName,
                assessmentName,
                contactPersonIds));
    }
}
