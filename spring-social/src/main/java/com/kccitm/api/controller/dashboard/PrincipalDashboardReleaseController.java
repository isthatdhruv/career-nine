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
import com.kccitm.api.service.dashboard.principal.ScopeKey;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Release and read the per-scope principal dashboards.
 *
 * <p>Three concerns, deliberately separate endpoints: previewing a release (so the
 * confirmation dialog can state its size), triggering one (async, returns immediately),
 * and reading a single scope (a pure lookup — no computation on the read path).
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
     * What a release would do, without doing it. Backs the confirmation popup: how many
     * scopes, and whether one is already running.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @GetMapping("/release/{instituteCode}/preview")
    public ResponseEntity<?> preview(@PathVariable Long instituteCode,
                                     @RequestParam Long assessmentId) {
        PrincipalDashboardReleaseService.ReleasePlan plan =
                releaseService.preview(instituteCode, assessmentId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scopeCount", plan.scopeCount);
        // Priced alongside the default so "Release All" is an informed choice: it
        // covers combinations the filter rail cannot even select, at one OpenAI call
        // each.
        out.put("fullScopeCount", plan.fullScopeCount);
        out.put("minCohortSize", plan.minCohortSize);
        out.put("canRelease", plan.accepted);
        out.put("reason", plan.reason);

        // So the dialog can say "overwrites the dashboard released on <date>" rather
        // than letting an admin discover the overwrite afterwards.
        repository.findByInstituteCodeAndScopeKey(instituteCode, ScopeKey.institute(assessmentId).key())
                .ifPresent(existing -> {
                    out.put("existingGeneratedAt", existing.getGeneratedAt());
                    out.put("existingStatus", existing.getGenerationStatus());
                });
        return ResponseEntity.ok(out);
    }

    /**
     * Trigger a release. Returns 202 with a releaseId; generation continues off-thread
     * because ~25 OpenAI round trips will not fit inside a request.
     */
    @PreAuthorize("@auth.allows('dashboard.school.release', #instituteCode)")
    @PostMapping("/release/{instituteCode}")
    public ResponseEntity<?> release(@PathVariable Long instituteCode,
                                     @RequestParam Long assessmentId,
                                     @RequestParam(required = false, defaultValue = "LATTICE") String mode,
                                     @AuthenticationPrincipal UserPrincipal principal) {
        Long userId = principal == null ? null : principal.getId();

        PrincipalDashboardReleaseService.ReleaseMode releaseMode;
        try {
            releaseMode = PrincipalDashboardReleaseService.ReleaseMode.valueOf(mode.toUpperCase());
        } catch (IllegalArgumentException e) {
            // Default rather than guess: an unrecognised mode must not silently
            // trigger the expensive one.
            releaseMode = PrincipalDashboardReleaseService.ReleaseMode.LATTICE;
        }

        PrincipalDashboardReleaseService.ReleasePlan plan =
                releaseService.prepareRelease(instituteCode, assessmentId, userId, releaseMode);

        if (!plan.accepted) {
            return ResponseEntity.status(409).body(Map.of("error", plan.reason));
        }

        // Rows are committed by the call above, so the worker cannot race them.
        releaseService.runReleaseAsync(plan.releaseId);

        return ResponseEntity.accepted().body(Map.of(
                "releaseId", plan.releaseId,
                "scopeCount", plan.scopeCount));
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
        return ResponseEntity.ok(out);
    }

    /**
     * Read one scope. A pure lookup: the read path never computes and never calls
     * OpenAI, so a dashboard that was never released stays empty rather than silently
     * generating itself on someone's first visit.
     *
     * <p>Absent or non-GENERATED resolves to {@code released: false}, which is what
     * drives the page's "Dashboard is not Generated Yet" state.
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

        PrincipalDashboardData row = found.get();
        boolean usable = PrincipalDashboardData.STATUS_GENERATED.equals(row.getGenerationStatus())
                || PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT.equals(row.getGenerationStatus());

        out.put("released", usable);
        out.put("status", row.getGenerationStatus());
        out.put("generatedAt", row.getGeneratedAt());
        out.put("scopeLevel", row.getScopeLevel());
        out.put("studentCount", row.getScoredCount());
        out.put("stale", row.isStale());
        out.put("newStudentsSinceGeneration", row.newStudentsSinceGeneration());
        out.put("minCohortSize", row.getMinCohortSize());

        if (usable) {
            out.put("internalCalculation", row.getInternalCalculation());
            out.put("aiResponse", row.getAiResponse());
            out.put("docxPath", row.getDocxPath());
        }
        if (PrincipalDashboardData.STATUS_FAILED.equals(row.getGenerationStatus())) {
            out.put("error", row.getErrorMessage());
        }
        return ResponseEntity.ok(out);
    }

    /**
     * The most recent release for an institute, payload included.
     *
     * <p>The dashboard's entry point. The page knows its institute but not which
     * assessment was released, and resolving that through the live computation would
     * reintroduce exactly the recompute this read path exists to avoid — so the answer
     * comes from stored rows.
     *
     * <p>Returns {@code released: false} when nothing has ever been released, which is
     * what drives the "Dashboard is not Generated Yet" state.
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
        boolean usable = PrincipalDashboardData.STATUS_GENERATED.equals(row.getGenerationStatus())
                || PrincipalDashboardData.STATUS_SKIPPED_SMALL_COHORT.equals(row.getGenerationStatus());

        out.put("released", usable);
        out.put("status", row.getGenerationStatus());
        out.put("assessmentId", row.getAssessmentId());
        out.put("scopeKey", row.getScopeKey());
        out.put("scopeLevel", row.getScopeLevel());
        out.put("scopeLabel", "Whole institute");
        out.put("generatedAt", row.getGeneratedAt());
        out.put("studentCount", row.getScoredCount());
        out.put("stale", row.isStale());
        out.put("newStudentsSinceGeneration", row.newStudentsSinceGeneration());
        out.put("minCohortSize", row.getMinCohortSize());
        if (usable) {
            out.put("internalCalculation", row.getInternalCalculation());
            out.put("aiResponse", row.getAiResponse());
            out.put("docxPath", row.getDocxPath());
        }
        return ResponseEntity.ok(out);
    }

    /**
     * Every released scope for an institute, without payloads — lets the dashboard's
     * filter rail grey out combinations that were never generated instead of offering
     * them and then showing an empty state.
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
            m.put("sessionId", row.getSessionId());
            m.put("classId", row.getClassId());
            m.put("sectionId", row.getSectionId());
            m.put("groupId", row.getGroupId());
            m.put("status", row.getGenerationStatus());
            m.put("studentCount", row.getScoredCount());
            m.put("generatedAt", row.getGeneratedAt());
            m.put("stale", row.isStale());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }
}
