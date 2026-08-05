package com.kccitm.api.controller.dashboard;

import java.util.ArrayList;
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

import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.repository.Career9.PrincipalDashboardDataRepository;
import com.kccitm.api.security.UserPrincipal;
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

    public PrincipalDashboardReleaseController(PrincipalDashboardReleaseService releaseService,
                                               PrincipalDashboardDataRepository repository) {
        this.releaseService = releaseService;
        this.repository = repository;
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
}
