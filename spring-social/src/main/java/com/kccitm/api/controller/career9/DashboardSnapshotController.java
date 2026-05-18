package com.kccitm.api.controller.career9;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.career9.DashboardDataService;

/**
 * Admin-dashboard read endpoint.
 *
 * <p>Pre-2026-05 this controller served a global 24 h cached snapshot through
 * {@code DashboardSnapshotService}; the response was then filtered in-memory
 * by {@code DashboardSnapshotFilter}. That two-stage pipeline has been
 * replaced by {@link DashboardDataService}, which runs one scoped JPQL query
 * per list keyed on the caller's {@code AccessScope}.
 *
 * <p>The {@code /admin/snapshot/refresh} endpoint is preserved for FE
 * compatibility (older clients still call it) but is now a no-op alias of
 * {@code /admin/snapshot} — there is no cache to refresh, every read pulls
 * live from the DB. We could deprecate it, but the cost of keeping it is
 * zero and removing it would break the existing FE refresh button.
 */
@RestController
@RequestMapping("/dashboard")
public class DashboardSnapshotController {

    @Autowired
    private DashboardDataService dashboardDataService;

    @GetMapping("/admin/snapshot")
    @PreAuthorize("@auth.allows('dashboard_snapshot.read')")
    public ResponseEntity<Map<String, Object>> getAdminSnapshot() {
        return ResponseEntity.ok(dashboardDataService.fetchForCurrentUser());
    }

    @PostMapping("/admin/snapshot/refresh")
    @PreAuthorize("@auth.allows('dashboard_snapshot.update')")
    public ResponseEntity<Map<String, Object>> refreshAdminSnapshot() {
        // Busts the caller's Redis cache key (`dashboard:user:{id}`) and
        // recomputes. The 24 h TTL still applies to the newly-written entry —
        // this endpoint only resets the clock for one user. The FE "Refresh"
        // button calls this when the admin wants fresher-than-TTL data.
        return ResponseEntity.ok(dashboardDataService.refreshForCurrentUser());
    }
}
